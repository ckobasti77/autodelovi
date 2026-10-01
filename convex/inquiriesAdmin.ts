/**
 * Staff inquiry handling: list/detail, assignment, quote drafts (versioned), send, close.
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { foldForSearch } from "../lib/domain/search";
import { endOfBelgradeDay, formatBelgradeDate } from "../lib/domain/time";
import { normalizePhone } from "../lib/format/phone";
import { audit } from "./lib/audit";
import { actorOf, viewerForUser } from "./lib/authz";
import { fail, invalid, notFound } from "./lib/errors";
import { emitEvent } from "./lib/events";
import { staffMutation, staffQuery } from "./lib/functions";
import { classifyAttribution } from "../lib/domain/attribution";
import {
  completeQuoteAcceptance,
  currentSentQuote,
  logInquiryEvent,
  quoteOrderLines,
  quoteTotal,
  setInquiryStatus,
} from "./lib/inquiries";
import { formatDinarsSr } from "./lib/mechanics";
import { createOrder, mechanicOrderTerms, termsFields, validateCheckout } from "./lib/orders";
import { siteUrl } from "./lib/env";
import { statusLinkToken } from "./lib/linkTokens";
import { getSettings } from "./lib/settings";
import { hashToken } from "./lib/tokens";
import {
  actorV,
  addressV,
  attributionV,
  companyV,
  contactV,
  deliveryMethodV,
  inquiryKindV,
  inquiryStatusV,
  paymentMethodV,
  qualityV,
  quoteStatusV,
} from "./lib/validators";

const listRowV = v.object({
  _id: v.id("inquiries"),
  number: v.string(),
  status: inquiryStatusV,
  kind: inquiryKindV,
  contactName: v.string(),
  phone: v.union(v.string(), v.null()),
  preferredChannel: v.string(),
  vin: v.union(v.string(), v.null()),
  vehicleLabel: v.union(v.string(), v.null()),
  message: v.string(),
  photoCount: v.number(),
  assignedTo: v.union(v.id("users"), v.null()),
  assigneeName: v.union(v.string(), v.null()),
  isMechanic: v.boolean(),
  createdAt: v.number(),
  firstResponseAt: v.union(v.number(), v.null()),
  /** Traffic source (lib/domain/attribution): channel key + utm_campaign. */
  channel: v.string(),
  campaign: v.union(v.string(), v.null()),
  isDemo: v.boolean(),
});

function staffName(u: Doc<"users"> | null): string | null {
  if (!u) return null;
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || u.email || null;
}

/**
 * Inquiries list: status via index, full-text search via the search index; kind and
 * „mechanics only“ (priority) are post-filters on the bounded page (D137); „assigned to
 * me“ uses `by_assignedTo_and_status`.
 */
export const list = staffQuery({
  args: {
    status: v.optional(inquiryStatusV),
    search: v.optional(v.string()),
    kind: v.optional(inquiryKindV),
    mine: v.optional(v.boolean()),
    mechanicsOnly: v.optional(v.boolean()),
    /** `google_ads` / `meta_ads` (click ids) or a utm_campaign value (like orders). */
    campaign: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(listRowV),
  handler: async (ctx, args) => {
    const term = args.search?.trim().slice(0, 100);
    const base = term
      ? ctx.db.query("inquiries").withSearchIndex("search_inquiries", (q) => {
          const phone = normalizePhone(term);
          const s = q.search("searchText", phone ? phone.replace(/\D/g, "") : foldForSearch(term));
          if (args.status && args.kind) return s.eq("status", args.status).eq("kind", args.kind);
          if (args.status) return s.eq("status", args.status);
          if (args.kind) return s.eq("kind", args.kind);
          return s;
        })
      : args.mine
        ? ctx.db
            .query("inquiries")
            .withIndex("by_assignedTo_and_status", (q) =>
              args.status
                ? q.eq("assignedTo", ctx.viewer.userId).eq("status", args.status)
                : q.eq("assignedTo", ctx.viewer.userId),
            )
            .order("desc")
        : args.status
          ? ctx.db
              .query("inquiries")
              .withIndex("by_status", (q) => q.eq("status", args.status!))
              .order("desc")
          : ctx.db.query("inquiries").order("desc");
    const kindFilter = !term && args.kind;
    const mineFilter = Boolean(term) && args.mine;
    const campaign = args.campaign?.trim().slice(0, 100);
    const query =
      kindFilter || args.mechanicsOnly || mineFilter || campaign
        ? base.filter((q) =>
            q.and(
              kindFilter ? q.eq(q.field("kind"), args.kind) : true,
              args.mechanicsOnly ? q.neq(q.field("mechanicProfileId"), undefined) : true,
              mineFilter ? q.eq(q.field("assignedTo"), ctx.viewer.userId) : true,
              campaign === "google_ads"
                ? q.or(
                    q.neq(q.field("attribution.last.gclid"), undefined),
                    q.neq(q.field("attribution.last.gbraid"), undefined),
                    q.neq(q.field("attribution.last.wbraid"), undefined),
                  )
                : campaign === "meta_ads"
                  ? q.neq(q.field("attribution.last.fbclid"), undefined)
                  : campaign
                    ? q.or(
                        q.eq(q.field("attribution.last.campaign"), campaign),
                        q.eq(q.field("attribution.first.campaign"), campaign),
                      )
                    : true,
            ),
          )
        : base;
    const result = await query.paginate(args.paginationOpts);
    const names = new Map<string, string | null>();
    const page = [];
    for (const i of result.page) {
      let assigneeName: string | null = null;
      if (i.assignedTo) {
        if (!names.has(i.assignedTo))
          names.set(i.assignedTo, staffName(await ctx.db.get("users", i.assignedTo)));
        assigneeName = names.get(i.assignedTo) ?? null;
      }
      page.push({
        _id: i._id,
        number: i.number,
        status: i.status,
        kind: i.kind,
        contactName: i.contact.name,
        phone: i.contact.phone ?? null,
        preferredChannel: i.contact.preferredChannel,
        vin: i.vin ?? null,
        vehicleLabel: i.vehicle?.label ?? null,
        message: i.message.slice(0, 240),
        photoCount: i.photos.length,
        assignedTo: i.assignedTo ?? null,
        assigneeName,
        isMechanic: i.mechanicProfileId !== undefined,
        createdAt: i._creationTime,
        firstResponseAt: i.firstResponseAt ?? null,
        channel: classifyAttribution(i.attribution).channel,
        campaign: (i.attribution?.last ?? i.attribution?.first)?.campaign?.slice(0, 60) ?? null,
        isDemo: i.isDemo,
      });
    }
    return { ...result, page };
  },
});

/** Counts for the status tabs (open statuses, bounded at 500 each). */
export const statusCounts = staffQuery({
  args: {},
  returns: v.object({
    nov: v.number(),
    u_obradi: v.number(),
    ponuda_poslata: v.number(),
    istekla: v.number(),
    mine: v.number(),
  }),
  handler: async (ctx) => {
    const count = async (status: Doc<"inquiries">["status"]) =>
      (
        await ctx.db
          .query("inquiries")
          .withIndex("by_status", (q) => q.eq("status", status))
          .take(500)
      ).length;
    let mine = 0;
    for (const status of ["nov", "u_obradi", "ponuda_poslata"] as const) {
      mine += (
        await ctx.db
          .query("inquiries")
          .withIndex("by_assignedTo_and_status", (q) =>
            q.eq("assignedTo", ctx.viewer.userId).eq("status", status),
          )
          .take(500)
      ).length;
    }
    return {
      nov: await count("nov"),
      u_obradi: await count("u_obradi"),
      ponuda_poslata: await count("ponuda_poslata"),
      istekla: await count("istekla"),
      mine,
    };
  },
});

const quoteLineInputV = v.object({
  productId: v.optional(v.id("products")),
  sku: v.optional(v.string()),
  name: v.string(),
  manufacturer: v.optional(v.string()),
  quality: v.optional(qualityV),
  quantity: v.number(),
  unitPricePara: v.number(),
  availability: v.union(v.literal("in_stock"), v.literal("on_order")),
  leadTimeDays: v.optional(v.number()),
  note: v.optional(v.string()),
});

async function rebuildStatusLink(inquiry: Doc<"inquiries">): Promise<string | null> {
  const token = await statusLinkToken("inquiry", inquiry.number);
  if ((await hashToken(token)) !== inquiry.publicTokenHash) return null;
  return `${siteUrl()}/upit/${token}`;
}

export const get = staffQuery({
  args: { number: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      inquiry: v.object({
        _id: v.id("inquiries"),
        number: v.string(),
        status: inquiryStatusV,
        kind: inquiryKindV,
        vin: v.union(v.string(), v.null()),
        vehicleLabel: v.union(v.string(), v.null()),
        message: v.string(),
        requestedCodes: v.array(v.string()),
        categorySlugs: v.array(v.string()),
        contact: v.object({
          name: v.string(),
          email: v.optional(v.string()),
          phone: v.optional(v.string()),
          preferredChannel: v.string(),
        }),
        assignedTo: v.union(v.id("users"), v.null()),
        assigneeName: v.union(v.string(), v.null()),
        orderId: v.union(v.id("orders"), v.null()),
        orderNumber: v.union(v.string(), v.null()),
        currentQuoteId: v.union(v.id("quotes"), v.null()),
        createdAt: v.number(),
        updatedAt: v.number(),
        firstResponseAt: v.union(v.number(), v.null()),
        closedReason: v.union(v.string(), v.null()),
        userId: v.union(v.id("users"), v.null()),
        mechanic: v.union(
          v.null(),
          v.object({
            profileId: v.id("mechanicProfiles"),
            companyName: v.string(),
            status: v.string(),
            tierName: v.union(v.string(), v.null()),
          }),
        ),
        product: v.union(
          v.null(),
          v.object({ _id: v.id("products"), sku: v.string(), name: v.string() }),
        ),
        searchQuery: v.union(v.string(), v.null()),
        vinBrandGuess: v.union(v.string(), v.null()),
        vinYearHint: v.union(v.number(), v.null()),
        attribution: v.union(attributionV, v.null()),
        isDemo: v.boolean(),
        /**
         * The customer's status/accept link, rebuilt from the HMAC (D171) so staff can share it
         * by Viber/WhatsApp/SMS when the customer has no e-mail (QA FLOW-13). Null when the
         * stored hash predates the current secret.
         */
        statusLink: v.union(v.string(), v.null()),
      }),
      photos: v.array(
        v.object({ storageId: v.id("_storage"), url: v.union(v.string(), v.null()) }),
      ),
      quotes: v.array(
        v.object({
          _id: v.id("quotes"),
          version: v.number(),
          status: quoteStatusV,
          validUntil: v.number(),
          totalPara: v.number(),
          lines: v.array(quoteLineInputV),
          deliveryNote: v.union(v.string(), v.null()),
          sentAt: v.union(v.number(), v.null()),
        }),
      ),
      events: v.array(
        v.object({
          type: v.string(),
          message: v.union(v.string(), v.null()),
          actor: actorV,
          at: v.number(),
          visibleToCustomer: v.boolean(),
        }),
      ),
      sameVin: v.array(
        v.object({ number: v.string(), status: inquiryStatusV, createdAt: v.number() }),
      ),
    }),
  ),
  handler: async (ctx, { number }) => {
    const inquiry = await ctx.db
      .query("inquiries")
      .withIndex("by_number", (q) => q.eq("number", number))
      .unique();
    if (!inquiry) return null;
    const photos = [];
    for (const storageId of inquiry.photos)
      photos.push({ storageId, url: await ctx.storage.getUrl(storageId) });
    const quotes = await ctx.db
      .query("quotes")
      .withIndex("by_inquiryId_and_version", (q) => q.eq("inquiryId", inquiry._id))
      .order("desc")
      .take(20);
    const events = await ctx.db
      .query("inquiryEvents")
      .withIndex("by_inquiryId_and_at", (q) => q.eq("inquiryId", inquiry._id))
      .take(200);
    const order = inquiry.orderId ? await ctx.db.get("orders", inquiry.orderId) : null;
    const profile = inquiry.mechanicProfileId
      ? await ctx.db.get("mechanicProfiles", inquiry.mechanicProfileId)
      : null;
    const product = inquiry.productId ? await ctx.db.get("products", inquiry.productId) : null;
    const sameVin = inquiry.vin
      ? (
          await ctx.db
            .query("inquiries")
            .withIndex("by_vin", (q) => q.eq("vin", inquiry.vin))
            .take(20)
        )
          .filter((i) => i._id !== inquiry._id)
          .map((i) => ({ number: i.number, status: i.status, createdAt: i._creationTime }))
      : [];
    return {
      inquiry: {
        _id: inquiry._id,
        number: inquiry.number,
        status: inquiry.status,
        kind: inquiry.kind,
        vin: inquiry.vin ?? null,
        vehicleLabel: inquiry.vehicle?.label ?? null,
        message: inquiry.message,
        requestedCodes: inquiry.requestedCodes,
        categorySlugs: inquiry.categorySlugs,
        contact: inquiry.contact,
        assignedTo: inquiry.assignedTo ?? null,
        assigneeName: inquiry.assignedTo
          ? staffName(await ctx.db.get("users", inquiry.assignedTo))
          : null,
        orderId: inquiry.orderId ?? null,
        orderNumber: order?.number ?? null,
        currentQuoteId: inquiry.currentQuoteId ?? null,
        createdAt: inquiry._creationTime,
        updatedAt: inquiry.updatedAt,
        firstResponseAt: inquiry.firstResponseAt ?? null,
        closedReason: inquiry.closedReason ?? null,
        userId: inquiry.userId ?? null,
        mechanic: profile
          ? {
              profileId: profile._id,
              companyName: profile.companyName,
              status: profile.status,
              tierName: profile.tierId
                ? ((await ctx.db.get("priceTiers", profile.tierId))?.name ?? null)
                : null,
            }
          : null,
        product: product ? { _id: product._id, sku: product.sku, name: product.name } : null,
        searchQuery: inquiry.searchQuery ?? null,
        vinBrandGuess: inquiry.vinInfo?.brandGuess ?? null,
        vinYearHint: inquiry.vinInfo?.modelYearHint ?? null,
        attribution: inquiry.attribution ?? null,
        isDemo: inquiry.isDemo,
        statusLink: await rebuildStatusLink(inquiry),
      },
      photos,
      quotes: quotes.map((q) => ({
        _id: q._id,
        version: q.version,
        status: q.status,
        validUntil: q.validUntil,
        totalPara: q.totalPara,
        lines: q.lines,
        deliveryNote: q.deliveryNote ?? null,
        sentAt: q.sentAt ?? null,
      })),
      events: events.map((e) => ({
        type: e.type,
        message: e.message ?? null,
        actor: e.actor,
        at: e.at,
        visibleToCustomer: e.visibleToCustomer,
      })),
      sameVin,
    };
  },
});

export const assign = staffMutation({
  args: { inquiryId: v.id("inquiries"), userId: v.union(v.id("users"), v.null()) },
  returns: v.null(),
  handler: async (ctx, { inquiryId, userId }) => {
    const inquiry = await ctx.db.get("inquiries", inquiryId);
    if (!inquiry) return notFound("Upit ne postoji.");
    let assigneeName = "niko";
    if (userId) {
      const user = await ctx.db.get("users", userId);
      if (!user || (user.role !== "staff" && user.role !== "owner"))
        invalid("Upit se dodeljuje samo zaposlenima.", "userId");
      assigneeName = user.name ?? user.email ?? "zaposleni";
    }
    const actor = actorOf(ctx.viewer);
    await ctx.db.patch("inquiries", inquiryId, {
      assignedTo: userId ?? undefined,
      updatedAt: Date.now(),
    });
    if (inquiry.status === "nov")
      await setInquiryStatus(ctx, inquiry, "u_obradi", { actor, staff: true });
    await logInquiryEvent(ctx, inquiryId, "assigned", actor, `Dodeljeno: ${assigneeName}`, false);
    await audit(ctx, {
      actor,
      action: "inquiry.assign",
      entityType: "inquiry",
      entityId: inquiryId,
      summary: `${inquiry.number}: dodeljeno (${assigneeName})`,
    });
    return null;
  },
});

/** Staff opened the inquiry: `nov` → `u_obradi`. */
export const startProcessing = staffMutation({
  args: { inquiryId: v.id("inquiries") },
  returns: v.null(),
  handler: async (ctx, { inquiryId }) => {
    const inquiry = await ctx.db.get("inquiries", inquiryId);
    if (!inquiry) return notFound("Upit ne postoji.");
    if (inquiry.status !== "nov") return null;
    const actor = actorOf(ctx.viewer);
    await setInquiryStatus(ctx, inquiry, "u_obradi", { actor, staff: true });
    await audit(ctx, {
      actor,
      action: "inquiry.status",
      entityType: "inquiry",
      entityId: inquiryId,
      summary: `${inquiry.number}: u obradi`,
    });
    return null;
  },
});

export const close = staffMutation({
  args: { inquiryId: v.id("inquiries"), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, { inquiryId, reason }) => {
    const inquiry = await ctx.db.get("inquiries", inquiryId);
    if (!inquiry) return notFound("Upit ne postoji.");
    const text = reason.trim().slice(0, 500);
    if (text.length < 3) invalid("Upišite razlog zatvaranja.", "reason");
    const actor = actorOf(ctx.viewer);
    await setInquiryStatus(ctx, inquiry, "odbijena", {
      actor,
      staff: true,
      message: "Upit je zatvoren.",
      extra: { closedReason: text },
    });
    await audit(ctx, {
      actor,
      action: "inquiry.close",
      entityType: "inquiry",
      entityId: inquiryId,
      summary: `${inquiry.number}: zatvoren — ${text}`,
    });
    return null;
  },
});

/**
 * Quote line checks; the field path names the line (`lines.1.quantity`) so the composer can
 * focus it. A draft may keep a line unpriced; a quote that goes out may not (QA FLOW-17).
 */
function validateLines(
  lines: { name: string; quantity: number; unitPricePara: number; leadTimeDays?: number }[],
  opts: { sending?: boolean } = {},
) {
  if (lines.length === 0 || lines.length > 30) invalid("Ponuda ima 1–30 stavki.", "lines");
  lines.forEach((l, i) => {
    const at = `Stavka ${i + 1}`;
    if (!l.name.trim()) invalid(`${at}: upišite naziv.`, `lines.${i}.name`);
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 999)
      invalid(`${at}: količina je ceo broj od 1 do 999.`, `lines.${i}.quantity`);
    if (!Number.isInteger(l.unitPricePara) || l.unitPricePara < 0)
      invalid(`${at}: cena nije ispravna.`, `lines.${i}.price`);
    if (opts.sending && l.unitPricePara === 0)
      invalid(`${at}: upišite cenu pre slanja.`, `lines.${i}.price`);
    if (
      l.leadTimeDays !== undefined &&
      (!Number.isInteger(l.leadTimeDays) || l.leadTimeDays < 0 || l.leadTimeDays > 365)
    ) {
      invalid(`${at}: rok isporuke je 0–365 dana.`, `lines.${i}.leadTimeDays`);
    }
  });
}

/** Creates or updates the latest draft (a new version once the previous one was sent). */
export const saveQuoteDraft = staffMutation({
  args: {
    inquiryId: v.id("inquiries"),
    lines: v.array(quoteLineInputV),
    deliveryNote: v.optional(v.string()),
  },
  returns: v.id("quotes"),
  handler: async (ctx, { inquiryId, lines, deliveryNote }) => {
    const inquiry = await ctx.db.get("inquiries", inquiryId);
    if (!inquiry) return notFound("Upit ne postoji.");
    if (inquiry.status === "prihvacena" || inquiry.status === "odbijena")
      fail("CONFLICT", "Upit je zatvoren.");
    validateLines(lines);
    for (const l of lines) {
      if (l.productId && !(await ctx.db.get("products", l.productId)))
        invalid("Artikal iz ponude ne postoji.", "lines");
    }
    const cleanLines = lines.map((l) => ({
      ...l,
      name: l.name.trim().slice(0, 160),
      ...(l.note ? { note: l.note.slice(0, 300) } : {}),
    }));
    const latest = await ctx.db
      .query("quotes")
      .withIndex("by_inquiryId_and_version", (q) => q.eq("inquiryId", inquiryId))
      .order("desc")
      .first();
    const actor = actorOf(ctx.viewer);
    const fields = {
      lines: cleanLines,
      totalPara: quoteTotal(cleanLines),
      ...(deliveryNote ? { deliveryNote: deliveryNote.slice(0, 500) } : {}),
    };
    let quoteId;
    if (latest && latest.status === "draft") {
      await ctx.db.patch("quotes", latest._id, fields);
      quoteId = latest._id;
    } else {
      quoteId = await ctx.db.insert("quotes", {
        inquiryId,
        version: (latest?.version ?? 0) + 1,
        status: "draft",
        validUntil: 0,
        ...fields,
        ...(inquiry.isDemo ? { isDemo: true } : {}),
      });
    }
    if (inquiry.status === "nov")
      await setInquiryStatus(ctx, inquiry, "u_obradi", { actor, staff: true });
    await audit(ctx, {
      actor,
      action: "quote.save_draft",
      entityType: "inquiry",
      entityId: inquiryId,
      summary: `${inquiry.number}: nacrt ponude`,
    });
    return quoteId;
  },
});

export const sendQuote = staffMutation({
  args: { quoteId: v.id("quotes") },
  returns: v.object({ validUntil: v.number() }),
  handler: async (ctx, { quoteId }) => {
    const quote = await ctx.db.get("quotes", quoteId);
    if (!quote) return notFound("Ponuda ne postoji.");
    if (quote.status !== "draft") fail("CONFLICT", "Poslati se može samo nacrt ponude.");
    const inquiry = await ctx.db.get("inquiries", quote.inquiryId);
    if (!inquiry) return notFound("Upit ne postoji.");
    validateLines(quote.lines, { sending: true });
    const settings = await getSettings(ctx);
    const now = Date.now();
    const validUntil = endOfBelgradeDay(now, settings.commerce.quoteValidityDays);
    const actor = actorOf(ctx.viewer);
    if (inquiry.currentQuoteId && inquiry.currentQuoteId !== quoteId) {
      const previous = await ctx.db.get("quotes", inquiry.currentQuoteId);
      if (previous && (previous.status === "sent" || previous.status === "expired")) {
        await ctx.db.patch("quotes", previous._id, { status: "superseded" });
      }
    }
    await ctx.db.patch("quotes", quoteId, {
      status: "sent",
      sentAt: now,
      sentBy: ctx.viewer.userId,
      validUntil,
    });
    await setInquiryStatus(ctx, inquiry, "ponuda_poslata", {
      actor,
      staff: true,
      message: `Ponuda je poslata (važi do ${formatBelgradeDate(validUntil)}).`,
      extra: { currentQuoteId: quoteId },
    });
    await logInquiryEvent(
      ctx,
      inquiry._id,
      "quote_sent",
      actor,
      `Ponuda br. ${quote.version} poslata`,
      false,
    );
    await emitEvent(ctx, {
      type: "quote.sent",
      aggregateType: "quote",
      aggregateId: quoteId,
      payload: {
        kind: "inquiry",
        inquiryId: inquiry._id,
        number: inquiry.number,
        quoteId,
        version: quote.version,
      },
      dedupeKey: `quote.sent:${quoteId}`,
      actor,
    });
    await audit(ctx, {
      actor,
      action: "quote.send",
      entityType: "inquiry",
      entityId: inquiry._id,
      summary: `${inquiry.number}: poslata ponuda br. ${quote.version}`,
    });
    return { validUntil };
  },
});

export const addNote = staffMutation({
  args: { inquiryId: v.id("inquiries"), message: v.string() },
  returns: v.null(),
  handler: async (ctx, { inquiryId, message }) => {
    const inquiry = await ctx.db.get("inquiries", inquiryId);
    if (!inquiry) return notFound("Upit ne postoji.");
    const text = message.trim().slice(0, 1_000);
    if (!text) invalid("Napomena je prazna.", "message");
    const actor = actorOf(ctx.viewer);
    await logInquiryEvent(ctx, inquiryId, "note", actor, text, false);
    await ctx.db.patch("inquiries", inquiryId, { lastStaffActionAt: Date.now() });
    await audit(ctx, {
      actor,
      action: "inquiry.note",
      entityType: "inquiry",
      entityId: inquiryId,
      summary: `${inquiry.number}: napomena`,
    });
    return null;
  },
});

/**
 * Staff converts the current sent quote into an order (the customer accepted by phone,
 * Viber or in the shop). Same line mapping and bookkeeping as the customer's accept link;
 * payment rules are checked for the inquiry's account (deferred only for its mechanic).
 */
export const convertToOrder = staffMutation({
  args: {
    quoteId: v.id("quotes"),
    contact: contactV,
    company: v.optional(companyV),
    delivery: v.object({ method: deliveryMethodV, address: v.optional(addressV) }),
    payment: v.object({ method: paymentMethodV }),
    note: v.optional(v.string()),
    /** Staff explicitly lets a deferred order exceed the mechanic's credit (audited). */
    creditOverride: v.optional(v.boolean()),
  },
  returns: v.object({ orderNumber: v.string() }),
  handler: async (ctx, args) => {
    const quote = await ctx.db.get("quotes", args.quoteId);
    if (!quote) return notFound("Ponuda ne postoji.");
    const inquiry = await ctx.db.get("inquiries", quote.inquiryId);
    if (!inquiry) return notFound("Upit ne postoji.");
    await currentSentQuote(ctx, inquiry, quote._id);
    const settings = await getSettings(ctx);
    const customer = inquiry.userId ? await viewerForUser(ctx, inquiry.userId) : null;
    const checkout = validateCheckout(
      {
        contact: args.contact,
        ...(args.company ? { company: args.company } : {}),
        delivery: args.delivery,
        payment: args.payment,
        ...(inquiry.vehicle ? { vehicle: inquiry.vehicle } : {}),
        ...(args.note ? { note: args.note } : {}),
        consent: {
          termsVersion: settings.legalVersions.terms,
          privacyVersion: settings.legalVersions.privacy,
          acceptedAt: Date.now(),
          marketingEmail: false,
          analytics: false,
          ads: false,
        },
      },
      settings,
      customer,
      // A customer who asked by phone/Viber/WhatsApp without an e-mail keeps none (D223).
      { emailOptional: !inquiry.contact.email },
    );
    const lines = await quoteOrderLines(ctx, quote);
    const terms = await mechanicOrderTerms(ctx, customer, checkout, lines, {
      allowCreditOverride: args.creditOverride === true,
    });
    const actor = actorOf(ctx.viewer);
    const order = await createOrder(ctx, {
      checkout,
      lines,
      customerType: terms ? "mechanic" : inquiry.userId ? "customer" : "guest",
      ...(inquiry.userId ? { userId: inquiry.userId } : {}),
      ...termsFields(terms),
      ...(inquiry.attribution ? { attribution: inquiry.attribution } : {}),
      source: "admin",
      inquiryId: inquiry._id,
      quoteId: quote._id,
      isDemo: inquiry.isDemo,
      actor,
    });
    await completeQuoteAcceptance(ctx, { inquiry, quote, order, actor, staff: true });
    const remarks = [
      ...(checkout.contact.email ? [] : ["kupac bez e-pošte"]),
      ...(terms?.creditOverride
        ? [
            `prekoračen limit odloženog plaćanja (preostalo ${formatDinarsSr(terms.creditOverride.availablePara)}, porudžbina ${formatDinarsSr(terms.creditOverride.totalPara)})`,
          ]
        : []),
    ];
    await audit(ctx, {
      actor,
      action: "quote.convert",
      entityType: "inquiry",
      entityId: inquiry._id,
      summary: `${inquiry.number}: ponuda br. ${quote.version} → porudžbina ${order.number}${remarks.length ? ` (${remarks.join("; ")})` : ""}`,
    });
    return { orderNumber: order.number };
  },
});
