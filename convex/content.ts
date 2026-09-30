/**
 * Static & legal pages and FAQs (docs/ROUTES.md §B1). Public reads; the owner edits pages in
 * admin settings (step 15, „Pravni tekstovi“). Placeholders (`{{firma.naziv}}`) are filled on
 * the Next side from public settings, so the stored Markdown stays a template.
 */
import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { audit, diffFields } from "./lib/audit";
import { actorOf } from "./lib/authz";
import { fail, invalid, notFound } from "./lib/errors";
import { emitEvent } from "./lib/events";
import { ownerMutation, publicQuery, staffQuery } from "./lib/functions";
import { SEED_FAQS, SEED_PAGES } from "./seedData/content";

const pageV = v.object({
  slug: v.string(),
  title: v.string(),
  bodyMd: v.string(),
  version: v.number(),
  needsLegalReview: v.boolean(),
  updatedAt: v.number(),
});

export const pageBySlug = publicQuery({
  args: { slug: v.string() },
  returns: v.union(v.null(), pageV),
  handler: async (ctx, { slug }) => {
    const page = await ctx.db
      .query("contentPages")
      .withIndex("by_slug", (q) => q.eq("slug", slug.slice(0, 80)))
      .unique();
    if (!page || !page.published) return null;
    return {
      slug: page.slug,
      title: page.title,
      bodyMd: page.bodyMd,
      version: page.version,
      needsLegalReview: page.needsLegalReview,
      updatedAt: page.updatedAt,
    };
  },
});

export const faqs = publicQuery({
  args: { scope: v.string() },
  returns: v.array(v.object({ id: v.id("faqs"), question: v.string(), answerMd: v.string() })),
  handler: async (ctx, { scope }) => {
    const rows = await ctx.db
      .query("faqs")
      .withIndex("by_scope_and_sortOrder", (q) => q.eq("scope", scope.slice(0, 80)))
      .take(40);
    return rows
      .filter((f) => f.active)
      .map((f) => ({ id: f._id, question: f.question, answerMd: f.answerMd }));
  },
});

/**
 * Seed (called by `seed:run`): inserts missing pages and FAQs; never overwrites a page the
 * owner already edited (version > 1) — seed-owned pages (version 1) follow the template.
 */
export const seedContent = internalMutation({
  args: {},
  returns: v.object({ pages: v.number(), faqs: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    let pages = 0;
    for (const page of SEED_PAGES) {
      const existing = await ctx.db
        .query("contentPages")
        .withIndex("by_slug", (q) => q.eq("slug", page.slug))
        .unique();
      if (!existing) {
        await ctx.db.insert("contentPages", {
          slug: page.slug,
          title: page.title,
          bodyMd: page.bodyMd,
          version: 1,
          published: true,
          needsLegalReview: page.needsLegalReview,
          updatedAt: now,
        });
        pages++;
      } else if (existing.version === 1 && existing.bodyMd !== page.bodyMd) {
        await ctx.db.patch("contentPages", existing._id, {
          title: page.title,
          bodyMd: page.bodyMd,
          needsLegalReview: page.needsLegalReview,
          updatedAt: now,
        });
      }
    }
    let faqs = 0;
    const scopes = [...new Set(SEED_FAQS.map((f) => f.scope))];
    for (const scope of scopes) {
      const existing = await ctx.db
        .query("faqs")
        .withIndex("by_scope_and_sortOrder", (q) => q.eq("scope", scope))
        .take(40);
      if (existing.length > 0) continue;
      let order = 0;
      for (const faq of SEED_FAQS.filter((f) => f.scope === scope)) {
        await ctx.db.insert("faqs", {
          scope,
          question: faq.question,
          answerMd: faq.answerMd,
          sortOrder: order++,
          active: true,
        });
        faqs++;
      }
    }
    return { pages, faqs };
  },
});

const adminPageV = v.object({
  _id: v.id("contentPages"),
  slug: v.string(),
  title: v.string(),
  bodyMd: v.string(),
  version: v.number(),
  published: v.boolean(),
  needsLegalReview: v.boolean(),
  updatedAt: v.number(),
});

/** Staff: every content page (legal texts, o nama, kontakt …) with its Markdown template. */
export const adminPages = staffQuery({
  args: {},
  returns: v.array(adminPageV),
  handler: async (ctx) => {
    const rows = await ctx.db.query("contentPages").take(50);
    return rows
      .map((p) => ({
        _id: p._id,
        slug: p.slug,
        title: p.title,
        bodyMd: p.bodyMd,
        version: p.version,
        published: p.published,
        needsLegalReview: p.needsLegalReview,
        updatedAt: p.updatedAt,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "sr"));
  },
});

/**
 * Owner: saves a page (new version). `expectedVersion` guards against two people editing
 * the same text; `needsLegalReview: false` records that a lawyer approved this version.
 */
export const updatePage = ownerMutation({
  args: {
    pageId: v.id("contentPages"),
    title: v.string(),
    bodyMd: v.string(),
    published: v.boolean(),
    needsLegalReview: v.boolean(),
    expectedVersion: v.number(),
  },
  returns: v.object({ version: v.number() }),
  handler: async (ctx, args) => {
    const page = await ctx.db.get("contentPages", args.pageId);
    if (!page) return notFound("Stranica ne postoji.");
    if (page.version !== args.expectedVersion)
      fail("CONFLICT", "Tekst je u međuvremenu izmenjen. Osvežite prikaz.");
    const title = args.title.trim().slice(0, 120);
    if (title.length < 2) invalid("Upišite naslov.", "title");
    const bodyMd = args.bodyMd.replace(/\r\n/g, "\n").slice(0, 60_000);
    if (bodyMd.trim().length < 20) invalid("Tekst je prekratak.", "bodyMd");
    const diff = diffFields(page, {
      title,
      bodyMd,
      published: args.published,
      needsLegalReview: args.needsLegalReview,
    });
    if (diff.length === 0) return { version: page.version };
    const now = Date.now();
    const version = page.version + 1;
    await ctx.db.patch("contentPages", page._id, {
      title,
      bodyMd,
      published: args.published,
      needsLegalReview: args.needsLegalReview,
      version,
      updatedAt: now,
      updatedBy: ctx.viewer.userId,
    });
    const actor = actorOf(ctx.viewer);
    await audit(ctx, {
      actor,
      action: "content.update",
      entityType: "contentPage",
      entityId: page._id,
      summary: `Izmenjena stranica „${title}“ (verzija ${version})`,
      diff: diff.map((d) => (d.field === "bodyMd" ? { field: "bodyMd" } : d)),
    });
    await emitEvent(ctx, {
      type: "content.changed",
      aggregateType: "content",
      aggregateId: page._id,
      payload: { kind: "catalog", slug: page.slug, section: "page" },
      dedupeKey: `content.changed:${page._id}:${version}`,
      actor,
    });
    return { version };
  },
});
