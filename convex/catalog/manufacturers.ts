/**
 * Part manufacturers (public list for filters and the brand strip).
 */
import { v } from "convex/values";

import { publicQuery } from "../lib/functions";
import { qualityV } from "../lib/validators";

export const list = publicQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("manufacturers"),
      name: v.string(),
      slug: v.string(),
      isVagGenuine: v.boolean(),
      defaultQuality: qualityV,
      country: v.union(v.string(), v.null()),
      productCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("manufacturers").withIndex("by_name").take(300);
    return rows
      .filter((m) => m.active)
      .map((m) => ({
        _id: m._id,
        name: m.name,
        slug: m.slug,
        isVagGenuine: m.isVagGenuine,
        defaultQuality: m.defaultQuality,
        country: m.country ?? null,
        productCount: m.productCount,
      }));
  },
});
