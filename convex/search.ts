/**
 * OEM-aware search (docs/ARCHITECTURE.md §E9): exact codes first, then prefix/cross hits,
 * then folded full-text hits; zero results are logged for „Traženo, a nemamo“.
 */
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { classifyQuery, foldForSearch, SEARCH_QUERY_MAX } from "../lib/domain/search";
import { belgradeDay } from "../lib/domain/time";
import {
  categoryBySlug,
  categorySummaryV,
  isListed,
  productCardV,
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

const matchV = v.union(
  v.literal("exact_code"),
  v.literal("cross_code"),
  v.literal("prefix_code"),
  v.literal("text"),
);

export const run = publicQuery({
  args: {
    q: v.string(),
    categoryId: v.optional(v.id("categories")),
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
  }),
  handler: async (ctx, args) => {
    const raw = args.q.slice(0, SEARCH_QUERY_MAX).trim();
    const classified = classifyQuery(raw);
    const limit = Math.min(TEXT_LIMIT, Math.max(1, Math.floor(args.limit ?? TEXT_LIMIT)));
    const settings = await getSettings(ctx);
    const retailVisible = showRetail(settings, ctx.viewer);
    const hits = new Map<
      Id<"products">,
      { match: "exact_code" | "cross_code" | "prefix_code" | "text"; code: string | null }
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

    const text =
      classified.kind === "code"
        ? hits.size === 0
          ? classified.folded
          : ""
        : classified.text || classified.folded;
    if (text.trim()) {
      const textHits = await ctx.db
        .query("products")
        .withSearchIndex("search_products", (q) => {
          const base = q.search("searchText", text).eq("active", true);
          return args.categoryId ? base.eq("categoryId", args.categoryId) : base;
        })
        .take(limit);
      for (const p of textHits)
        if (!hits.has(p._id)) hits.set(p._id, { match: "text", code: null });
    }

    const order: Record<string, number> = { exact_code: 0, cross_code: 1, prefix_code: 2, text: 3 };
    const results = [];
    for (const [productId, hit] of [...hits.entries()].sort(
      (a, b) => order[a[1].match] - order[b[1].match],
    )) {
      if (results.length >= limit) break;
      const p = await ctx.db.get("products", productId);
      if (!p || !isListed(p)) continue;
      if (args.categoryId && p.categoryId !== args.categoryId) continue;
      results.push({
        card: await toCard(ctx, p, retailVisible),
        match: hit.match,
        matchedCode: hit.code,
      });
    }
    return { query: raw, kind: classified.kind, exactCodeHit, results };
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
