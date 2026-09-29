/**
 * Gapless per-year counters (`order:2026`, `inquiry:2026`), incremented inside the creating
 * transaction — Convex serializes conflicting writers, so numbers are unique.
 */
import type { MutationCtx } from "../_generated/server";

export async function nextCounter(ctx: MutationCtx, name: string): Promise<number> {
  const row = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
  if (!row) {
    await ctx.db.insert("counters", { name, value: 1 });
    return 1;
  }
  const value = row.value + 1;
  await ctx.db.patch("counters", row._id, { value });
  return value;
}
