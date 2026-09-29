/**
 * Staff inquiry handling: list/detail, assignment, quote drafts (versioned), send, close.
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import { endOfBelgradeDay, formatBelgradeDate } from "../lib/domain/time";
import { audit } from "./lib/audit";
import { actorOf } from "./lib/authz";
import { fail, invalid, notFound } from "./lib/errors";
import { emitEvent } from "./lib/events";
import { staffMutation, staffQuery } from "./lib/functions";
import { logInquiryEvent, quoteTotal, setInquiryStatus } from "./lib/inquiries";
import { getSettings } from "./lib/settings";
import { actorV, inquiryKindV, inquiryStatusV, qualityV, quoteStatusV } from "./lib/validators";

const listRowV = v.object({
  _id: v.id("inquiries"),
  number: v.string(),
  status: inquiryStatusV,
  kind: inquiryKindV,
  contactName: v.string(),
  vin: v.union(v.string(), v.null()),
  vehicleLabel: v.union(v.string(), v.null()),
  message: v.string(),
  photoCount: v.number(),
  assignedTo: v.union(v.id("users"), v.null()),
  createdAt: v.number(),
  firstResponseAt: v.union(v.number(), v.null()),
  isDemo: v.boolean(),
});

export const list = staffQuery({
  args: {
    status: v.optional(inquiryStatusV),
    search: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(listRowV),
  handler: async (ctx, { status, search, paginationOpts }) => {
    const term = search?.trim().slice(0, 100).toLowerCase();
    const result = term
      ? await ctx.db
          .query("inquiries")
          .withSearchIndex("search_inquiries", (q) =>
            status
              ? q.search("searchText", term).eq("status", status)
              : q.search("searchText", term),
          )
          .paginate(paginationOpts)
      : status
        ? await ctx.db
            .query("inquiries")
            .withIndex("by_status", (q) => q.eq("status", status))
            .order("desc")
            .paginate(paginationOpts)
        : await ctx.db.query("inquiries").order("desc").paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((i) => ({
        _id: i._id,
        number: i.number,
        status: i.status,
        kind: i.kind,
        contactName: i.contact.name,
        vin: i.vin ?? null,
        vehicleLabel: i.vehicle?.label ?? null,
        message: i.message.slice(0, 240),
        photoCount: i.photos.length,
        assignedTo: i.assignedTo ?? null,
        createdAt: i._creationTime,
        firstResponseAt: i.firstResponseAt ?? null,
        isDemo: i.isDemo,
      })),
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
        orderId: v.union(v.id("orders"), v.null()),
        currentQuoteId: v.union(v.id("quotes"), v.null()),
        createdAt: v.number(),
        updatedAt: v.number(),
        closedReason: v.union(v.string(), v.null()),
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
        orderId: inquiry.orderId ?? null,
        currentQuoteId: inquiry.currentQuoteId ?? null,
        createdAt: inquiry._creationTime,
        updatedAt: inquiry.updatedAt,
        closedReason: inquiry.closedReason ?? null,
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

function validateLines(
  lines: { name: string; quantity: number; unitPricePara: number; leadTimeDays?: number }[],
) {
  if (lines.length === 0 || lines.length > 30) invalid("Ponuda ima 1–30 stavki.", "lines");
  for (const l of lines) {
    if (!l.name.trim()) invalid("Svaka stavka mora imati naziv.", "lines");
    if (!Number.isInteger(l.quantity) || l.quantity < 1 || l.quantity > 999)
      invalid("Količina 1–999.", "lines");
    if (!Number.isInteger(l.unitPricePara) || l.unitPricePara < 0)
      invalid("Neispravna cena stavke.", "lines");
    if (
      l.leadTimeDays !== undefined &&
      (!Number.isInteger(l.leadTimeDays) || l.leadTimeDays < 0 || l.leadTimeDays > 365)
    ) {
      invalid("Rok isporuke 0–365 dana.", "lines");
    }
  }
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
    validateLines(quote.lines);
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
      `Ponuda v${quote.version} poslata`,
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
      summary: `${inquiry.number}: poslata ponuda v${quote.version}`,
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
