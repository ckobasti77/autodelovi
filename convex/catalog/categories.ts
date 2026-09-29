/**
 * Category tree and category pages (public, anonymous projections) + staff SEO edits.
 */
import { v } from "convex/values";

import { audit, diffFields } from "../lib/audit";
import { actorOf } from "../lib/authz";
import { categoryBySlug, categorySummaryV, toCategorySummary } from "../lib/catalog";
import { notFound } from "../lib/errors";
import { emitEvent } from "../lib/events";
import { publicQuery, staffMutation } from "../lib/functions";

const MAX_CATEGORIES = 200;

export const tree = publicQuery({
  args: {},
  returns: v.object({
    systems: v.array(categorySummaryV),
    categories: v.array(categorySummaryV),
    subcategories: v.array(categorySummaryV),
  }),
  handler: async (ctx) => {
    const load = async (kind: "system" | "category" | "subcategory") =>
      (
        await ctx.db
          .query("categories")
          .withIndex("by_kind_and_sortOrder", (q) => q.eq("kind", kind))
          .take(MAX_CATEGORIES)
      )
        .filter((c) => c.active)
        .map(toCategorySummary);
    return {
      systems: await load("system"),
      categories: await load("category"),
      subcategories: await load("subcategory"),
    };
  },
});

export const bySlug = publicQuery({
  args: { slug: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      category: categorySummaryV,
      intro: v.union(v.string(), v.null()),
      seoTitle: v.union(v.string(), v.null()),
      seoDescription: v.union(v.string(), v.null()),
      system: v.union(categorySummaryV, v.null()),
      parent: v.union(categorySummaryV, v.null()),
      children: v.array(categorySummaryV),
      related: v.array(categorySummaryV),
    }),
  ),
  handler: async (ctx, { slug }) => {
    const category = await categoryBySlug(ctx, slug.slice(0, 80));
    if (!category || !category.active) return null;
    const parent = category.parentId ? await ctx.db.get("categories", category.parentId) : null;
    const children = (
      await ctx.db
        .query("categories")
        .withIndex("by_parentId_and_sortOrder", (q) => q.eq("parentId", category._id))
        .take(50)
    ).filter((c) => c.active);
    const system =
      category.kind === "system" ? null : await categoryBySlug(ctx, category.systemSlug);
    const related = [];
    for (const relatedSlug of category.relatedSlugs.slice(0, 6)) {
      const doc = await categoryBySlug(ctx, relatedSlug);
      if (doc && doc.active) related.push(toCategorySummary(doc));
    }
    return {
      category: toCategorySummary(category),
      intro: category.intro ?? null,
      seoTitle: category.seoTitle ?? null,
      seoDescription: category.seoDescription ?? null,
      system: system ? toCategorySummary(system) : null,
      parent: parent ? toCategorySummary(parent) : null,
      children: children.map(toCategorySummary),
      related,
    };
  },
});

/** Staff: SEO texts, thumbnail path, visibility (slugs and 3D keys are frozen). */
export const update = staffMutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    intro: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    thumbnailPath: v.optional(v.string()),
    active: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { categoryId, ...patch }) => {
    const category = await ctx.db.get("categories", categoryId);
    if (!category) return notFound("Kategorija ne postoji.");
    const clean = {
      ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 80) } : {}),
      ...(patch.intro !== undefined ? { intro: patch.intro.slice(0, 3_000) } : {}),
      ...(patch.seoTitle !== undefined ? { seoTitle: patch.seoTitle.slice(0, 70) } : {}),
      ...(patch.seoDescription !== undefined
        ? { seoDescription: patch.seoDescription.slice(0, 170) }
        : {}),
      ...(patch.thumbnailPath !== undefined
        ? { thumbnailPath: patch.thumbnailPath.slice(0, 200) }
        : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: Math.round(patch.sortOrder) } : {}),
    };
    const diff = diffFields(category, clean);
    if (diff.length === 0) return null;
    const now = Date.now();
    await ctx.db.patch("categories", categoryId, { ...clean, updatedAt: now });
    const actor = actorOf(ctx.viewer);
    await audit(ctx, {
      actor,
      action: "category.update",
      entityType: "category",
      entityId: categoryId,
      summary: `Izmenjena kategorija „${category.name}“`,
      diff,
    });
    await emitEvent(ctx, {
      type: "category.changed",
      aggregateType: "category",
      aggregateId: categoryId,
      payload: {
        kind: "catalog",
        categoryId,
        slug: category.slug,
        fields: diff.map((d) => d.field),
      },
      dedupeKey: `category.changed:${categoryId}:${now}`,
      actor,
    });
    return null;
  },
});
