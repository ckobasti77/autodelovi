/**
 * E2E probes (docs/TESTING.md): **internal** queries only, so nothing here is reachable from
 * the internet. Playwright calls them with `npx convex run testing:<name>` against the dev
 * deployment (the CLI uses the deployment's admin key).
 */
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { SYSTEM_ACTOR } from "./lib/authz";
import { approveMechanic as approveMechanicProfile } from "./lib/mechanics";
import { insertInquiry } from "./lib/inquiries";
import { createOrder, validateCheckout } from "./lib/orders";
import { deleteProductHard, updateProduct } from "./lib/productWriter";
import { getSettings } from "./lib/settings";
import { statusLinkToken } from "./lib/linkTokens";
import { hashToken, randomToken } from "./lib/tokens";
import { isAvailableNow } from "../lib/domain/stock";

/**
 * Writers and token readers run only where the deployment opted in (dev + e2e):
 * `npx convex env set E2E_TEST_HELPERS 1`. Production never sets it, so a CLI call pointed at
 * the wrong deployment fails instead of creating test orders or reading status tokens.
 */
function assertTestDeployment(): void {
  if (process.env.E2E_TEST_HELPERS !== "1") {
    throw new Error("Test helpers are disabled on this deployment (set E2E_TEST_HELPERS=1 on dev).");
  }
}

export const orderProbe = internalQuery({
  args: { number: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      status: v.string(),
      source: v.string(),
      customerType: v.string(),
      deliveryMethod: v.string(),
      paymentMethod: v.string(),
      totalPara: v.number(),
      itemCount: v.number(),
      hasAttribution: v.boolean(),
      eventTypes: v.array(v.string()),
    }),
  ),
  handler: async (ctx, { number }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_number", (q) => q.eq("number", number))
      .unique();
    if (!order) return null;
    const events = await ctx.db
      .query("domainEvents")
      .withIndex("by_aggregateType_and_aggregateId", (q) =>
        q.eq("aggregateType", "order").eq("aggregateId", order._id),
      )
      .take(50);
    return {
      status: order.status,
      source: order.source,
      customerType: order.customerType,
      deliveryMethod: order.delivery.method,
      paymentMethod: order.payment.method,
      totalPara: order.totals.totalPara,
      itemCount: order.itemCount,
      hasAttribution: order.attribution !== undefined,
      eventTypes: events.map((e) => e.type),
    };
  },
});

export const inquiryProbe = internalQuery({
  args: { number: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      status: v.string(),
      kind: v.string(),
      vin: v.union(v.string(), v.null()),
      photoCount: v.number(),
      eventTypes: v.array(v.string()),
    }),
  ),
  handler: async (ctx, { number }) => {
    const inquiry = await ctx.db
      .query("inquiries")
      .withIndex("by_number", (q) => q.eq("number", number))
      .unique();
    if (!inquiry) return null;
    const events = await ctx.db
      .query("domainEvents")
      .withIndex("by_aggregateType_and_aggregateId", (q) =>
        q.eq("aggregateType", "inquiry").eq("aggregateId", inquiry._id),
      )
      .take(50);
    return {
      status: inquiry.status,
      kind: inquiry.kind,
      vin: inquiry.vin ?? null,
      photoCount: inquiry.photos.length,
      eventTypes: events.map((e) => e.type),
    };
  },
});

export const backInStockProbe = internalQuery({
  args: { email: v.string() },
  returns: v.array(v.object({ productSlug: v.string(), status: v.string() })),
  handler: async (ctx, { email }) => {
    const rows = await ctx.db
      .query("backInStockSubscriptions")
      .withIndex("by_email", (q) => q.eq("email", email.toLowerCase()))
      .take(20);
    const out = [];
    for (const row of rows) {
      const product = await ctx.db.get("products", row.productId);
      out.push({ productSlug: product?.slug ?? "", status: row.status });
    }
    return out;
  },
});

/**
 * Stable fixtures for the storefront spec, read from the seeded demo catalogue: an in-stock
 * product with an OEM number, an out-of-stock product, and a category + generation pair
 * with fitting products.
 */
export const samples = internalQuery({
  args: {},
  returns: v.object({
    inStock: v.union(
      v.null(),
      v.object({ slug: v.string(), name: v.string(), oem: v.string(), stockQty: v.number() }),
    ),
    outOfStock: v.union(v.null(), v.object({ slug: v.string(), name: v.string() })),
    vehicleCategory: v.union(
      v.null(),
      v.object({
        categorySlug: v.string(),
        brandSlug: v.string(),
        modelSlug: v.string(),
        generationSlug: v.string(),
        fitting: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const inStockRows = await ctx.db
      .query("products")
      .withIndex("by_stockState_and_active", (q) =>
        q.eq("stockState", "in_stock").eq("active", true),
      )
      .take(100);
    const inStock = inStockRows.find(
      (p) => p.oemPrimary && p.stockQty >= 5 && p.deletedAt === undefined,
    );
    const outRows = await ctx.db
      .query("products")
      .withIndex("by_stockState_and_active", (q) =>
        q.eq("stockState", "out_of_stock").eq("active", true),
      )
      .take(20);
    const out = outRows.find((p) => p.deletedAt === undefined && !isAvailableNow(p.stockState));

    let vehicleCategory: {
      categorySlug: string;
      brandSlug: string;
      modelSlug: string;
      generationSlug: string;
      fitting: number;
    } | null = null;
    const brakeDiscs = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", "kocioni-diskovi"))
      .unique();
    if (brakeDiscs) {
      const counts = new Map<string, { f: Doc<"fitments">; n: number }>();
      const rows = await ctx.db.query("fitments").withIndex("by_productId").take(3_000);
      for (const f of rows) {
        if (f.categoryId !== brakeDiscs._id || !f.active) continue;
        const entry = counts.get(f.generationId) ?? { f, n: 0 };
        entry.n++;
        counts.set(f.generationId, entry);
      }
      const best = [...counts.values()].sort((a, b) => b.n - a.n)[0];
      if (best) {
        const [brand, model, generation] = await Promise.all([
          ctx.db.get("vehicleBrands", best.f.brandId),
          ctx.db.get("vehicleModels", best.f.modelId),
          ctx.db.get("vehicleGenerations", best.f.generationId),
        ]);
        if (brand && model && generation) {
          vehicleCategory = {
            categorySlug: brakeDiscs.slug,
            brandSlug: brand.slug,
            modelSlug: model.slug,
            generationSlug: generation.slug,
            fitting: best.n,
          };
        }
      }
    }
    return {
      inStock: inStock
        ? {
            slug: inStock.slug,
            name: inStock.name,
            oem: inStock.oemPrimary!,
            stockQty: inStock.stockQty,
          }
        : null,
      outOfStock: out ? { slug: out.slug, name: out.name } : null,
      vehicleCategory,
    };
  },
});

/**
 * QA only: a fresh status-page token for a demo inquiry that has a sent quote (the seed keeps
 * only token hashes, so screenshots of `/upit/[token]` need a new capability).
 */
export const quotedInquiryToken = internalMutation({
  args: {},
  returns: v.union(v.null(), v.object({ number: v.string(), token: v.string() })),
  handler: async (ctx) => {
    assertTestDeployment();
    const inquiry = await ctx.db
      .query("inquiries")
      .withIndex("by_status", (q) => q.eq("status", "ponuda_poslata"))
      .first();
    if (!inquiry || !inquiry.isDemo) return null;
    const token = randomToken();
    await ctx.db.patch("inquiries", inquiry._id, { publicTokenHash: await hashToken(token) });
    return { number: inquiry.number, token };
  },
});

/**
 * E2E helper (step 14): approves the mechanic registered with `email` exactly like staff
 * would (same helper as `mechanicsAdmin.approve`), and flags the account `isTest`.
 */
export const approveMechanic = internalMutation({
  args: {
    email: v.string(),
    tierSlug: v.optional(v.string()),
    creditEnabled: v.boolean(),
    creditLimitPara: v.optional(v.number()),
  },
  returns: v.object({ profileId: v.id("mechanicProfiles"), tierName: v.string() }),
  handler: async (ctx, args) => {
    assertTestDeployment();
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", args.email.trim().toLowerCase()))
      .first();
    if (!user) throw new Error(`No user ${args.email}`);
    const profile = await ctx.db
      .query("mechanicProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!profile) throw new Error(`No mechanic profile for ${args.email}`);
    const tier = await ctx.db
      .query("priceTiers")
      .withIndex("by_slug", (q) => q.eq("slug", args.tierSlug ?? "majstor"))
      .unique();
    if (!tier) throw new Error(`No tier ${args.tierSlug ?? "majstor"}`);
    await approveMechanicProfile(ctx, SYSTEM_ACTOR, undefined, {
      profileId: profile._id,
      tierId: tier._id,
      creditEnabled: args.creditEnabled,
      ...(args.creditLimitPara !== undefined ? { creditLimitPara: args.creditLimitPara } : {}),
    });
    await ctx.db.patch("users", user._id, { isTest: true });
    return { profileId: profile._id, tierName: tier.name };
  },
});

export const mechanicProbe = internalQuery({
  args: { email: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      status: v.string(),
      companyName: v.string(),
      pib: v.string(),
      creditEnabled: v.boolean(),
      eventTypes: v.array(v.string()),
    }),
  ),
  handler: async (ctx, { email }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email.trim().toLowerCase()))
      .first();
    if (!user) return null;
    const profile = await ctx.db
      .query("mechanicProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first();
    if (!profile) return null;
    const events = await ctx.db
      .query("domainEvents")
      .withIndex("by_aggregateType_and_aggregateId", (q) =>
        q.eq("aggregateType", "mechanic").eq("aggregateId", profile._id),
      )
      .take(20);
    return {
      status: profile.status,
      companyName: profile.companyName,
      pib: profile.pib,
      creditEnabled: profile.creditEnabled,
      eventTypes: events.map((e) => e.type),
    };
  },
});

/**
 * Quick-order fixtures from the seeded catalogue: an OEM code that matches exactly one
 * listed, in-stock product, and a code shared by several listed products (ambiguous).
 */
export const quickOrderSamples = internalQuery({
  args: {},
  returns: v.object({
    exact: v.union(v.null(), v.object({ code: v.string(), slug: v.string(), name: v.string() })),
    ambiguous: v.union(v.null(), v.object({ code: v.string(), count: v.number() })),
  }),
  handler: async (ctx) => {
    const rows = await ctx.db.query("productCodes").withIndex("by_code").take(4_000);
    const byCode = new Map<string, { raw: string; kind: string; productIds: Set<string> }>();
    for (const r of rows) {
      if (!r.active) continue;
      const entry = byCode.get(r.code) ?? { raw: r.raw, kind: r.kind, productIds: new Set() };
      entry.productIds.add(r.productId);
      byCode.set(r.code, entry);
    }
    let exact: { code: string; slug: string; name: string } | null = null;
    let ambiguous: { code: string; count: number } | null = null;
    for (const [code, entry] of byCode) {
      if (!exact && entry.kind === "oem" && entry.productIds.size === 1) {
        const p = await ctx.db.get("products", [...entry.productIds][0] as Doc<"products">["_id"]);
        if (
          p &&
          p.active &&
          p.deletedAt === undefined &&
          p.stockQty >= 5 &&
          isAvailableNow(p.stockState)
        ) {
          exact = { code: entry.raw || code, slug: p.slug, name: p.name };
        }
      }
      if (!ambiguous && entry.productIds.size >= 2) {
        let listed = 0;
        for (const id of entry.productIds) {
          const p = await ctx.db.get("products", id as Doc<"products">["_id"]);
          if (p && p.active && p.deletedAt === undefined) listed++;
        }
        if (listed >= 2) ambiguous = { code: entry.raw || code, count: listed };
      }
      if (exact && ambiguous) break;
    }
    return { exact, ambiguous };
  },
});

/**
 * E2E helpers (step 15, internal): a fresh guest order (`nova`, courier + pouzeće), a VIN
 * inquiry (`nov`) and a pending mechanic registration, created through the same library
 * code as the storefront so the admin spec starts from real documents. All flagged `isTest`.
 */
export const createTestOrder = internalMutation({
  args: { tag: v.string() },
  returns: v.object({ number: v.string() }),
  handler: async (ctx, { tag }) => {
    assertTestDeployment();
    const settings = await getSettings(ctx);
    const products = await ctx.db
      .query("products")
      .withIndex("by_stockState_and_active", (q) =>
        q.eq("stockState", "in_stock").eq("active", true),
      )
      .take(20);
    const product = products.find((p) => p.stockQty >= 3);
    if (!product) throw new Error("No in-stock product");
    const checkout = validateCheckout(
      {
        contact: {
          firstName: "Admin",
          lastName: `Test ${tag}`,
          email: `admin-e2e-${tag}@primer.rs`,
          phone: "064 333 4455",
        },
        delivery: {
          method: "courier",
          address: { street: "Test ulica 5", city: "Beograd", postalCode: "11000" },
        },
        payment: { method: "cod" },
        consent: {
          termsVersion: settings.legalVersions.terms,
          privacyVersion: settings.legalVersions.privacy,
          acceptedAt: Date.now(),
          marketingEmail: false,
          analytics: false,
          ads: false,
        },
      },
      settings,
      null,
    );
    const order = await createOrder(ctx, {
      checkout,
      lines: [
        {
          productId: product._id,
          categoryId: product.categoryId,
          sku: product.sku,
          name: product.name,
          manufacturerName: product.manufacturerName,
          quality: product.quality,
          ...(product.oemPrimary ? { oem: product.oemPrimary } : {}),
          quantity: 1,
          unitRetailPara: product.retailPricePara,
          unitPricePara: product.retailPricePara,
          discountBp: 0,
          availabilityAtOrder: product.stockState,
          isCustomLine: false,
        },
      ],
      customerType: "guest",
      source: "web",
      isDemo: false,
      isTest: true,
      actor: { type: "customer", name: `Admin Test ${tag}` },
    });
    return { number: order.number };
  },
});

export const createTestInquiry = internalMutation({
  args: { tag: v.string() },
  returns: v.object({ number: v.string() }),
  handler: async (ctx, { tag }) => {
    assertTestDeployment();
    const settings = await getSettings(ctx);
    const { number, inquiryId } = await insertInquiry(ctx, {
      kind: "part",
      message: `Treba mi set kvačila za Golf 7 2.0 TDI (test ${tag}).`,
      categorySlugs: [],
      requestedCodes: [],
      photos: [],
      contact: { name: `Upit Test ${tag}`, phone: "+381643334455", preferredChannel: "phone" },
      consent: {
        termsVersion: settings.legalVersions.terms,
        privacyVersion: settings.legalVersions.privacy,
        acceptedAt: Date.now(),
        marketingEmail: false,
        analytics: false,
        ads: false,
      },
      actor: { type: "customer", name: `Upit Test ${tag}` },
    });
    await ctx.db.patch("inquiries", inquiryId, { isTest: true });
    return { number };
  },
});

export const createPendingMechanic = internalMutation({
  args: { tag: v.string(), pib: v.string(), mb: v.string() },
  returns: v.object({ profileId: v.id("mechanicProfiles"), companyName: v.string() }),
  handler: async (ctx, { tag, pib, mb }) => {
    assertTestDeployment();
    const email = `majstor-admin-${tag}@primer.rs`;
    const companyName = `Servis Admin ${tag}`;
    const userId = await ctx.db.insert("users", {
      email,
      name: `Majstor ${tag}`,
      role: "customer",
      status: "active",
      isTest: true,
    });
    const settings = await getSettings(ctx);
    const profileId = await ctx.db.insert("mechanicProfiles", {
      userId,
      status: "pending",
      companyName,
      pib,
      mb,
      contactPerson: `Majstor ${tag}`,
      phone: "+381643334456",
      email,
      city: "Novi Sad",
      address: "Radionička 1",
      serviceTypes: ["mehanika"],
      brandsServiced: [],
      creditEnabled: false,
      paymentTermsDays: 15,
      consent: {
        termsVersion: settings.legalVersions.terms,
        privacyVersion: settings.legalVersions.privacy,
        acceptedAt: Date.now(),
        marketingEmail: false,
        analytics: false,
        ads: false,
      },
      isDemo: false,
      updatedAt: Date.now(),
    });
    await ctx.db.patch("users", userId, {
      mechanicStatus: "pending",
      mechanicProfileId: profileId,
    });
    return { profileId, companyName };
  },
});

/** E2E probe: status, tier and credit of a mechanic profile. */
export const mechanicProfileProbe = internalQuery({
  args: { profileId: v.id("mechanicProfiles") },
  returns: v.union(
    v.null(),
    v.object({ status: v.string(), tierName: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx, { profileId }) => {
    const p = await ctx.db.get("mechanicProfiles", profileId);
    if (!p) return null;
    const tier = p.tierId ? await ctx.db.get("priceTiers", p.tierId) : null;
    return { status: p.status, tierName: tier?.name ?? null };
  },
});

/** E2E probe: the latest quote of an inquiry and settings values the admin spec edits. */
export const adminProbe = internalQuery({
  args: { inquiryNumber: v.optional(v.string()) },
  returns: v.object({
    inquiryStatus: v.union(v.string(), v.null()),
    quoteStatus: v.union(v.string(), v.null()),
    quoteTotalPara: v.union(v.number(), v.null()),
    legalName: v.string(),
  }),
  handler: async (ctx, { inquiryNumber }) => {
    const settings = await getSettings(ctx);
    const inquiry = inquiryNumber
      ? await ctx.db
          .query("inquiries")
          .withIndex("by_number", (q) => q.eq("number", inquiryNumber))
          .unique()
      : null;
    const quote = inquiry
      ? await ctx.db
          .query("quotes")
          .withIndex("by_inquiryId_and_version", (q) => q.eq("inquiryId", inquiry._id))
          .order("desc")
          .first()
      : null;
    return {
      inquiryStatus: inquiry?.status ?? null,
      quoteStatus: quote?.status ?? null,
      quoteTotalPara: quote?.totalPara ?? null,
      legalName: settings.company.legalName,
    };
  },
});

/** E2E cleanup (step 15): deactivates products created by the admin spec (SKU `E2E-…`). */
export const deactivateE2EProducts = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    assertTestDeployment();
    const rows = await ctx.db
      .query("products")
      .withIndex("by_active_and_contentUpdatedAt", (q) => q.eq("active", true))
      .order("desc")
      .take(200);
    let count = 0;
    for (const p of rows) {
      if (!p.sku.startsWith("E2E-")) continue;
      await updateProduct(ctx, p._id, { active: false }, { actor: SYSTEM_ACTOR, emit: true });
      count++;
    }
    return count;
  },
});

/**
 * E2E cleanup (step 16): removes products created by the import fixtures (SKU `IMP-T-…`,
 * `IMP-C-…`) that a failed run left behind, and cancels their unfinished batches.
 */
export const purgeImportFixtures = internalMutation({
  args: {},
  returns: v.object({ products: v.number(), batches: v.number() }),
  handler: async (ctx) => {
    assertTestDeployment();
    const rows = await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.gte("sku", "IMP-").lt("sku", "IMP."))
      .take(40); // ~60 reads per hard delete; the caller repeats until 0
    let products = 0;
    for (const p of rows) {
      if (!p.sku.startsWith("IMP-T-") && !p.sku.startsWith("IMP-C-")) continue;
      await deleteProductHard(ctx, p._id);
      products++;
    }
    let batches = 0;
    for (const status of ["staging", "validated"] as const) {
      for (const b of await ctx.db
        .query("importBatches")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(100)) {
        if (!/^proizvodi-(500|1250)\./.test(b.fileName)) continue;
        await ctx.db.patch("importBatches", b._id, { status: "cancelled" });
        batches++;
      }
    }
    return { products, batches };
  },
});

/** E2E probe (step 16): a product by SKU — existence, active flag, price, stock, source. */
export const productBySku = internalQuery({
  args: { sku: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      name: v.string(),
      active: v.boolean(),
      retailPricePara: v.number(),
      stockQty: v.number(),
      source: v.string(),
    }),
  ),
  handler: async (ctx, { sku }) => {
    const p = await ctx.db
      .query("products")
      .withIndex("by_sku", (q) => q.eq("sku", sku))
      .first();
    return p
      ? {
          name: p.name,
          active: p.active,
          retailPricePara: p.retailPricePara,
          stockQty: p.stockQty,
          source: p.source,
        }
      : null;
  },
});

/** E2E probe (step 18): e-mails logged for an order (customer + staff), newest first. */
export const emailProbe = internalQuery({
  args: { number: v.string() },
  returns: v.array(
    v.object({
      templateKey: v.string(),
      to: v.array(v.string()),
      mode: v.string(),
      status: v.string(),
      subject: v.string(),
    }),
  ),
  handler: async (ctx, { number }) => {
    const order = await ctx.db
      .query("orders")
      .withIndex("by_number", (q) => q.eq("number", number))
      .unique();
    if (!order) return [];
    const rows = await ctx.db
      .query("emailLog")
      .withIndex("by_relatedType_and_relatedId", (q) =>
        q.eq("relatedType", "order").eq("relatedId", order._id),
      )
      .order("desc")
      .take(50);
    return rows.map((r) => ({
      templateKey: r.templateKey,
      to: r.originalTo ?? r.to,
      mode: r.mode,
      status: r.status,
      subject: r.subject,
    }));
  },
});

/** QA only: the status-page token of an order (derived, lib/linkTokens). */
export const orderStatusToken = internalQuery({
  args: { number: v.string() },
  returns: v.string(),
  handler: async (_ctx, { number }) => {
    assertTestDeployment();
    return await statusLinkToken("order", number);
  },
});

/**
 * Step 19 e2e: sets the browser tag ids (GA4, Google Ads, Meta Pixel) and returns the previous
 * tracking section so the spec can restore it. Internal only.
 */
export const setTracking = internalMutation({
  args: {
    ga4Id: v.optional(v.string()),
    gadsId: v.optional(v.string()),
    metaPixelId: v.optional(v.string()),
    restore: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    assertTestDeployment();
    const doc = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "global"))
      .unique();
    if (!doc) return "{}";
    const previous = JSON.stringify(doc.tracking);
    const tracking = args.restore
      ? (JSON.parse(args.restore) as Doc<"settings">["tracking"])
      : {
          ...doc.tracking,
          ga4Id: args.ga4Id,
          gadsId: args.gadsId,
          metaPixelId: args.metaPixelId,
          gadsLabels: { ...doc.tracking.gadsLabels, purchase: args.gadsId ? "e2ePurchase" : undefined },
        };
    await ctx.db.patch("settings", doc._id, { tracking });
    return previous;
  },
});

export const consentRecordCount = internalQuery({
  args: { consentId: v.string() },
  returns: v.number(),
  handler: async (ctx, { consentId }) =>
    (
      await ctx.db
        .query("consentRecords")
        .withIndex("by_consentId", (q) => q.eq("consentId", consentId))
        .take(50)
    ).length,
});
