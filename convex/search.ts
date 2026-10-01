/**
 * OEM-aware search (docs/ARCHITECTURE.md §E9): exact codes first, then prefix/cross hits,
 * then folded full-text hits; zero results are logged for „Traženo, a nemamo“.
 */
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  classifyQuery,
  foldForSearch,
  parseVehicleTerms,
  partTerms,
  SEARCH_QUERY_MAX,
  termMatchesText,
} from "../lib/domain/search";
import { belgradeDay } from "../lib/domain/time";
import {
  categoryBySlug,
  categorySummaryV,
  isListed,
  leafCategoryIds,
  productCardV,
  type ProductCard,
  showRetail,
  toCard,
  toCategorySummary,
} from "./lib/catalog";
import { lookupCodes } from "./catalog/codes";
import { publicMutation, publicQuery, staffQuery } from "./lib/functions";
import { tryRateLimit } from "./lib/rateLimits";
import { recordSearch, searchUserType } from "./lib/searchLog";
import { getSettings } from "./lib/settings";

const TEXT_LIMIT = 48;
const CODE_LIMIT = 50;
/** Full-text candidates read before ranking and the vehicle filter. */
const TEXT_POOL = 96;
/** Fitment rows read per (vehicle, category) when checking fit. */
const FIT_SCAN = 600;
/** Categories whose name matches the part terms that feed candidates directly. */
const CATEGORY_HITS = 4;

const matchV = v.union(
  v.literal("exact_code"),
  v.literal("cross_code"),
  v.literal("prefix_code"),
  v.literal("text"),
);

type VehicleTarget = {
  brand: Doc<"vehicleBrands">;
  model: Doc<"vehicleModels"> | null;
  generation: Doc<"vehicleGenerations"> | null;
};

type VehicleIndex = {
  brand: Doc<"vehicleBrands">;
  models: { model: Doc<"vehicleModels">; generations: Doc<"vehicleGenerations">[] }[];
}[];

/** Active brands → models → generations (reference data, ~120 rows). */
async function loadVehicleIndex(ctx: QueryCtx): Promise<VehicleIndex> {
  const out: VehicleIndex = [];
  const brands = await ctx.db.query("vehicleBrands").withIndex("by_sortOrder").take(50);
  for (const brand of brands) {
    if (!brand.active) continue;
    const models = [];
    for (const model of await ctx.db
      .query("vehicleModels")
      .withIndex("by_brandId_and_sortOrder", (q) => q.eq("brandId", brand._id))
      .take(200)) {
      if (!model.active) continue;
      const generations = (
        await ctx.db
          .query("vehicleGenerations")
          .withIndex("by_modelId_and_yearFrom", (q) => q.eq("modelId", model._id))
          .take(50)
      ).filter((g) => g.active);
      models.push({ model, generations });
    }
    out.push({ brand, models });
  }
  return out;
}

function findVehicle(
  index: VehicleIndex,
  brandSlug: string,
  modelSlug: string | null,
  generationSlug: string | null,
): VehicleTarget | null {
  const node = index.find((n) => n.brand.slug === brandSlug);
  if (!node) return null;
  const m = modelSlug ? node.models.find((x) => x.model.slug === modelSlug) : undefined;
  if (!m) return { brand: node.brand, model: null, generation: null };
  const generation = generationSlug
    ? (m.generations.find((g) => g.slug === generationSlug) ?? null)
    : null;
  return { brand: node.brand, model: m.model, generation };
}

const BRAND_SHORT: Readonly<Record<string, string>> = { volkswagen: "VW" };

function vehicleLabel(t: VehicleTarget): string {
  if (t.generation) return t.generation.name;
  const brand = BRAND_SHORT[t.brand.slug] ?? t.brand.name;
  return t.model ? `${brand} ${t.model.name}` : t.brand.name;
}

function vehicleParam(t: VehicleTarget): string {
  return [t.brand.slug, t.model?.slug, t.generation?.slug].filter(Boolean).join("/");
}

/** Fitment rows of the vehicle (at its most specific level), optionally in one category. */
function fitmentsOf(ctx: QueryCtx, t: VehicleTarget, categoryId?: Id<"categories">) {
  if (t.generation) {
    const id = t.generation._id;
    return ctx.db
      .query("fitments")
      .withIndex("by_generationId_and_categoryId_and_active", (q) =>
        categoryId
          ? q.eq("generationId", id).eq("categoryId", categoryId).eq("active", true)
          : q.eq("generationId", id),
      );
  }
  if (t.model) {
    const id = t.model._id;
    return ctx.db
      .query("fitments")
      .withIndex("by_modelId_and_categoryId_and_active", (q) =>
        categoryId
          ? q.eq("modelId", id).eq("categoryId", categoryId).eq("active", true)
          : q.eq("modelId", id),
      );
  }
  const id = t.brand._id;
  return ctx.db
    .query("fitments")
    .withIndex("by_brandId_and_categoryId_and_active", (q) =>
      categoryId
        ? q.eq("brandId", id).eq("categoryId", categoryId).eq("active", true)
        : q.eq("brandId", id),
    );
}

export const run = publicQuery({
  args: {
    q: v.string(),
    categoryId: v.optional(v.id("categories")),
    /** Category chip on the results page (`kategorija`). */
    categorySlug: v.optional(v.string()),
    /** The visitor's selected vehicle as `brand/model/generation` slugs (`vozilo`). */
    vehicle: v.optional(v.string()),
    /** „Prikaži sve“: no vehicle filter, neither from the query nor from the selection. */
    allVehicles: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    query: v.string(),
    kind: v.union(v.literal("code"), v.literal("text"), v.literal("mixed")),
    exactCodeHit: v.boolean(),
    results: v.array(
      v.object({
        card: productCardV,
        match: matchV,
        matchedCode: v.union(v.string(), v.null()),
      }),
    ),
    /** More matches exist than were returned (the page asks to narrow the search). */
    hasMore: v.boolean(),
    /** The vehicle the results are narrowed to (named in the query or selected). */
    vehicle: v.union(
      v.null(),
      v.object({
        label: v.string(),
        param: v.string(),
        source: v.union(v.literal("query"), v.literal("selected")),
        /** False when „prikaži sve“ is on or nothing found fits the vehicle. */
        applied: v.boolean(),
        /** Matches hidden because they do not fit (0 when not applied). */
        hidden: v.number(),
      }),
    ),
    /** Narrowing chips: categories of the matches, most frequent first. */
    categories: v.array(v.object({ slug: v.string(), name: v.string(), count: v.number() })),
    /** The active category chip, if any. */
    category: v.union(v.null(), v.object({ slug: v.string(), name: v.string() })),
  }),
  handler: async (ctx, args) => {
    const raw = args.q.slice(0, SEARCH_QUERY_MAX).trim();
    const classified = classifyQuery(raw);
    const limit = Math.min(TEXT_LIMIT, Math.max(1, Math.floor(args.limit ?? TEXT_LIMIT)));
    const settings = await getSettings(ctx);
    const retailVisible = showRetail(settings, ctx.viewer);
    const scope = args.categorySlug ? await categoryBySlug(ctx, args.categorySlug) : null;
    const activeScope = scope && scope.active ? scope : null;
    const scopeIds = activeScope ? new Set(await leafCategoryIds(ctx, activeScope)) : null;
    if (activeScope) scopeIds?.add(activeScope._id);
    const inScope = (p: Doc<"products">) =>
      (!args.categoryId || p.categoryId === args.categoryId) &&
      (!scopeIds || scopeIds.has(p.categoryId));

    const hits = new Map<
      Id<"products">,
      { match: "exact_code" | "cross_code" | "prefix_code"; code: string | null }
    >();
    for (const code of classified.codes.slice(0, 10)) {
      const exact = await lookupCodes(ctx, code, "exact", CODE_LIMIT);
      for (const row of exact) {
        if (hits.has(row.productId)) continue;
        const match = row.kind === "cross" ? "cross_code" : "exact_code";
        hits.set(row.productId, { match, code: row.raw });
      }
      if (exact.length === 0) {
        for (const row of await lookupCodes(ctx, code, "prefix", CODE_LIMIT)) {
          if (!hits.has(row.productId))
            hits.set(row.productId, { match: "prefix_code", code: row.raw });
        }
      }
    }
    const exactCodeHit = [...hits.values()].some(
      (h) => h.match === "exact_code" || h.match === "cross_code",
    );

    // Text part: a vehicle named in the query is a fitment filter, not free text (D230).
    const textSource =
      classified.kind === "code"
        ? hits.size === 0
          ? classified.folded
          : ""
        : classified.text || classified.folded;
    const tokens = textSource.split(" ").filter(Boolean);
    const vehicles = tokens.length > 0 || args.vehicle ? await loadVehicleIndex(ctx) : [];
    const parsed = parseVehicleTerms(tokens, vehicles);
    let target: VehicleTarget | null = null;
    let source: "query" | "selected" = "query";
    if (parsed.match) {
      const m = parsed.match;
      target = findVehicle(vehicles, m.brandSlug, m.modelSlug, m.generationSlug);
    } else if (args.vehicle) {
      const [b, m, g] = args.vehicle.split("/");
      target = b ? findVehicle(vehicles, b, m || null, g || null) : null;
      source = "selected";
    }
    const filterByVehicle = target !== null && !args.allVehicles;
    const terms = partTerms(parsed.rest);
    // Only a vehicle with „prikaži sve“: fall back to the vehicle labels in `searchText`.
    const indexText =
      terms.length > 0 ? terms.join(" ") : target && args.allVehicles ? tokens.join(" ") : "";

    // Categories whose name carries every part term („pločice“ → Kočione pločice).
    const matchedCategories: Doc<"categories">[] = [];
    if (terms.length > 0) {
      for (const kind of ["category", "subcategory"] as const) {
        for (const c of await ctx.db
          .query("categories")
          .withIndex("by_kind_and_sortOrder", (q) => q.eq("kind", kind))
          .take(200)) {
          const name = foldForSearch(c.name);
          if (c.active && terms.every((t) => termMatchesText(t, name))) matchedCategories.push(c);
        }
      }
    }
    const categoryHitIds = new Set<Id<"categories">>();
    for (const c of matchedCategories.slice(0, CATEGORY_HITS)) {
      categoryHitIds.add(c._id);
      for (const id of await leafCategoryIds(ctx, c)) categoryHitIds.add(id);
    }

    // Candidates in source order: full-text relevance, then the matching categories.
    const candidates: Id<"products">[] = [];
    const seen = new Set<Id<"products">>(hits.keys());
    const push = (id: Id<"products">) => {
      if (seen.has(id)) return;
      seen.add(id);
      candidates.push(id);
    };
    let capped = false;
    if (indexText) {
      const rows = await ctx.db
        .query("products")
        .withSearchIndex("search_products", (q) => {
          const base = q.search("searchText", indexText).eq("active", true);
          return args.categoryId ? base.eq("categoryId", args.categoryId) : base;
        })
        .take(TEXT_POOL);
      capped ||= rows.length === TEXT_POOL;
      for (const p of rows) push(p._id);
    }
    for (const categoryId of categoryHitIds) {
      if (filterByVehicle && target) {
        const rows = await fitmentsOf(ctx, target, categoryId).take(limit + 1);
        capped ||= rows.length > limit;
        for (const f of rows) push(f.productId);
        const universal = await ctx.db
          .query("products")
          .withIndex("by_categoryId_and_universal_and_active", (q) =>
            q.eq("categoryId", categoryId).eq("universal", true).eq("active", true),
          )
          .take(limit + 1);
        for (const p of universal) push(p._id);
      } else {
        const rows = await ctx.db
          .query("products")
          .withIndex("by_categoryId_and_active_and_popularity", (q) =>
            q.eq("categoryId", categoryId).eq("active", true),
          )
          .order("desc")
          .take(limit + 1);
        capped ||= rows.length > limit;
        for (const p of rows) push(p._id);
      }
    }
    if (terms.length === 0 && filterByVehicle && target) {
      // Only a vehicle („golf 7“): what fits it; the chips narrow by category.
      const rows = await fitmentsOf(ctx, target).take(TEXT_POOL * 3);
      capped ||= rows.length === TEXT_POOL * 3;
      for (const f of rows) push(f.productId);
    }

    // Fit check: one bounded fitment scan per (vehicle, category), universal parts always fit.
    const fitSets = new Map<Id<"categories">, Set<Id<"products">>>();
    const fits = async (p: Doc<"products">) => {
      if (!target || p.universal) return true;
      let set = fitSets.get(p.categoryId);
      if (!set) {
        const rows = await fitmentsOf(ctx, target, p.categoryId).take(FIT_SCAN);
        set = new Set(rows.map((f) => f.productId));
        fitSets.set(p.categoryId, set);
      }
      return set.has(p._id);
    };

    // Rank: category hit, then every part term in the name, then some (stable within a tier).
    const ranked: { p: Doc<"products">; score: number; fit: boolean }[] = [];
    for (const id of candidates) {
      const p = await ctx.db.get("products", id);
      if (!p || !isListed(p) || !inScope(p)) continue;
      const name = foldForSearch(p.name);
      const inName = terms.filter((t) => termMatchesText(t, name)).length;
      const score =
        (categoryHitIds.has(p.categoryId) ? 4 : 0) +
        (inName > 0 && inName === terms.length ? 2 : inName > 0 ? 1 : 0);
      ranked.push({ p, score, fit: filterByVehicle ? await fits(p) : true });
    }
    // Only a vehicle: no relevance order to keep, the most popular parts lead.
    ranked.sort(
      (a, b) => b.score - a.score || (terms.length === 0 ? b.p.popularity - a.p.popularity : 0),
    );
    const fitting = ranked.filter((r) => r.fit);
    const applied = filterByVehicle && fitting.length > 0;
    const listed = applied ? fitting : ranked;

    const order: Record<string, number> = { exact_code: 0, cross_code: 1, prefix_code: 2 };
    const results: {
      card: ProductCard;
      match: "exact_code" | "cross_code" | "prefix_code" | "text";
      matchedCode: string | null;
    }[] = [];
    for (const [productId, hit] of [...hits.entries()].sort(
      (a, b) => order[a[1].match] - order[b[1].match],
    )) {
      if (results.length >= limit) break;
      const p = await ctx.db.get("products", productId);
      if (!p || !isListed(p) || !inScope(p)) continue;
      results.push({
        card: await toCard(ctx, p, retailVisible),
        match: hit.match,
        matchedCode: hit.code,
      });
    }
    const room = Math.max(0, limit - results.length);
    for (const { p } of listed.slice(0, room))
      results.push({ card: await toCard(ctx, p, retailVisible), match: "text", matchedCode: null });
    const hasMore = listed.length > room || (capped && results.length >= limit);

    const counts = new Map<Id<"categories">, number>();
    for (const { p } of listed) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    const categories = [];
    if (!activeScope) {
      for (const [categoryId, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
        if (categories.length >= 8) break;
        const c = await ctx.db.get("categories", categoryId);
        if (c && c.active) categories.push({ slug: c.slug, name: c.name, count });
      }
    }

    return {
      query: raw,
      kind: classified.kind,
      exactCodeHit,
      results,
      hasMore,
      vehicle: target
        ? {
            label: vehicleLabel(target),
            param: vehicleParam(target),
            source,
            applied,
            hidden: applied ? ranked.length - fitting.length : 0,
          }
        : null,
      categories,
      category: activeScope ? { slug: activeScope.slug, name: activeScope.name } : null,
    };
  },
});

export const suggest = publicQuery({
  args: { q: v.string() },
  returns: v.object({
    codes: v.array(
      v.object({
        productId: v.id("products"),
        slug: v.string(),
        name: v.string(),
        code: v.string(),
        manufacturerName: v.string(),
      }),
    ),
    categories: v.array(categorySummaryV),
    products: v.array(
      v.object({
        productId: v.id("products"),
        slug: v.string(),
        name: v.string(),
        manufacturerName: v.string(),
      }),
    ),
  }),
  handler: async (ctx, { q }) => {
    const query = q.slice(0, SEARCH_QUERY_MAX).trim();
    const empty = { codes: [], categories: [], products: [] };
    if (query.length < 2) return empty;
    const classified = classifyQuery(query);

    const codes = [];
    const seen = new Set<Id<"products">>();
    for (const code of classified.codes.slice(0, 3)) {
      for (const row of await lookupCodes(ctx, code, "prefix", 5)) {
        if (seen.has(row.productId) || codes.length >= 5) continue;
        const p = await ctx.db.get("products", row.productId);
        if (!p || !isListed(p)) continue;
        seen.add(p._id);
        codes.push({
          productId: p._id,
          slug: p.slug,
          name: p.name,
          code: row.raw,
          manufacturerName: p.manufacturerName,
        });
      }
    }

    const folded = foldForSearch(query);
    const categories: Doc<"categories">[] = [];
    if (folded.length >= 3) {
      for (const kind of ["category", "subcategory"] as const) {
        const rows = await ctx.db
          .query("categories")
          .withIndex("by_kind_and_sortOrder", (q2) => q2.eq("kind", kind))
          .take(100);
        for (const c of rows) {
          if (categories.length >= 3 || !c.active) continue;
          const name = foldForSearch(c.name);
          if (folded.split(" ").every((t) => name.includes(t) || c.slug.includes(t)))
            categories.push(c);
        }
      }
    }

    const products = [];
    if (classified.kind !== "code" || codes.length === 0) {
      const text = classified.text || folded;
      if (text) {
        const rows = await ctx.db
          .query("products")
          .withSearchIndex("search_products", (s) =>
            s.search("searchText", text).eq("active", true),
          )
          .take(10);
        for (const p of rows) {
          if (products.length >= 6 || seen.has(p._id) || !isListed(p)) continue;
          products.push({
            productId: p._id,
            slug: p.slug,
            name: p.name,
            manufacturerName: p.manufacturerName,
          });
        }
      }
    }
    return { codes, categories: categories.map(toCategorySummary), products };
  },
});

/** Called by the results page on mount; silently dropped when rate-limited. */
export const log = publicMutation({
  args: {
    query: v.string(),
    resultsCount: v.number(),
    exactCodeHit: v.boolean(),
    source: v.union(
      v.literal("header"),
      v.literal("search_page"),
      v.literal("quick_order"),
      v.literal("three_d"),
      v.literal("landing"),
    ),
    generationId: v.optional(v.id("vehicleGenerations")),
    sessionHash: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.query.trim()) return null;
    if (!(await tryRateLimit(ctx, "searchLog", ctx.client.key))) return null;
    await recordSearch(ctx, {
      query: args.query,
      resultsCount: args.resultsCount,
      exactCodeHit: args.exactCodeHit,
      source: args.source,
      userType: searchUserType(ctx.viewer),
      ...(args.generationId ? { generationId: args.generationId } : {}),
      ...(args.sessionHash ? { sessionHash: args.sessionHash } : {}),
    });
    return null;
  },
});

/** Staff: most frequent zero-result searches of the last `days` days. */
export const zeroResults = staffQuery({
  args: { days: v.number(), nowMs: v.number() },
  returns: v.array(
    v.object({
      normalized: v.string(),
      sample: v.string(),
      count: v.number(),
      zeroCount: v.number(),
      lastAt: v.number(),
    }),
  ),
  handler: async (ctx, { days, nowMs }) => {
    const span = Math.min(90, Math.max(1, Math.floor(days)));
    const totals = new Map<
      string,
      { normalized: string; sample: string; count: number; zeroCount: number; lastAt: number }
    >();
    for (let i = 0; i < span; i++) {
      const day = belgradeDay(nowMs - i * 86_400_000);
      const rows = await ctx.db
        .query("searchDaily")
        .withIndex("by_day_and_normalized", (q) => q.eq("day", day))
        .take(500);
      for (const r of rows) {
        if (r.zeroCount === 0) continue;
        const t = totals.get(r.normalized) ?? {
          normalized: r.normalized,
          sample: r.sample,
          count: 0,
          zeroCount: 0,
          lastAt: 0,
        };
        t.count += r.count;
        t.zeroCount += r.zeroCount;
        t.lastAt = Math.max(t.lastAt, r.lastAt);
        totals.set(r.normalized, t);
      }
    }
    return [...totals.values()].sort((a, b) => b.zeroCount - a.zeroCount).slice(0, 50);
  },
});

/** Resolves a category slug to its id for search scoping (header search inside a category). */
export const categoryScope = publicQuery({
  args: { slug: v.string() },
  returns: v.union(v.null(), categorySummaryV),
  handler: async (ctx, { slug }) => {
    const c = await categoryBySlug(ctx, slug);
    return c && c.active ? toCategorySummary(c) : null;
  },
});

/**
 * Staff search analytics (`/admin/pretrage`): totals per day, top queries and top misses for
 * the last `days` days (≤ 400 `searchDaily` rows per day), plus the 30 latest misses with
 * their source.
 */
export const analytics = staffQuery({
  args: { days: v.number(), nowMs: v.number() },
  returns: v.object({
    perDay: v.array(v.object({ day: v.string(), searches: v.number(), zero: v.number() })),
    top: v.array(
      v.object({
        normalized: v.string(),
        sample: v.string(),
        count: v.number(),
        zeroCount: v.number(),
        lastAt: v.number(),
      }),
    ),
    misses: v.array(
      v.object({
        normalized: v.string(),
        sample: v.string(),
        count: v.number(),
        zeroCount: v.number(),
        lastAt: v.number(),
      }),
    ),
    recentMisses: v.array(
      v.object({ query: v.string(), source: v.string(), userType: v.string(), at: v.number() }),
    ),
  }),
  handler: async (ctx, { days, nowMs }) => {
    const span = Math.min(90, Math.max(1, Math.floor(days)));
    type Row = {
      normalized: string;
      sample: string;
      count: number;
      zeroCount: number;
      lastAt: number;
    };
    const totals = new Map<string, Row>();
    const perDay = [];
    for (let i = span - 1; i >= 0; i--) {
      const day = belgradeDay(nowMs - i * 86_400_000);
      const rows = await ctx.db
        .query("searchDaily")
        .withIndex("by_day_and_normalized", (q) => q.eq("day", day))
        .take(400);
      let searches = 0;
      let zero = 0;
      for (const r of rows) {
        searches += r.count;
        zero += r.zeroCount;
        const t = totals.get(r.normalized) ?? {
          normalized: r.normalized,
          sample: r.sample,
          count: 0,
          zeroCount: 0,
          lastAt: 0,
        };
        t.count += r.count;
        t.zeroCount += r.zeroCount;
        t.lastAt = Math.max(t.lastAt, r.lastAt);
        totals.set(r.normalized, t);
      }
      perDay.push({ day, searches, zero });
    }
    const all = [...totals.values()];
    const recent = await ctx.db.query("searchLogs").withIndex("by_at").order("desc").take(300);
    return {
      perDay,
      top: [...all].sort((a, b) => b.count - a.count).slice(0, 30),
      misses: all
        .filter((r) => r.zeroCount > 0)
        .sort((a, b) => b.zeroCount - a.zeroCount || b.lastAt - a.lastAt)
        .slice(0, 30),
      recentMisses: recent
        .filter((r) => r.resultsCount === 0)
        .slice(0, 30)
        .map((r) => ({ query: r.query, source: r.source, userType: r.userType, at: r.at })),
    };
  },
});
