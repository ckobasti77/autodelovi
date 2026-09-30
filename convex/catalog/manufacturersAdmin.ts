/**
 * Staff manufacturer list (`/admin/proizvodjaci`): all makers incl. inactive, create and
 * edit (name, aliases for import matching, default quality, VAG-genuine flag). Audited.
 */
import { v } from "convex/values";

import { slugifySr } from "../../lib/domain/slug";
import { audit, diffFields } from "../lib/audit";
import { actorOf } from "../lib/authz";
import { invalid, notFound } from "../lib/errors";
import { staffMutation, staffQuery } from "../lib/functions";
import { qualityV } from "../lib/validators";

export const list = staffQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("manufacturers"),
      name: v.string(),
      slug: v.string(),
      aliases: v.array(v.string()),
      isVagGenuine: v.boolean(),
      defaultQuality: qualityV,
      country: v.union(v.string(), v.null()),
      active: v.boolean(),
      productCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("manufacturers").withIndex("by_name").take(500);
    return rows.map((m) => ({
      _id: m._id,
      name: m.name,
      slug: m.slug,
      aliases: m.aliases,
      isVagGenuine: m.isVagGenuine,
      defaultQuality: m.defaultQuality,
      country: m.country ?? null,
      active: m.active,
      productCount: m.productCount,
    }));
  },
});

export const save = staffMutation({
  args: {
    manufacturerId: v.optional(v.id("manufacturers")),
    name: v.string(),
    aliases: v.array(v.string()),
    isVagGenuine: v.boolean(),
    defaultQuality: qualityV,
    country: v.optional(v.string()),
    active: v.boolean(),
  },
  returns: v.id("manufacturers"),
  handler: async (ctx, args) => {
    const name = args.name.trim().slice(0, 60);
    if (name.length < 2) invalid("Upišite naziv proizvođača.", "name");
    const aliases = [...new Set(args.aliases.map((a) => a.trim()).filter(Boolean))].slice(0, 20);
    const fields = {
      name,
      aliases,
      isVagGenuine: args.isVagGenuine,
      defaultQuality: args.defaultQuality,
      country: args.country?.trim().slice(0, 40) || undefined,
      active: args.active,
    };
    const actor = actorOf(ctx.viewer);
    if (args.manufacturerId) {
      const m = await ctx.db.get("manufacturers", args.manufacturerId);
      if (!m) return notFound("Proizvođač ne postoji.");
      const diff = diffFields(m, fields);
      if (diff.length === 0) return m._id;
      await ctx.db.patch("manufacturers", m._id, fields);
      await audit(ctx, {
        actor,
        action: "manufacturer.update",
        entityType: "manufacturer",
        entityId: m._id,
        summary: `Proizvođač „${name}“ izmenjen`,
        diff,
      });
      return m._id;
    }
    const slug = slugifySr(name);
    const taken = await ctx.db
      .query("manufacturers")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (taken) invalid(`Proizvođač „${name}“ već postoji.`, "name");
    const id = await ctx.db.insert("manufacturers", {
      ...fields,
      slug,
      productCount: 0,
      source: "admin",
    });
    await audit(ctx, {
      actor,
      action: "manufacturer.create",
      entityType: "manufacturer",
      entityId: id,
      summary: `Novi proizvođač „${name}“`,
    });
    return id;
  },
});
