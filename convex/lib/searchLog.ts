/**
 * Search log writes (docs/DATA-MODEL.md §C8 `searchLogs` + `searchDaily`), shared by the
 * search page (`search.log`) and quick-order misses (`mechanicPortal.quickOrderMatch`), so
 * „Traženo, a nemamo“ sees both.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { classifyQuery, SEARCH_QUERY_MAX } from "../../lib/domain/search";
import { belgradeDay } from "../../lib/domain/time";
import type { Viewer } from "./authz";
import { bumpStatsDaily } from "./stats";

export type SearchUserType = Doc<"searchLogs">["userType"];

export function searchUserType(viewer: Viewer | null): SearchUserType {
  if (!viewer) return "anon";
  if (viewer.isStaff) return "staff";
  return viewer.mechanic?.status === "approved" ? "mechanic" : "customer";
}

export async function recordSearch(
  ctx: MutationCtx,
  input: {
    query: string;
    resultsCount: number;
    exactCodeHit: boolean;
    source: Doc<"searchLogs">["source"];
    userType: SearchUserType;
    generationId?: Id<"vehicleGenerations">;
    sessionHash?: string;
  },
): Promise<void> {
  const query = input.query.slice(0, SEARCH_QUERY_MAX).trim();
  if (!query) return;
  const classified = classifyQuery(query);
  const normalized = (
    classified.kind === "code" ? (classified.codes[0] ?? classified.folded) : classified.folded
  ).slice(0, 200);
  const now = Date.now();
  const resultsCount = Math.max(0, Math.floor(input.resultsCount));
  await ctx.db.insert("searchLogs", {
    query,
    normalized,
    kind: classified.kind,
    resultsCount,
    exactCodeHit: input.exactCodeHit,
    userType: input.userType,
    ...(input.generationId ? { generationId: input.generationId } : {}),
    source: input.source,
    ...(input.sessionHash ? { sessionHash: input.sessionHash.slice(0, 64) } : {}),
    at: now,
  });
  const day = belgradeDay(now);
  const daily = await ctx.db
    .query("searchDaily")
    .withIndex("by_day_and_normalized", (q) => q.eq("day", day).eq("normalized", normalized))
    .unique();
  if (daily) {
    await ctx.db.patch("searchDaily", daily._id, {
      count: daily.count + 1,
      zeroCount: daily.zeroCount + (resultsCount === 0 ? 1 : 0),
      lastAt: now,
    });
  } else {
    await ctx.db.insert("searchDaily", {
      day,
      normalized,
      sample: query,
      count: 1,
      zeroCount: resultsCount === 0 ? 1 : 0,
      lastAt: now,
    });
  }
  if (resultsCount === 0) await bumpStatsDaily(ctx, now, { zeroSearches: 1 });
}
