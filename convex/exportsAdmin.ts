/**
 * Export pages for the staff download routes (`/admin/izvoz/[vrsta]`, docs/IMPORT.md §K5).
 * Paginated so the route handler can stream any catalog size; staff only (cost prices and
 * customer contacts are included).
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { staffQuery } from "./lib/functions";
import { fitmentRefV } from "./lib/importValidators";
import {
  deliveryMethodV,
  mechanicStatusV,
  orderStatusV,
  paymentMethodV,
  qualityV,
} from "./lib/validators";

const customerTypeV = v.union(v.literal("guest"), v.literal("customer"), v.literal("mechanic"));

async function categoryLabels(ctx: QueryCtx): Promise<Map<Id<"categories">, string>> {
  const all = await ctx.db.query("categories").take(1_000);
  const byId = new Map(all.map((c) => [c._id, c]));
  const nameCount = new Map<string, number>();
  for (const c of all)
    nameCount.set(c.name.toLowerCase(), (nameCount.get(c.name.toLowerCase()) ?? 0) + 1);
  // A repeated name is written with its group, so the export imports back unambiguously.
  return new Map(
    all.map((c) => {
      const parent = c.parentId ? byId.get(c.parentId) : undefined;
      const repeated = (nameCount.get(c.name.toLowerCase()) ?? 0) > 1;
      return [c._id, repeated && parent ? `${parent.name} › ${c.name}` : c.name];
    }),
  );
}

export const productsPage = staffQuery({
  args: { paginationOpts: paginationOptsValidator, includeDemo: v.optional(v.boolean()) },
  returns: paginationResultValidator(
    v.object({
      sku: v.string(),
      name: v.string(),
      category: v.string(),
      manufacturer: v.string(),
      quality: qualityV,
      oem: v.array(v.string()),
      mpn: v.union(v.string(), v.null()),
      cross: v.array(v.string()),
      retailPricePara: v.number(),
      costNetPara: v.union(v.number(), v.null()),
      stockQty: v.number(),
      leadTimeDays: v.union(v.number(), v.null()),
      fitments: v.array(fitmentRefV),
      description: v.union(v.string(), v.null()),
      images: v.array(v.string()),
      weightGrams: v.union(v.number(), v.null()),
      ean: v.union(v.string(), v.null()),
      active: v.boolean(),
      lowStockThreshold: v.union(v.number(), v.null()),
      isDemo: v.boolean(),
    }),
  ),
  handler: async (ctx, { paginationOpts, includeDemo }) => {
    const labels = await categoryLabels(ctx);
    const page = await ctx.db
      .query("products")
      .withIndex("by_sku")
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .paginate(paginationOpts);
    const out = [];
    for (const p of page.page) {
      if (p.isDemo && !includeDemo) continue;
      const content = await ctx.db
        .query("productContent")
        .withIndex("by_productId", (q) => q.eq("productId", p._id))
        .unique();
      const priv = await ctx.db
        .query("productPrivate")
        .withIndex("by_productId", (q) => q.eq("productId", p._id))
        .unique();
      const fitments = await ctx.db
        .query("fitments")
        .withIndex("by_productId", (q) => q.eq("productId", p._id))
        .take(300);
      const images: string[] = [];
      for (const img of content?.images ?? []) {
        const url = img.sourceUrl ?? (await ctx.storage.getUrl(img.storageId));
        if (url) images.push(url);
      }
      out.push({
        sku: p.sku,
        name: p.name,
        category: labels.get(p.categoryId) ?? "",
        manufacturer: p.manufacturerName,
        quality: p.quality,
        oem: (content?.oemNumbers ?? []).map((o) => o.raw),
        mpn: p.mpn ?? null,
        cross: (content?.crossNumbers ?? []).map((c) => `${c.manufacturer} ${c.raw}`.trim()),
        retailPricePara: p.retailPricePara,
        costNetPara: priv?.costNetPara ?? null,
        stockQty: p.stockQty,
        leadTimeDays: p.leadTimeDays ?? null,
        fitments: fitments.map((f) => ({
          brandId: f.brandId,
          modelId: f.modelId,
          generationId: f.generationId,
          ...(f.engineId ? { engineId: f.engineId } : {}),
          ...(f.yearFrom !== undefined ? { yearFrom: f.yearFrom } : {}),
          ...(f.yearTo !== undefined ? { yearTo: f.yearTo } : {}),
        })),
        description: content?.description ?? null,
        images,
        weightGrams: content?.weightGrams ?? null,
        ean: p.ean ?? null,
        active: p.active,
        lowStockThreshold: p.lowStockThreshold ?? null,
        isDemo: p.isDemo,
      });
    }
    return { ...page, page: out };
  },
});

export const ordersPage = staffQuery({
  args: {
    paginationOpts: paginationOptsValidator,
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  returns: paginationResultValidator(
    v.object({
      number: v.string(),
      createdAt: v.number(),
      status: orderStatusV,
      customerType: customerTypeV,
      firstName: v.string(),
      lastName: v.string(),
      phone: v.string(),
      email: v.string(),
      companyName: v.union(v.string(), v.null()),
      companyPib: v.union(v.string(), v.null()),
      itemCount: v.number(),
      itemsPara: v.number(),
      discountPara: v.number(),
      deliveryPara: v.number(),
      vatPara: v.number(),
      totalPara: v.number(),
      paymentMethod: paymentMethodV,
      paymentStatus: v.string(),
      deliveryMethod: deliveryMethodV,
      city: v.union(v.string(), v.null()),
      trackingNumber: v.union(v.string(), v.null()),
      source: v.string(),
      campaign: v.union(v.string(), v.null()),
      isDemo: v.boolean(),
    }),
  ),
  handler: async (ctx, { paginationOpts, from, to }) => {
    const query =
      from !== undefined || to !== undefined
        ? ctx.db
            .query("orders")
            .withIndex("by_creation_time", (q) =>
              q.gte("_creationTime", from ?? 0).lte("_creationTime", to ?? Number.MAX_SAFE_INTEGER),
            )
        : ctx.db.query("orders");
    const page = await query.order("desc").paginate(paginationOpts);
    return {
      ...page,
      page: page.page.map((o: Doc<"orders">) => ({
        number: o.number,
        createdAt: o._creationTime,
        status: o.status,
        customerType: o.customerType,
        firstName: o.contact.firstName,
        lastName: o.contact.lastName,
        phone: o.contact.phone,
        email: o.contact.email,
        companyName: o.company?.name ?? null,
        companyPib: o.company?.pib ?? null,
        itemCount: o.itemCount,
        itemsPara: o.totals.itemsPara,
        discountPara: o.totals.discountPara,
        deliveryPara: o.totals.deliveryPara,
        vatPara: o.totals.vatPara,
        totalPara: o.totals.totalPara,
        paymentMethod: o.payment.method,
        paymentStatus: o.payment.status,
        deliveryMethod: o.delivery.method,
        city: o.delivery.address?.city ?? null,
        trackingNumber: o.delivery.trackingNumber ?? null,
        source: o.source,
        campaign: (o.attribution?.last ?? o.attribution?.first)?.campaign ?? null,
        isDemo: o.isDemo,
      })),
    };
  },
});

export const customersPage = staffQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      firstName: v.union(v.string(), v.null()),
      lastName: v.union(v.string(), v.null()),
      email: v.union(v.string(), v.null()),
      phone: v.union(v.string(), v.null()),
      createdAt: v.number(),
      mechanicStatus: v.string(),
      marketingConsent: v.boolean(),
      blocked: v.boolean(),
      orderCount: v.number(),
      isDemo: v.boolean(),
    }),
  ),
  handler: async (ctx, { paginationOpts }) => {
    const page = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "customer"))
      .order("desc")
      .paginate(paginationOpts);
    const out = [];
    for (const u of page.page) {
      if (u.isTest) continue;
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_userId", (q) => q.eq("userId", u._id))
        .take(500);
      out.push({
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        email: u.email ?? null,
        phone: u.phoneE164 ?? null,
        createdAt: u._creationTime,
        mechanicStatus: u.mechanicStatus ?? "none",
        marketingConsent: u.marketingConsent === true,
        blocked: u.status === "blocked",
        orderCount: orders.length,
        isDemo: u.isDemo === true,
      });
    }
    return { ...page, page: out };
  },
});

export const mechanicsPage = staffQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({
      companyName: v.string(),
      pib: v.string(),
      mb: v.string(),
      contactPerson: v.string(),
      phone: v.string(),
      email: v.string(),
      city: v.string(),
      address: v.string(),
      status: mechanicStatusV,
      tierName: v.union(v.string(), v.null()),
      creditEnabled: v.boolean(),
      creditLimitPara: v.union(v.number(), v.null()),
      paymentTermsDays: v.number(),
      createdAt: v.number(),
      isDemo: v.boolean(),
    }),
  ),
  handler: async (ctx, { paginationOpts }) => {
    const page = await ctx.db.query("mechanicProfiles").order("desc").paginate(paginationOpts);
    const tiers = new Map<string, string>();
    const out = [];
    for (const m of page.page) {
      let tierName: string | null = null;
      if (m.tierId) {
        if (!tiers.has(m.tierId))
          tiers.set(m.tierId, (await ctx.db.get("priceTiers", m.tierId))?.name ?? "");
        tierName = tiers.get(m.tierId) || null;
      }
      out.push({
        companyName: m.companyName,
        pib: m.pib,
        mb: m.mb,
        contactPerson: m.contactPerson,
        phone: m.phone,
        email: m.email,
        city: m.city,
        address: m.address,
        status: m.status,
        tierName,
        creditEnabled: m.creditEnabled,
        creditLimitPara: m.creditLimitPara ?? null,
        paymentTermsDays: m.paymentTermsDays,
        createdAt: m._creationTime,
        isDemo: m.isDemo,
      });
    }
    return { ...page, page: out };
  },
});
