/**
 * Staff category tree editor (docs/ROUTES.md `/admin/kategorije`): the full tree incl.
 * inactive nodes, create, update (names, SEO texts, thumbnail, 3D part key), reorder
 * among siblings. Slugs of seeded categories stay frozen (D7); the 3D part key may only
 * point at a taxonomy category that has 3D nodes (lib/catalog/taxonomy.ts).
 */
import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { CATEGORIES } from "../../lib/catalog/taxonomy";
import { slugifySr } from "../../lib/domain/slug";
import { audit, diffFields } from "../lib/audit";
import { actorOf } from "../lib/authz";
import { invalid, notFound } from "../lib/errors";
import { emitEvent } from "../lib/events";
import { staffMutation, staffQuery } from "../lib/functions";
import { enforceRateLimit } from "../lib/rateLimits";

const PART_KEYS = new Set(CATEGORIES.filter((c) => c.instances.length > 0).map((c) => c.slug));

const nodeV = v.object({
  _id: v.id("categories"),
  slug: v.string(),
  name: v.string(),
  kind: v.union(v.literal("system"), v.literal("category"), v.literal("subcategory")),
  parentId: v.union(v.id("categories"), v.null()),
  systemSlug: v.string(),
  partKey: v.union(v.string(), v.null()),
  sortOrder: v.number(),
  active: v.boolean(),
  intro: v.union(v.string(), v.null()),
  seoTitle: v.union(v.string(), v.null()),
  seoDescription: v.union(v.string(), v.null()),
  thumbnailPath: v.union(v.string(), v.null()),
  thumbnailUrl: v.union(v.string(), v.null()),
  productCount: v.number(),
  inStockCount: v.number(),
  source: v.string(),
  updatedAt: v.number(),
});

/** Whole tree, flat and ordered (systems → categories → subcategories); ≤ 400 nodes. */
export const tree = staffQuery({
  args: {},
  returns: v.array(nodeV),
  handler: async (ctx) => {
    const out: (typeof nodeV.type)[] = [];
    const push = async (c: Doc<"categories">) => {
      out.push({
        _id: c._id,
        slug: c.slug,
        name: c.name,
        kind: c.kind,
        parentId: c.parentId ?? null,
        systemSlug: c.systemSlug,
        partKey: c.partKey ?? null,
        sortOrder: c.sortOrder,
        active: c.active,
        intro: c.intro ?? null,
        seoTitle: c.seoTitle ?? null,
        seoDescription: c.seoDescription ?? null,
        thumbnailPath: c.thumbnailPath ?? null,
        thumbnailUrl: c.thumbnailStorageId ? await ctx.storage.getUrl(c.thumbnailStorageId) : null,
        productCount: c.productCount,
        inStockCount: c.inStockCount,
        source: c.source,
        updatedAt: c.updatedAt,
      });
    };
    const systems = await ctx.db
      .query("categories")
      .withIndex("by_kind_and_sortOrder", (q) => q.eq("kind", "system"))
      .take(50);
    for (const s of systems) {
      await push(s);
      const children = await ctx.db
        .query("categories")
        .withIndex("by_parentId_and_sortOrder", (q) => q.eq("parentId", s._id))
        .take(100);
      for (const c of children) {
        await push(c);
        const subs = await ctx.db
          .query("categories")
          .withIndex("by_parentId_and_sortOrder", (q) => q.eq("parentId", c._id))
          .take(100);
        for (const sub of subs) await push(sub);
      }
    }
    return out;
  },
});

async function changed(
  ctx: MutationCtx,
  category: Doc<"categories">,
  fields: string[],
  actor: ReturnType<typeof actorOf>,
) {
  const now = Date.now();
  await emitEvent(ctx, {
    type: "category.changed",
    aggregateType: "category",
    aggregateId: category._id,
    payload: { kind: "catalog", categoryId: category._id, slug: category.slug, fields },
    dedupeKey: `category.changed:${category._id}:${now}`,
    actor,
  });
}

export const create = staffMutation({
  args: {
    parentId: v.id("categories"),
    name: v.string(),
    slug: v.optional(v.string()),
  },
  returns: v.id("categories"),
  handler: async (ctx, args) => {
    const parent = await ctx.db.get("categories", args.parentId);
    if (!parent) return notFound("Nadređena kategorija ne postoji.");
    if (parent.kind === "subcategory") invalid("Podkategorija ne može imati podkategorije.");
    const name = args.name.trim().slice(0, 80);
    if (name.length < 2) invalid("Upišite naziv kategorije.", "name");
    const slug = slugifySr(args.slug?.trim() || name);
    if (!slug) invalid("Neispravan slug.", "slug");
    const taken = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (taken) invalid(`Slug „${slug}“ je zauzet.`, "slug");
    const siblings = await ctx.db
      .query("categories")
      .withIndex("by_parentId_and_sortOrder", (q) => q.eq("parentId", parent._id))
      .order("desc")
      .take(1);
    const now = Date.now();
    const id = await ctx.db.insert("categories", {
      slug,
      name,
      kind: parent.kind === "system" ? "category" : "subcategory",
      parentId: parent._id,
      systemSlug: parent.systemSlug,
      relatedSlugs: [],
      sortOrder: (siblings[0]?.sortOrder ?? 0) + 10,
      active: false,
      productCount: 0,
      inStockCount: 0,
      updatedAt: now,
      source: "admin",
    });
    const actor = actorOf(ctx.viewer);
    await audit(ctx, {
      actor,
      action: "category.create",
      entityType: "category",
      entityId: id,
      summary: `Nova kategorija „${name}“ (${slug}) u „${parent.name}“`,
    });
    return id;
  },
});

export const update = staffMutation({
  args: {
    categoryId: v.id("categories"),
    name: v.optional(v.string()),
    intro: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    thumbnailPath: v.optional(v.string()),
    /** Empty string clears the 3D mapping. */
    partKey: v.optional(v.string()),
    active: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { categoryId, ...patch }) => {
    const category = await ctx.db.get("categories", categoryId);
    if (!category) return notFound("Kategorija ne postoji.");
    if (patch.partKey !== undefined && patch.partKey !== "") {
      if (!PART_KEYS.has(patch.partKey)) invalid("Nepoznat 3D deo.", "partKey");
      const owner = await findPartKeyOwner(ctx, patch.partKey);
      if (owner && owner._id !== categoryId)
        invalid(`3D deo je već povezan sa „${owner.name}“.`, "partKey");
    }
    if (patch.name !== undefined && patch.name.trim().length < 2)
      invalid("Upišite naziv kategorije.", "name");
    const clean = {
      ...(patch.name !== undefined ? { name: patch.name.trim().slice(0, 80) } : {}),
      ...(patch.intro !== undefined ? { intro: patch.intro.trim().slice(0, 3_000) } : {}),
      ...(patch.seoTitle !== undefined ? { seoTitle: patch.seoTitle.trim().slice(0, 70) } : {}),
      ...(patch.seoDescription !== undefined
        ? { seoDescription: patch.seoDescription.trim().slice(0, 170) }
        : {}),
      ...(patch.thumbnailPath !== undefined
        ? { thumbnailPath: patch.thumbnailPath.trim().slice(0, 200) }
        : {}),
      ...(patch.partKey !== undefined ? { partKey: patch.partKey || undefined } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
    };
    const diff = diffFields(category, clean);
    if (diff.length === 0) return null;
    await ctx.db.patch("categories", categoryId, { ...clean, updatedAt: Date.now() });
    const actor = actorOf(ctx.viewer);
    await audit(ctx, {
      actor,
      action: "category.update",
      entityType: "category",
      entityId: categoryId,
      summary: `Izmenjena kategorija „${category.name}“`,
      diff,
    });
    await changed(
      ctx,
      category,
      diff.map((d) => d.field),
      actor,
    );
    return null;
  },
});

async function findPartKeyOwner(ctx: MutationCtx, partKey: string) {
  // The taxonomy has ~60 categories and ~20 subcategories; both kinds are scanned (≤ 300).
  for (const category of await ctx.db
    .query("categories")
    .withIndex("by_kind_and_sortOrder", (q) => q.eq("kind", "category"))
    .take(300)) {
    if (category.partKey === partKey) return category;
  }
  for (const sub of await ctx.db
    .query("categories")
    .withIndex("by_kind_and_sortOrder", (q) => q.eq("kind", "subcategory"))
    .take(300)) {
    if (sub.partKey === partKey) return sub;
  }
  return null;
}

/** Moves a node one place up or down among its siblings (swaps sort orders). */
export const move = staffMutation({
  args: { categoryId: v.id("categories"), direction: v.union(v.literal("up"), v.literal("down")) },
  returns: v.null(),
  handler: async (ctx, { categoryId, direction }) => {
    const category = await ctx.db.get("categories", categoryId);
    if (!category) return notFound("Kategorija ne postoji.");
    const siblings = category.parentId
      ? await ctx.db
          .query("categories")
          .withIndex("by_parentId_and_sortOrder", (q) => q.eq("parentId", category.parentId))
          .take(200)
      : await ctx.db
          .query("categories")
          .withIndex("by_kind_and_sortOrder", (q) => q.eq("kind", category.kind))
          .take(200);
    const index = siblings.findIndex((s) => s._id === categoryId);
    const other = siblings[direction === "up" ? index - 1 : index + 1];
    if (index < 0 || !other) return null;
    // Normalise equal sort orders before swapping.
    const a = category.sortOrder === other.sortOrder ? index * 10 : category.sortOrder;
    const b =
      category.sortOrder === other.sortOrder
        ? (direction === "up" ? index - 1 : index + 1) * 10
        : other.sortOrder;
    const now = Date.now();
    await ctx.db.patch("categories", category._id, { sortOrder: b, updatedAt: now });
    await ctx.db.patch("categories", other._id, { sortOrder: a, updatedAt: now });
    const actor = actorOf(ctx.viewer);
    await audit(ctx, {
      actor,
      action: "category.reorder",
      entityType: "category",
      entityId: categoryId,
      summary: `Redosled: „${category.name}“ ${direction === "up" ? "gore" : "dole"}`,
    });
    await changed(ctx, category, ["sortOrder"], actor);
    return null;
  },
});

const CATEGORY_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export const generateThumbnailUploadUrl = staffMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await enforceRateLimit(ctx, "uploadUrl", `u:${ctx.viewer.userId}`);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Attaches an uploaded thumbnail (≤ 5 MB image); `null` removes the uploaded one. */
export const setThumbnail = staffMutation({
  args: { categoryId: v.id("categories"), storageId: v.union(v.id("_storage"), v.null()) },
  returns: v.null(),
  handler: async (ctx, { categoryId, storageId }) => {
    const category = await ctx.db.get("categories", categoryId);
    if (!category) return notFound("Kategorija ne postoji.");
    if (storageId) {
      const meta = await ctx.db.system.get("_storage", storageId);
      if (!meta) return notFound("Slika nije otpremljena.");
      if (meta.size > 5 * 1024 * 1024) invalid("Slika je veća od 5 MB.", "storageId");
      if (meta.contentType && !CATEGORY_IMAGE_TYPES.includes(meta.contentType))
        invalid("Dozvoljene su slike JPG, PNG, WebP ili AVIF.", "storageId");
      const used = await ctx.db
        .query("uploads")
        .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
        .first();
      if (used) invalid("Slika je već iskorišćena.", "storageId");
    }
    const previous = category.thumbnailStorageId;
    await ctx.db.patch("categories", categoryId, {
      thumbnailStorageId: storageId ?? undefined,
      updatedAt: Date.now(),
    });
    if (previous && previous !== storageId) await ctx.storage.delete(previous);
    if (storageId) {
      await ctx.db.insert("uploads", {
        storageId,
        purpose: "category_image",
        uploaderKey: `u:${ctx.viewer.userId}`,
        status: "attached",
        attachedTo: { type: "category", id: categoryId },
      });
      await ctx.scheduler.runAfter(0, internal.files.sniff, { storageId });
    }
    const actor = actorOf(ctx.viewer);
    await audit(ctx, {
      actor,
      action: "category.thumbnail",
      entityType: "category",
      entityId: categoryId,
      summary: `„${category.name}“: ${storageId ? "nova sličica" : "uklonjena sličica"}`,
    });
    await changed(ctx, category, ["thumbnail"], actor);
    return null;
  },
});

/** Category options for selects (id, name with its parent, kind). */
export const options = staffQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("categories"),
      label: v.string(),
      kind: v.string(),
      active: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const out = [];
    const systems = await ctx.db
      .query("categories")
      .withIndex("by_kind_and_sortOrder", (q) => q.eq("kind", "system"))
      .take(50);
    for (const s of systems) {
      const children = await ctx.db
        .query("categories")
        .withIndex("by_parentId_and_sortOrder", (q) => q.eq("parentId", s._id))
        .take(100);
      for (const c of children) {
        out.push({ _id: c._id, label: `${s.name} › ${c.name}`, kind: c.kind, active: c.active });
        const subs = await ctx.db
          .query("categories")
          .withIndex("by_parentId_and_sortOrder", (q) => q.eq("parentId", c._id))
          .take(100);
        for (const sub of subs)
          out.push({
            _id: sub._id,
            label: `${s.name} › ${c.name} › ${sub.name}`,
            kind: sub.kind,
            active: sub.active,
          });
      }
    }
    return out;
  },
});
