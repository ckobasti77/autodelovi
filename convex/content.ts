/**
 * Static & legal pages and FAQs (docs/ROUTES.md §B1). Public reads; the owner edits pages in
 * admin settings (step 15, „Pravni tekstovi“). Placeholders (`{{firma.naziv}}`) are filled on
 * the Next side from public settings, so the stored Markdown stays a template.
 */
import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { audit, diffFields } from "./lib/audit";
import { actorOf, SYSTEM_ACTOR } from "./lib/authz";
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
    // Compare raw values: the audit diff caps strings at 500 characters, so it cannot tell
    // whether a long legal text changed after its first 500 characters.
    const unchanged =
      page.title === title &&
      page.bodyMd === bodyMd &&
      page.published === args.published &&
      page.needsLegalReview === args.needsLegalReview;
    if (unchanged) return { version: page.version };
    const diff = diffFields(page, {
      title,
      bodyMd,
      published: args.published,
      needsLegalReview: args.needsLegalReview,
    });
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

/**
 * Step 22 copy fixes on live rows (COPY-02, COPY-03, COPY-04, COPY-14; D233). Each fix replaces
 * the exact seeded sentence, so a text the owner already rewrote is left alone and a second run
 * changes nothing. Run with `npx convex run content:applyCopyFixes`.
 */
const COPY_FIXES: readonly { slug?: string; question?: string; from: string; to: string }[] = [
  {
    question: "Mogu li da vratim deo?",
    from: "Kao potrošač možete odustati od kupovine u roku od 14 dana od prijema, ako deo nije ugrađivan i vraćate ga u originalnom pakovanju. Detalji su na stranici Reklamacije i povrat.",
    to: "Da. Kao potrošač možete da odustanete od kupovine u roku od 14 dana od prijema, bez navođenja razloga. Trošak vraćanja snosite vi; ako je deo ugrađivan ili oštećen, odgovarate za umanjenje vrednosti. Detalji su na stranici [Reklamacije i povrat](/reklamacije-i-povrat).",
  },
  {
    question: "Koliko košta dostava i kada stiže?",
    from: "Delove na stanju šaljemo istog radnog dana za porudžbine potvrđene do 14 časova; kurir obično isporučuje za 1–2 radna dana.",
    to: "Delove na stanju šaljemo istog radnog dana za porudžbine potvrđene do {{dostava.rokSlanja}}. Kurir obično isporučuje za 1–2 radna dana.",
  },
  {
    slug: "dostava-i-placanje",
    from: "Porudžbine potvrđene radnim danom do 14 časova šaljemo istog dana",
    to: "Porudžbine potvrđene radnim danom do {{dostava.rokSlanja}} šaljemo istog dana",
  },
  {
    slug: "kontakt",
    from: "Najbrže je da nas pozovete ili pišete na Viber.",
    to: "{{kontakt.najbrze}}",
  },
  {
    slug: "reklamacije-i-povrat",
    from: "Pošaljite nam izjavu o odustanku e-poštom ({{firma.email|adresa sa stranice Kontakt}}) ili pismom na adresu prodavca.",
    to: "Pošaljite nam izjavu o odustanku putem upita na sajtu. Možete je poslati i e-poštom na {{firma.email}}. Pismom je šaljete na adresu {{firma.adresa}}.",
  },
  {
    slug: "politika-privatnosti",
    from: "{{firma.naziv|Prodavac naveden na stranici Kontakt}}",
    to: "{{firma.naziv|Prodavac sa ovog sajta — podatke o firmi dobijate putem upita na sajtu}}",
  },
  {
    slug: "politika-privatnosti",
    from: "Zahtev pošaljite na {{firma.email|e-poštu sa stranice Kontakt}}; odgovaramo najkasnije u roku od 30 dana.",
    to: "Zahtev pošaljite putem upita na sajtu; odgovaramo najkasnije u roku od 30 dana. Možete pisati i na {{firma.email}}.",
  },
  { slug: "uslovi-koriscenja", from: "Nalog je opcion.", to: "Nalog nije obavezan." },
];

export const applyCopyFixes = internalMutation({
  args: {},
  returns: v.object({ pages: v.array(v.string()), faqs: v.array(v.string()) }),
  handler: async (ctx) => {
    const now = Date.now();
    const pages: string[] = [];
    const faqs: string[] = [];
    for (const slug of new Set(COPY_FIXES.flatMap((f) => (f.slug ? [f.slug] : [])))) {
      const page = await ctx.db
        .query("contentPages")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
      if (!page) continue;
      let bodyMd = page.bodyMd;
      for (const fix of COPY_FIXES)
        if (fix.slug === slug && bodyMd.includes(fix.from))
          bodyMd = bodyMd.replace(fix.from, fix.to);
      if (bodyMd === page.bodyMd) continue;
      await ctx.db.patch("contentPages", page._id, {
        bodyMd,
        version: page.version + 1,
        updatedAt: now,
      });
      pages.push(slug);
      await emitEvent(ctx, {
        type: "content.changed",
        aggregateType: "content",
        aggregateId: page._id,
        payload: { kind: "catalog", slug, section: "page" },
        dedupeKey: `content.changed:${page._id}:${page.version + 1}`,
        actor: SYSTEM_ACTOR,
      });
    }
    for (const scope of new Set(SEED_FAQS.map((f) => f.scope))) {
      for (const faq of await ctx.db
        .query("faqs")
        .withIndex("by_scope_and_sortOrder", (q) => q.eq("scope", scope))
        .take(200)) {
        let answerMd = faq.answerMd;
        for (const fix of COPY_FIXES)
          if (fix.question === faq.question && answerMd.includes(fix.from))
            answerMd = answerMd.replace(fix.from, fix.to);
        if (answerMd === faq.answerMd) continue;
        await ctx.db.patch("faqs", faq._id, { answerMd });
        faqs.push(faq.question);
        await emitEvent(ctx, {
          type: "content.changed",
          aggregateType: "content",
          aggregateId: faq._id,
          payload: { kind: "catalog", section: "faq" },
          dedupeKey: `content.changed:${faq._id}:copy-fixes-22`,
          actor: SYSTEM_ACTOR,
        });
      }
    }
    return { pages, faqs };
  },
});
