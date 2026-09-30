/**
 * E2E probes (docs/TESTING.md): **internal** queries only, so nothing here is reachable from
 * the internet. Playwright calls them with `npx convex run testing:<name>` against the dev
 * deployment (the CLI uses the deployment's admin key).
 */
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { hashToken, randomToken } from "./lib/tokens";
import { isAvailableNow } from "../lib/domain/stock";

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
      .withIndex("by_stockState_and_active", (q) => q.eq("stockState", "in_stock").eq("active", true))
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
        ? { slug: inStock.slug, name: inStock.name, oem: inStock.oemPrimary!, stockQty: inStock.stockQty }
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
