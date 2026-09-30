/**
 * Mechanic portal (`/majstor`, docs/ARCHITECTURE.md §A4): overview with tier and credit,
 * quick order by pasted OEM lines, one-click inquiry for the numbers we do not carry, and
 * the personal price list pages behind the XLSX download.
 *
 * Every function is a user function; the approved-only ones re-check through
 * `requireApprovedMechanic`. Prices come from the single pricing path
 * (`convex/lib/pricing.ts`) and are the caller's own — never another role's, never cost.
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { isPlausibleOem, normalizeCode } from "../lib/domain/codes";
import { QUICK_ORDER_MAX_ITEMS, QUICK_ORDER_MAX_QTY } from "../lib/domain/quickOrder";
import { canOrderQuantity, STOCK_STATE_RANK } from "../lib/domain/stock";
import { actorOf, requireApprovedMechanic, type Viewer } from "./lib/authz";
import { lookupCodes, codeKindV } from "./catalog/codes";
import { isListed, productCardV, toCard } from "./lib/catalog";
import { fail, invalid } from "./lib/errors";
import { userMutation, userQuery } from "./lib/functions";
import { insertInquiry } from "./lib/inquiries";
import { creditStatus } from "./lib/mechanics";
import {
  loadPricingContext,
  resolveForContext,
  type CategoryPathCache,
  type PricingContext,
} from "./lib/pricing";
import { enforceRateLimit } from "./lib/rateLimits";
import { recordSearch } from "./lib/searchLog";
import { mechanicStatusV, qualityV, serviceTypeV, stockStateV } from "./lib/validators";

/** Pricing context of an approved mechanic (the caller checked the status). */
async function mechanicPricing(ctx: QueryCtx, viewer: Viewer): Promise<PricingContext> {
  const pc = await loadPricingContext(ctx, viewer);
  if (!pc) return fail("FORBIDDEN", "Ova opcija je dostupna odobrenim majstorima.");
  return pc;
}

// ------------------------------------------------------------------ overview

const creditV = v.object({
  enabled: v.boolean(),
  limitPara: v.union(v.number(), v.null()),
  usedPara: v.number(),
  availablePara: v.union(v.number(), v.null()),
  paymentTermsDays: v.number(),
  openCount: v.number(),
});

const MAX_FAVORITES = 200;
const MAX_VEHICLES = 30;

/** The signed-in user's mechanic profile with tier, credit and counts; null without one. */
export const overview = userQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      status: mechanicStatusV,
      companyName: v.string(),
      pib: v.string(),
      mb: v.string(),
      contactPerson: v.string(),
      phone: v.string(),
      email: v.string(),
      city: v.string(),
      address: v.string(),
      serviceTypes: v.array(serviceTypeV),
      brandsServiced: v.array(v.id("vehicleBrands")),
      tierName: v.union(v.string(), v.null()),
      tierDiscountBp: v.union(v.number(), v.null()),
      /** Personal default rabat when staff set one (overrides the tier default). */
      personalDiscountBp: v.union(v.number(), v.null()),
      credit: creditV,
      counts: v.object({ favorites: v.number(), vehicles: v.number() }),
      rejectionReason: v.union(v.string(), v.null()),
      submittedAt: v.number(),
      reviewedAt: v.union(v.number(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const profile = await ctx.db
      .query("mechanicProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewer.userId))
      .first();
    if (!profile) return null;
    const approved = profile.status === "approved";
    const tier = approved && profile.tierId ? await ctx.db.get("priceTiers", profile.tierId) : null;
    const favorites = await ctx.db
      .query("favorites")
      .withIndex("by_userId_and_productId", (q) => q.eq("userId", ctx.viewer.userId))
      .take(MAX_FAVORITES);
    const vehicles = await ctx.db
      .query("savedVehicles")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewer.userId))
      .take(MAX_VEHICLES);
    return {
      status: profile.status,
      companyName: profile.companyName,
      pib: profile.pib,
      mb: profile.mb,
      contactPerson: profile.contactPerson,
      phone: profile.phone,
      email: profile.email,
      city: profile.city,
      address: profile.address,
      serviceTypes: profile.serviceTypes,
      brandsServiced: profile.brandsServiced,
      tierName: tier?.name ?? null,
      tierDiscountBp: tier?.defaultDiscountBp ?? null,
      personalDiscountBp: approved ? (profile.personalRules?.defaultDiscountBp ?? null) : null,
      credit: await creditStatus(ctx, profile),
      counts: { favorites: favorites.length, vehicles: vehicles.length },
      rejectionReason: profile.status === "rejected" ? (profile.rejectionReason ?? null) : null,
      submittedAt: profile._creationTime,
      reviewedAt: profile.reviewedAt ?? null,
    };
  },
});

// ------------------------------------------------------------------ quick order

const QUALITY_RANK: Record<Doc<"products">["quality"], number> = {
  original: 0,
  oem: 1,
  aftermarket: 2,
};
const CODE_ROWS_PER_LOOKUP = 12;
const MAX_OPTIONS = 8;
const MAX_LOGGED_MISSES = 20;

const optionV = v.object({
  card: productCardV,
  unitPricePara: v.number(),
  discountBp: v.number(),
  matchedCode: v.string(),
  matchKind: codeKindV,
  /** Whether the requested quantity can be ordered (from stock or as a backorder). */
  orderable: v.boolean(),
  backorder: v.boolean(),
  available: v.number(),
});

const matchRowV = v.object({
  key: v.string(),
  code: v.string(),
  normalized: v.string(),
  quantity: v.number(),
  status: v.union(v.literal("exact"), v.literal("ambiguous"), v.literal("not_found")),
  options: v.array(optionV),
});

type Option = typeof optionV.type;
type MatchStatus = (typeof matchRowV.type)["status"];

/**
 * Matches parsed quick-order items (`lib/domain/quickOrder.ts` on the client; codes are
 * re-normalised here). Per item the first candidate reading with catalogue hits wins:
 * 1 listed product → `exact`, more → `ambiguous` (options sorted quality → price → stock),
 * none → `not_found` (logged for „Traženo, a nemamo“). A mutation only for the rate limit
 * and the search log; it writes nothing else.
 */
export const quickOrderMatch = userMutation({
  args: {
    items: v.array(
      v.object({
        key: v.string(),
        candidates: v.array(v.object({ code: v.string(), quantity: v.number() })),
      }),
    ),
  },
  returns: v.object({
    rows: v.array(matchRowV),
    counts: v.object({ exact: v.number(), ambiguous: v.number(), notFound: v.number() }),
  }),
  handler: async (ctx, { items }) => {
    const viewer = await requireApprovedMechanic(ctx);
    if (items.length === 0) invalid("Upišite bar jedan broj dela.", "items");
    if (items.length > QUICK_ORDER_MAX_ITEMS) invalid("Najviše 200 stavki odjednom.", "items");
    await enforceRateLimit(ctx, "quickOrderMatch", viewer.userId);

    const pc = await mechanicPricing(ctx, viewer);
    const pathCache: CategoryPathCache = new Map();
    const productCache = new Map<Id<"products">, Doc<"products"> | null>();
    const priceCache = new Map<Id<"products">, { unitPricePara: number; discountBp: number }>();
    const lookupCache = new Map<string, Doc<"productCodes">[]>();

    const product = async (id: Id<"products">) => {
      if (!productCache.has(id)) productCache.set(id, await ctx.db.get("products", id));
      return productCache.get(id) ?? null;
    };
    const price = async (p: Doc<"products">) => {
      const hit = priceCache.get(p._id);
      if (hit) return hit;
      const resolved = await resolveForContext(ctx, pc, p, pathCache);
      const out = { unitPricePara: resolved.unitPricePara, discountBp: resolved.discountBp };
      priceCache.set(p._id, out);
      return out;
    };

    const rows = [];
    const counts = { exact: 0, ambiguous: 0, notFound: 0 };
    let logged = 0;
    for (const item of items) {
      const candidates = item.candidates
        .slice(0, 2)
        .map((c) => ({
          code: c.code.trim().slice(0, 60),
          normalized: normalizeCode(c.code.slice(0, 60)),
          quantity: Math.floor(c.quantity),
        }))
        .filter(
          (c) =>
            isPlausibleOem(c.normalized) && c.quantity >= 1 && c.quantity <= QUICK_ORDER_MAX_QTY,
        );
      if (candidates.length === 0) invalid("Neispravan broj dela ili količina.", "items");

      let chosen = candidates[0]!;
      let options: Option[] = [];
      for (const candidate of candidates) {
        let codeRows = lookupCache.get(candidate.normalized);
        if (!codeRows) {
          codeRows = await lookupCodes(ctx, candidate.normalized, "exact", CODE_ROWS_PER_LOOKUP);
          lookupCache.set(candidate.normalized, codeRows);
        }
        const found: Option[] = [];
        const seen = new Set<Id<"products">>();
        for (const row of codeRows) {
          if (seen.has(row.productId)) continue;
          seen.add(row.productId);
          const p = await product(row.productId);
          if (!p || !isListed(p)) continue;
          const check = canOrderQuantity(p, candidate.quantity);
          const priced = await price(p);
          found.push({
            card: await toCard(ctx, p, true),
            unitPricePara: priced.unitPricePara,
            discountBp: priced.discountBp,
            matchedCode: row.raw,
            matchKind: row.kind,
            orderable: check.ok,
            backorder: check.backorder,
            available: check.available,
          });
        }
        if (found.length > 0) {
          chosen = candidate;
          options = found;
          break;
        }
      }
      options.sort(
        (a, b) =>
          QUALITY_RANK[a.card.quality] - QUALITY_RANK[b.card.quality] ||
          a.unitPricePara - b.unitPricePara ||
          STOCK_STATE_RANK[a.card.stockState] - STOCK_STATE_RANK[b.card.stockState],
      );
      const status: MatchStatus =
        options.length === 0 ? "not_found" : options.length === 1 ? "exact" : "ambiguous";
      if (status === "exact") counts.exact++;
      else if (status === "ambiguous") counts.ambiguous++;
      else {
        counts.notFound++;
        if (logged < MAX_LOGGED_MISSES) {
          logged++;
          await recordSearch(ctx, {
            query: chosen.code,
            resultsCount: 0,
            exactCodeHit: false,
            source: "quick_order",
            userType: "mechanic",
          });
        }
      }
      rows.push({
        key: item.key.slice(0, 12),
        code: chosen.code,
        normalized: chosen.normalized,
        quantity: chosen.quantity,
        status,
        options: options.slice(0, MAX_OPTIONS),
      });
    }
    return { rows, counts };
  },
});

/**
 * „Pošalji upit za nepronađene“: one inquiry (`quick_order_missing`) with the missing
 * numbers and quantities, contact taken from the mechanic's profile — no form to fill.
 */
export const inquireMissing = userMutation({
  args: {
    items: v.array(v.object({ code: v.string(), quantity: v.number() })),
    note: v.optional(v.string()),
  },
  returns: v.object({ number: v.string(), token: v.string() }),
  handler: async (ctx, args) => {
    const viewer = await requireApprovedMechanic(ctx);
    if (args.items.length === 0) invalid("Nema nepronađenih brojeva.", "items");
    if (args.items.length > 50) invalid("Najviše 50 brojeva u jednom upitu.", "items");
    await enforceRateLimit(ctx, "inquirySubmit", ctx.client.key);
    const profile = await ctx.db.get("mechanicProfiles", viewer.mechanic.profileId);
    if (!profile || profile.userId !== viewer.userId) return fail("FORBIDDEN", "Nemate pristup.");

    const lines = args.items.map((i) => ({
      code: i.code.trim().slice(0, 60),
      normalized: normalizeCode(i.code.slice(0, 60)),
      quantity: Math.min(QUICK_ORDER_MAX_QTY, Math.max(1, Math.floor(i.quantity))),
    }));
    if (lines.some((l) => !isPlausibleOem(l.normalized)))
      invalid("Neispravan broj dela.", "items");
    const note = args.note?.trim().slice(0, 400);
    const message = [
      "Brza porudžbina — ove brojeve nismo našli u katalogu:",
      ...lines.map((l) => `${l.code} — ${l.quantity} kom.`),
      ...(note ? ["", `Napomena: ${note}`] : []),
    ]
      .join("\n")
      .slice(0, 2_000);

    const { number, token } = await insertInquiry(ctx, {
      kind: "quick_order_missing",
      message,
      categorySlugs: [],
      requestedCodes: [...new Set(lines.map((l) => l.normalized))].slice(0, 50),
      photos: [],
      contact: {
        name: profile.contactPerson,
        email: profile.email,
        phone: profile.phone,
        preferredChannel: "phone",
      },
      userId: viewer.userId,
      mechanicProfileId: profile._id,
      consent: profile.consent,
      actor: actorOf(viewer),
    });
    return { number, token };
  },
});

// ------------------------------------------------------------------ price list

const priceRowV = v.object({
  sku: v.string(),
  slug: v.string(),
  name: v.string(),
  manufacturerName: v.string(),
  quality: qualityV,
  oemPrimary: v.union(v.string(), v.null()),
  retailPricePara: v.number(),
  unitPricePara: v.number(),
  discountBp: v.number(),
  stockState: stockStateV,
  stockQty: v.number(),
  leadTimeDays: v.union(v.number(), v.null()),
});

/** Header data for the price list file. */
export const priceListMeta = userQuery({
  args: {},
  returns: v.object({
    companyName: v.string(),
    tierName: v.union(v.string(), v.null()),
    tierDiscountBp: v.union(v.number(), v.null()),
    personalDiscountBp: v.union(v.number(), v.null()),
  }),
  handler: async (ctx) => {
    const viewer = await requireApprovedMechanic(ctx);
    const profile = await ctx.db.get("mechanicProfiles", viewer.mechanic.profileId);
    if (!profile) return fail("FORBIDDEN", "Nemate pristup.");
    const tier = profile.tierId ? await ctx.db.get("priceTiers", profile.tierId) : null;
    return {
      companyName: profile.companyName,
      tierName: tier?.name ?? null,
      tierDiscountBp: tier?.defaultDiscountBp ?? null,
      personalDiscountBp: profile.personalRules?.defaultDiscountBp ?? null,
    };
  },
});

/** One page of a leaf category's active products at the mechanic's own prices. */
export const priceListPage = userQuery({
  args: { categoryId: v.id("categories"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(priceRowV),
  handler: async (ctx, { categoryId, paginationOpts }) => {
    const viewer = await requireApprovedMechanic(ctx);
    if (paginationOpts.numItems > 250) invalid("Najviše 250 artikala po strani.");
    const pc = await mechanicPricing(ctx, viewer);
    const cache: CategoryPathCache = new Map();
    const result = await ctx.db
      .query("products")
      .withIndex("by_categoryId_and_active_and_popularity", (q) =>
        q.eq("categoryId", categoryId).eq("active", true),
      )
      .order("desc")
      .paginate(paginationOpts);
    const page = [];
    for (const p of result.page) {
      if (!isListed(p)) continue;
      const resolved = await resolveForContext(ctx, pc, p, cache);
      page.push({
        sku: p.sku,
        slug: p.slug,
        name: p.name,
        manufacturerName: p.manufacturerName,
        quality: p.quality,
        oemPrimary: p.oemPrimary ?? null,
        retailPricePara: p.retailPricePara,
        unitPricePara: resolved.unitPricePara,
        discountBp: resolved.discountBp,
        stockState: p.stockState,
        stockQty: p.stockQty,
        leadTimeDays: p.leadTimeDays ?? null,
      });
    }
    return { ...result, page };
  },
});
