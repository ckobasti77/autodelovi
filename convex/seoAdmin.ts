/**
 * Staff side of SEO and ads (SEO-ADS §J4, §J8, §J10): the landing guard overview, ads landings
 * (`/ponuda/[slug]`, managed in Podešavanja → Oglasne strane), tracking status, the sources
 * report (`/admin/izvori`) and the Google Ads offline conversions export.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import {
  CHANNELS,
  classifyAttribution,
  googleClickIds,
  type Channel,
} from "../lib/domain/attribution";
import { belgradeParts } from "../lib/domain/time";
import { slugifySr } from "../lib/domain/slug";
import { audit, diffFields } from "./lib/audit";
import { actorOf } from "./lib/authz";
import { invalid, notFound } from "./lib/errors";
import { metaCapiToken } from "./lib/env";
import { staffMutation, staffQuery } from "./lib/functions";
import { getSettings } from "./lib/settings";
import { revalidateEnabled } from "./revalidate";

const REPORT_LIMIT = 5_000;
const COMPLETED = new Set<Doc<"orders">["status"]>(["zavrsena", "isporucena", "preuzeta"]);

// ---------------------------------------------------------------------------------------
// Landing guard overview

export const landingOverview = staffQuery({
  args: {},
  returns: v.object({
    total: v.number(),
    indexable: v.number(),
    byReason: v.array(v.object({ reason: v.string(), count: v.number() })),
    cap: v.number(),
    lastUpdatedAt: v.union(v.number(), v.null()),
    top: v.array(
      v.object({
        path: v.string(),
        productCount: v.number(),
        inStockCount: v.number(),
        indexable: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const settings = await getSettings(ctx);
    const rows = await ctx.db.query("landingStats").withIndex("by_rank").order("desc").take(8_000);
    const reasons = new Map<string, number>();
    let indexable = 0;
    let last = 0;
    for (const r of rows) {
      if (r.indexable) indexable++;
      else reasons.set(r.reason ?? "unknown", (reasons.get(r.reason ?? "unknown") ?? 0) + 1);
      last = Math.max(last, r.updatedAt);
    }
    return {
      total: rows.length,
      indexable,
      byReason: [...reasons.entries()].map(([reason, count]) => ({ reason, count })),
      cap: settings.seo.maxIndexableLandings,
      lastUpdatedAt: last || null,
      top: rows.slice(0, 15).map((r) => ({
        path: `/delovi/${r.categorySlug}/${r.brandSlug}${r.modelSlug ? `/${r.modelSlug}` : ""}`,
        productCount: r.productCount,
        inStockCount: r.inStockCount,
        indexable: r.indexable,
      })),
    };
  },
});

export const recomputeLandings = staffMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.landings.recompute, {});
    return null;
  },
});

// ---------------------------------------------------------------------------------------
// Tracking status (CAPI token, cache purge, recent server-side deliveries)

export const trackingStatus = staffQuery({
  args: {},
  returns: v.object({
    capiTokenSet: v.boolean(),
    revalidateEnabled: v.boolean(),
    recentCapi: v.array(
      v.object({
        at: v.number(),
        status: v.string(),
        detail: v.union(v.string(), v.null()),
      }),
    ),
  }),
  handler: async (ctx) => {
    const sent = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "sent"))
      .order("desc")
      .take(200);
    const failed = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .order("desc")
      .take(200);
    const skipped = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "skipped"))
      .order("desc")
      .take(200);
    const recentCapi = [...sent, ...failed, ...skipped]
      .filter((d) => d.channel === "meta_capi")
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 5)
      .map((d) => ({
        at: d.sentAt ?? d._creationTime,
        status: d.status,
        detail: d.lastError ?? d.providerRef ?? null,
      }));
    return {
      capiTokenSet: Boolean(metaCapiToken()),
      revalidateEnabled: revalidateEnabled(),
      recentCapi,
    };
  },
});

// ---------------------------------------------------------------------------------------
// Ads landings `/ponuda/[slug]`

const adLandingV = v.object({
  _id: v.id("adLandings"),
  slug: v.string(),
  title: v.string(),
  headline: v.string(),
  subhead: v.union(v.string(), v.null()),
  bodyMd: v.union(v.string(), v.null()),
  categoryId: v.union(v.id("categories"), v.null()),
  categoryName: v.union(v.string(), v.null()),
  brandId: v.union(v.id("vehicleBrands"), v.null()),
  modelId: v.union(v.id("vehicleModels"), v.null()),
  generationId: v.union(v.id("vehicleGenerations"), v.null()),
  vehicleLabel: v.union(v.string(), v.null()),
  products: v.array(v.object({ _id: v.id("products"), sku: v.string(), name: v.string() })),
  indexable: v.boolean(),
  active: v.boolean(),
  updatedAt: v.number(),
});

async function toAdLandingRow(ctx: QueryCtx, d: Doc<"adLandings">) {
  const category = d.categoryId ? await ctx.db.get("categories", d.categoryId) : null;
  const brand = d.brandId ? await ctx.db.get("vehicleBrands", d.brandId) : null;
  const model = d.modelId ? await ctx.db.get("vehicleModels", d.modelId) : null;
  const generation = d.generationId ? await ctx.db.get("vehicleGenerations", d.generationId) : null;
  const products = [];
  for (const id of d.productIds) {
    const p = await ctx.db.get("products", id);
    if (p) products.push({ _id: p._id, sku: p.sku, name: p.name });
  }
  const vehicleLabel = [brand?.name, generation?.name ?? model?.name].filter(Boolean).join(" ");
  return {
    _id: d._id,
    slug: d.slug,
    title: d.title,
    headline: d.headline,
    subhead: d.subhead ?? null,
    bodyMd: d.bodyMd ?? null,
    categoryId: d.categoryId ?? null,
    categoryName: category?.name ?? null,
    brandId: d.brandId ?? null,
    modelId: d.modelId ?? null,
    generationId: d.generationId ?? null,
    vehicleLabel: vehicleLabel || null,
    products,
    indexable: d.indexable,
    active: d.active,
    updatedAt: d.updatedAt,
  };
}

export const adLandings = staffQuery({
  args: {},
  returns: v.array(adLandingV),
  handler: async (ctx) => {
    const rows = await ctx.db.query("adLandings").order("desc").take(100);
    const out = [];
    for (const d of rows) out.push(await toAdLandingRow(ctx, d));
    return out;
  },
});

const LIMITS = { title: 70, headline: 90, subhead: 220, bodyMd: 3_000 } as const;

export const saveAdLanding = staffMutation({
  args: {
    id: v.optional(v.id("adLandings")),
    slug: v.string(),
    title: v.string(),
    headline: v.string(),
    subhead: v.optional(v.string()),
    bodyMd: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    brandId: v.optional(v.id("vehicleBrands")),
    modelId: v.optional(v.id("vehicleModels")),
    generationId: v.optional(v.id("vehicleGenerations")),
    productIds: v.array(v.id("products")),
    indexable: v.boolean(),
    active: v.boolean(),
  },
  returns: v.id("adLandings"),
  handler: async (ctx, args) => {
    const slug = slugifySr(args.slug).slice(0, 60);
    if (slug.length < 3)
      invalid("Adresa mora imati bar 3 znaka (mala slova, cifre, crtice).", "slug");
    const title = args.title.trim();
    const headline = args.headline.trim();
    if (!title) invalid("Unesite naslov stranice.", "title");
    if (!headline) invalid("Unesite glavnu poruku (H1).", "headline");
    for (const [key, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][]) {
      const value = key === "title" ? title : key === "headline" ? headline : args[key]?.trim();
      if (value && value.length > max) invalid(`Najviše ${max} znakova.`, key);
    }
    if (args.productIds.length > 24) invalid("Najviše 24 artikla.", "productIds");
    if (args.modelId && !args.brandId) invalid("Izaberite marku za model.", "brandId");
    if (args.generationId && !args.modelId) invalid("Izaberite model za generaciju.", "modelId");
    if (args.categoryId) {
      const c = await ctx.db.get("categories", args.categoryId);
      if (!c || c.kind === "system") invalid("Izaberite kategoriju (ne sistem).", "categoryId");
    }
    const clash = await ctx.db
      .query("adLandings")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (clash && clash._id !== args.id) invalid("Ta adresa je već zauzeta.", "slug");
    const fields = {
      slug,
      title,
      headline,
      subhead: args.subhead?.trim() || undefined,
      bodyMd: args.bodyMd?.trim() || undefined,
      categoryId: args.categoryId,
      brandId: args.brandId,
      modelId: args.modelId,
      generationId: args.generationId,
      productIds: [...new Set(args.productIds)],
      indexable: args.indexable,
      active: args.active,
      updatedAt: Date.now(),
    };
    const actor = actorOf(ctx.viewer);
    if (args.id) {
      const before = await ctx.db.get("adLandings", args.id);
      if (!before) return notFound("Oglasna strana nije pronađena.");
      await ctx.db.replace("adLandings", args.id, fields);
      await audit(ctx, {
        actor,
        action: "adLanding.update",
        entityType: "adLanding",
        entityId: args.id,
        summary: `Oglasna strana /ponuda/${slug} izmenjena`,
        diff: diffFields(before, fields, [
          "slug",
          "title",
          "headline",
          "subhead",
          "bodyMd",
          "categoryId",
          "brandId",
          "modelId",
          "generationId",
          "productIds",
          "indexable",
          "active",
        ]),
      });
      return args.id;
    }
    const id = await ctx.db.insert("adLandings", fields);
    await audit(ctx, {
      actor,
      action: "adLanding.create",
      entityType: "adLanding",
      entityId: id,
      summary: `Oglasna strana /ponuda/${slug} napravljena`,
    });
    return id;
  },
});

export const removeAdLanding = staffMutation({
  args: { id: v.id("adLandings") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const doc = await ctx.db.get("adLandings", id);
    if (!doc) return null;
    await ctx.db.delete("adLandings", id);
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "adLanding.delete",
      entityType: "adLanding",
      entityId: id,
      summary: `Oglasna strana /ponuda/${doc.slug} obrisana`,
    });
    return null;
  },
});

// ---------------------------------------------------------------------------------------
// Sources report (`/admin/izvori`)

const reportRowV = v.object({
  channel: v.string(),
  source: v.string(),
  medium: v.string(),
  campaign: v.string(),
  inquiries: v.number(),
  registrations: v.number(),
  orders: v.number(),
  valuePara: v.number(),
  completedOrders: v.number(),
  completedValuePara: v.number(),
});

type ReportRow = {
  channel: Channel;
  source: string;
  medium: string;
  campaign: string;
  inquiries: number;
  registrations: number;
  orders: number;
  valuePara: number;
  completedOrders: number;
  completedValuePara: number;
};

export const sourcesReport = staffQuery({
  args: { from: v.number(), to: v.number() },
  returns: v.object({
    rows: v.array(reportRowV),
    byChannel: v.array(reportRowV),
    truncated: v.boolean(),
    withoutSource: v.object({
      orders: v.number(),
      inquiries: v.number(),
      registrations: v.number(),
    }),
  }),
  handler: async (ctx, { from, to }) => {
    const rows = new Map<string, ReportRow>();
    const row = (a: Doc<"orders">["attribution"]) => {
      const info = classifyAttribution(a);
      const key = [info.channel, info.source, info.medium, info.campaign].join("|");
      let r = rows.get(key);
      if (!r) {
        r = {
          ...info,
          inquiries: 0,
          registrations: 0,
          orders: 0,
          valuePara: 0,
          completedOrders: 0,
          completedValuePara: 0,
        };
        rows.set(key, r);
      }
      return r;
    };
    const withoutSource = { orders: 0, inquiries: 0, registrations: 0 };
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", from).lte("_creationTime", to))
      .order("desc")
      .take(REPORT_LIMIT);
    for (const o of orders) {
      if (o.isTest || o.status === "otkazana") continue;
      if (!o.attribution?.first && !o.attribution?.last) withoutSource.orders++;
      const r = row(o.attribution);
      r.orders++;
      r.valuePara += o.totals.totalPara;
      if (COMPLETED.has(o.status)) {
        r.completedOrders++;
        r.completedValuePara += o.totals.totalPara;
      }
    }
    const inquiries = await ctx.db
      .query("inquiries")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", from).lte("_creationTime", to))
      .order("desc")
      .take(REPORT_LIMIT);
    for (const i of inquiries) {
      if (i.isTest) continue;
      if (!i.attribution?.first && !i.attribution?.last) withoutSource.inquiries++;
      row(i.attribution).inquiries++;
    }
    const profiles = await ctx.db
      .query("mechanicProfiles")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", from).lte("_creationTime", to))
      .order("desc")
      .take(REPORT_LIMIT);
    for (const p of profiles) {
      if (!p.attribution?.first && !p.attribution?.last) withoutSource.registrations++;
      row(p.attribution).registrations++;
    }
    const list = [...rows.values()].sort(
      (a, b) => b.valuePara - a.valuePara || b.orders + b.inquiries - (a.orders + a.inquiries),
    );
    const byChannel = CHANNELS.map((channel) => {
      const of = list.filter((r) => r.channel === channel);
      return {
        channel,
        source: "",
        medium: "",
        campaign: "",
        inquiries: of.reduce((n, r) => n + r.inquiries, 0),
        registrations: of.reduce((n, r) => n + r.registrations, 0),
        orders: of.reduce((n, r) => n + r.orders, 0),
        valuePara: of.reduce((n, r) => n + r.valuePara, 0),
        completedOrders: of.reduce((n, r) => n + r.completedOrders, 0),
        completedValuePara: of.reduce((n, r) => n + r.completedValuePara, 0),
      };
    }).filter((r) => r.orders + r.inquiries + r.registrations > 0);
    return {
      rows: list.slice(0, 200),
      byChannel,
      truncated:
        orders.length === REPORT_LIMIT ||
        inquiries.length === REPORT_LIMIT ||
        profiles.length === REPORT_LIMIT,
      withoutSource,
    };
  },
});

// ---------------------------------------------------------------------------------------
// Google Ads offline conversions (completed orders with a click id and ads consent)

const pad = (n: number) => String(n).padStart(2, "0");

/** `yyyy-MM-dd HH:mm:ss` in Europe/Belgrade (the CSV declares `TimeZone=Europe/Belgrade`). */
export function belgradeConversionTime(ms: number): string {
  const p = belgradeParts(ms);
  const seconds = Math.floor((ms / 1000) % 60);
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}:${pad(seconds)}`;
}

export const offlineConversions = staffQuery({
  args: { from: v.number(), to: v.number() },
  returns: v.object({
    conversionName: v.union(v.string(), v.null()),
    gclid: v.array(
      v.object({
        orderNumber: v.string(),
        gclid: v.string(),
        time: v.string(),
        valuePara: v.number(),
      }),
    ),
    braid: v.array(
      v.object({
        orderNumber: v.string(),
        gbraid: v.union(v.string(), v.null()),
        wbraid: v.union(v.string(), v.null()),
        time: v.string(),
        valuePara: v.number(),
      }),
    ),
    withoutConsent: v.number(),
  }),
  handler: async (ctx, { from, to }) => {
    const settings = await getSettings(ctx);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", from).lte("_creationTime", to))
      .order("desc")
      .take(REPORT_LIMIT);
    const gclid = [];
    const braid = [];
    let withoutConsent = 0;
    for (const o of orders) {
      if (!COMPLETED.has(o.status) || o.isTest || o.isDemo) continue;
      const ids = googleClickIds(o.attribution);
      if (!ids.gclid && !ids.gbraid && !ids.wbraid) continue;
      if (!o.attribution?.consentAds) {
        withoutConsent++;
        continue;
      }
      const at = o.completedAt ?? o.deliveredAt ?? o.pickedUpAt ?? o.updatedAt;
      const base = {
        orderNumber: o.number,
        time: belgradeConversionTime(at),
        valuePara: o.totals.totalPara,
      };
      if (ids.gclid) gclid.push({ ...base, gclid: ids.gclid });
      else braid.push({ ...base, gbraid: ids.gbraid ?? null, wbraid: ids.wbraid ?? null });
    }
    return {
      conversionName: settings.tracking.gadsOfflineConversionName?.trim() || null,
      gclid,
      braid,
      withoutConsent,
    };
  },
});
