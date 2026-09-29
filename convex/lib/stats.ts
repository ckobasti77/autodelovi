/**
 * `statsDaily` rows, updated in the same transaction as the source write (dashboard KPIs
 * never scan orders).
 */
import type { MutationCtx } from "../_generated/server";
import { belgradeDay } from "../../lib/domain/time";

type Increment = {
  ordersCount?: number;
  ordersValuePara?: number;
  cancelledCount?: number;
  inquiriesCount?: number;
  registrationsCount?: number;
  zeroSearches?: number;
  byCategory?: Record<string, { count: number; valuePara: number }>;
};

const MAX_CATEGORY_KEYS = 60;

export async function bumpStatsDaily(ctx: MutationCtx, at: number, inc: Increment): Promise<void> {
  const day = belgradeDay(at);
  const row = await ctx.db
    .query("statsDaily")
    .withIndex("by_day", (q) => q.eq("day", day))
    .unique();
  const base = row ?? {
    day,
    ordersCount: 0,
    ordersValuePara: 0,
    cancelledCount: 0,
    inquiriesCount: 0,
    registrationsCount: 0,
    zeroSearches: 0,
    byCategory: {} as Record<string, { count: number; valuePara: number }>,
  };
  const byCategory = { ...base.byCategory };
  for (const [key, value] of Object.entries(inc.byCategory ?? {})) {
    const current = byCategory[key];
    if (!current && Object.keys(byCategory).length >= MAX_CATEGORY_KEYS) continue;
    byCategory[key] = {
      count: (current?.count ?? 0) + value.count,
      valuePara: (current?.valuePara ?? 0) + value.valuePara,
    };
  }
  const next = {
    day,
    ordersCount: base.ordersCount + (inc.ordersCount ?? 0),
    ordersValuePara: base.ordersValuePara + (inc.ordersValuePara ?? 0),
    cancelledCount: base.cancelledCount + (inc.cancelledCount ?? 0),
    inquiriesCount: base.inquiriesCount + (inc.inquiriesCount ?? 0),
    registrationsCount: base.registrationsCount + (inc.registrationsCount ?? 0),
    zeroSearches: base.zeroSearches + (inc.zeroSearches ?? 0),
    byCategory,
  };
  if (row) await ctx.db.patch("statsDaily", row._id, next);
  else await ctx.db.insert("statsDaily", next);
}
