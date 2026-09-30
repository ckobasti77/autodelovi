/**
 * Staff dashboard (docs/ARCHITECTURE.md §E2 `dashboard`, DESIGN-SYSTEM §10.10). KPIs come
 * from `statsDaily` and small bounded index ranges — never a scan of all orders. The client
 * passes `nowMinute` (rounded to the minute) because queries must not read the wall clock.
 */
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { belgradeDay, DAY_MS } from "../lib/domain/time";
import { staffQuery } from "./lib/functions";
import { getSettings } from "./lib/settings";
import { actorV, inquiryKindV, inquiryStatusV, orderStatusV } from "./lib/validators";

const OPEN_INQUIRY: Doc<"inquiries">["status"][] = ["nov", "u_obradi"];

async function statsRange(ctx: QueryCtx, nowMs: number, days: number) {
  const rows: {
    day: string;
    ordersCount: number;
    ordersValuePara: number;
    byCategory: Doc<"statsDaily">["byCategory"];
    zeroSearches: number;
    inquiriesCount: number;
  }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = belgradeDay(nowMs - i * DAY_MS);
    const row = await ctx.db
      .query("statsDaily")
      .withIndex("by_day", (q) => q.eq("day", day))
      .unique();
    rows.push({
      day,
      ordersCount: row?.ordersCount ?? 0,
      ordersValuePara: row?.ordersValuePara ?? 0,
      byCategory: row?.byCategory ?? {},
      zeroSearches: row?.zeroSearches ?? 0,
      inquiriesCount: row?.inquiriesCount ?? 0,
    });
  }
  return rows;
}

const sum = <T>(rows: readonly T[], pick: (r: T) => number) =>
  rows.reduce((total, r) => total + pick(r), 0);

export const kpis = staffQuery({
  args: { nowMinute: v.number() },
  returns: v.object({
    today: v.object({ orders: v.number(), valuePara: v.number() }),
    week: v.object({ orders: v.number(), valuePara: v.number() }),
    previousWeek: v.object({ orders: v.number(), valuePara: v.number() }),
    newOrders: v.number(),
    openInquiries: v.number(),
    oldestInquiryAt: v.union(v.number(), v.null()),
    pendingMechanics: v.number(),
    lowStock: v.number(),
    outOfStock: v.number(),
    slaTargetMinutes: v.number(),
    hours: v.array(
      v.object({ day: v.number(), open: v.string(), close: v.string(), closed: v.boolean() }),
    ),
    holidays: v.array(v.string()),
  }),
  handler: async (ctx, { nowMinute }) => {
    const days = await statsRange(ctx, nowMinute, 14);
    const week = days.slice(7);
    const previousWeek = days.slice(0, 7);
    const today = days[days.length - 1]!;
    const newOrders = await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "nova"))
      .take(500);
    let openInquiries = 0;
    let oldestInquiryAt: number | null = null;
    for (const status of OPEN_INQUIRY) {
      const rows = await ctx.db
        .query("inquiries")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(500);
      openInquiries += rows.length;
      for (const r of rows) {
        if (r.firstResponseAt) continue;
        if (oldestInquiryAt === null || r._creationTime < oldestInquiryAt)
          oldestInquiryAt = r._creationTime;
      }
    }
    const pending = await ctx.db
      .query("mechanicProfiles")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(500);
    const low = await ctx.db
      .query("products")
      .withIndex("by_stockState_and_active", (q) =>
        q.eq("stockState", "low_stock").eq("active", true),
      )
      .take(1_000);
    const out = await ctx.db
      .query("products")
      .withIndex("by_stockState_and_active", (q) =>
        q.eq("stockState", "out_of_stock").eq("active", true),
      )
      .take(1_000);
    const settings = await getSettings(ctx);
    return {
      today: { orders: today.ordersCount, valuePara: today.ordersValuePara },
      week: {
        orders: sum(week, (r) => r.ordersCount),
        valuePara: sum(week, (r) => r.ordersValuePara),
      },
      previousWeek: {
        orders: sum(previousWeek, (r) => r.ordersCount),
        valuePara: sum(previousWeek, (r) => r.ordersValuePara),
      },
      newOrders: newOrders.length,
      openInquiries,
      oldestInquiryAt,
      pendingMechanics: pending.length,
      lowStock: low.length,
      outOfStock: out.length,
      slaTargetMinutes: settings.notifications.reminderAfterWorkingMinutes,
      hours: settings.hours,
      holidays: settings.holidays.map((h) => h.date),
    };
  },
});

/** Orders per Belgrade day for the last `days` days (oldest first) + values. */
export const ordersPerDay = staffQuery({
  args: { nowMinute: v.number(), days: v.number() },
  returns: v.array(v.object({ day: v.string(), orders: v.number(), valuePara: v.number() })),
  handler: async (ctx, { nowMinute, days }) => {
    const span = Math.min(90, Math.max(7, Math.floor(days)));
    const rows = await statsRange(ctx, nowMinute, span);
    return rows.map((r) => ({ day: r.day, orders: r.ordersCount, valuePara: r.ordersValuePara }));
  },
});

/** Order lines per category (grouped to the top-level system) over the last `days` days. */
export const byCategory = staffQuery({
  args: { nowMinute: v.number(), days: v.number() },
  returns: v.array(
    v.object({ key: v.string(), name: v.string(), lines: v.number(), valuePara: v.number() }),
  ),
  handler: async (ctx, { nowMinute, days }) => {
    const span = Math.min(90, Math.max(7, Math.floor(days)));
    const rows = await statsRange(ctx, nowMinute, span);
    const totals = new Map<string, { lines: number; valuePara: number }>();
    for (const r of rows) {
      for (const [categoryId, value] of Object.entries(r.byCategory)) {
        const t = totals.get(categoryId) ?? { lines: 0, valuePara: 0 };
        t.lines += value.count;
        t.valuePara += value.valuePara;
        totals.set(categoryId, t);
      }
    }
    const grouped = new Map<string, { name: string; lines: number; valuePara: number }>();
    for (const [categoryId, value] of totals) {
      const id = ctx.db.normalizeId("categories", categoryId);
      const category = id ? await ctx.db.get("categories", id) : null;
      let key = category?.systemSlug ?? "ostalo";
      let name = "Ostalo";
      if (category) {
        const system = await ctx.db
          .query("categories")
          .withIndex("by_slug", (q) => q.eq("slug", category.systemSlug))
          .unique();
        name = system?.name ?? category.name;
        key = category.systemSlug;
      }
      const g = grouped.get(key) ?? { name, lines: 0, valuePara: 0 };
      g.lines += value.lines;
      g.valuePara += value.valuePara;
      grouped.set(key, g);
    }
    return [...grouped.entries()]
      .map(([key, g]) => ({ key, ...g }))
      .sort((a, b) => b.lines - a.lines)
      .slice(0, 12);
  },
});

/** Inquiries without a first reply and new orders, oldest first (SLA timers on the client). */
export const slaQueue = staffQuery({
  args: {},
  returns: v.object({
    inquiries: v.array(
      v.object({
        number: v.string(),
        status: inquiryStatusV,
        kind: inquiryKindV,
        contactName: v.string(),
        summary: v.string(),
        isMechanic: v.boolean(),
        createdAt: v.number(),
      }),
    ),
    orders: v.array(
      v.object({
        number: v.string(),
        status: orderStatusV,
        customerName: v.string(),
        totalPara: v.number(),
        createdAt: v.number(),
      }),
    ),
  }),
  handler: async (ctx) => {
    const inquiries = [];
    for (const status of OPEN_INQUIRY) {
      const rows = await ctx.db
        .query("inquiries")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("asc")
        .take(25);
      for (const i of rows) {
        if (i.firstResponseAt) continue;
        inquiries.push({
          number: i.number,
          status: i.status,
          kind: i.kind,
          contactName: i.contact.name,
          summary: i.vehicle?.label ?? i.message.slice(0, 80),
          isMechanic: i.mechanicProfileId !== undefined,
          createdAt: i._creationTime,
        });
      }
    }
    inquiries.sort((a, b) => a.createdAt - b.createdAt);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "nova"))
      .order("asc")
      .take(10);
    return {
      inquiries: inquiries.slice(0, 10),
      orders: orders.map((o) => ({
        number: o.number,
        status: o.status,
        customerName: o.company?.name ?? `${o.contact.firstName} ${o.contact.lastName}`,
        totalPara: o.totals.totalPara,
        createdAt: o._creationTime,
      })),
    };
  },
});

export const recentActivity = staffQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("auditLog"),
      action: v.string(),
      entityType: v.string(),
      entityId: v.string(),
      summary: v.string(),
      actor: actorV,
      at: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("auditLog").withIndex("by_at").order("desc").take(15);
    return rows.map((a) => ({
      _id: a._id,
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      summary: a.summary,
      actor: a.actor,
      at: a.at,
    }));
  },
});

/**
 * „Traženo, a nemamo“: zero-result searches of the last 7 days with the count of the 7 days
 * before (trend). `searchDaily` rows are read per day (≤ 300 each).
 */
export const searchedNotFound = staffQuery({
  args: { nowMinute: v.number(), days: v.optional(v.number()), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      normalized: v.string(),
      sample: v.string(),
      zeroCount: v.number(),
      previousZeroCount: v.number(),
      lastAt: v.number(),
    }),
  ),
  handler: async (ctx, { nowMinute, days, limit }) => {
    const span = Math.min(30, Math.max(1, Math.floor(days ?? 7)));
    const current = new Map<
      string,
      { normalized: string; sample: string; zeroCount: number; lastAt: number }
    >();
    const previous = new Map<string, number>();
    for (let i = 0; i < span * 2; i++) {
      const day = belgradeDay(nowMinute - i * DAY_MS);
      const rows = await ctx.db
        .query("searchDaily")
        .withIndex("by_day_and_normalized", (q) => q.eq("day", day))
        .take(300);
      for (const r of rows) {
        if (r.zeroCount === 0) continue;
        if (i < span) {
          const t = current.get(r.normalized) ?? {
            normalized: r.normalized,
            sample: r.sample,
            zeroCount: 0,
            lastAt: 0,
          };
          t.zeroCount += r.zeroCount;
          t.lastAt = Math.max(t.lastAt, r.lastAt);
          current.set(r.normalized, t);
        } else {
          previous.set(r.normalized, (previous.get(r.normalized) ?? 0) + r.zeroCount);
        }
      }
    }
    return [...current.values()]
      .sort((a, b) => b.zeroCount - a.zeroCount || b.lastAt - a.lastAt)
      .slice(0, Math.min(50, Math.max(1, limit ?? 10)))
      .map((r) => ({ ...r, previousZeroCount: previous.get(r.normalized) ?? 0 }));
  },
});
