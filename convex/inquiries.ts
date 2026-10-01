/**
 * Customer-side inquiries (docs/ARCHITECTURE.md §A2): VIN/part inquiry with photos,
 * tokenized status + quote page, accept → order, decline, renewal request.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { normalizeCode } from "../lib/domain/codes";
import { isValidEmail, normalizeEmail } from "../lib/domain/identifiers";
import { decodeVin } from "../lib/domain/vin";
import { normalizePhone } from "../lib/format/phone";
import { actorOf, type Viewer } from "./lib/authz";
import { fail, invalid, notFound } from "./lib/errors";
import { emitEvent } from "./lib/events";
import { publicMutation, publicQuery, userQuery } from "./lib/functions";
import {
  completeQuoteAcceptance,
  currentSentQuote,
  insertInquiry,
  logInquiryEvent,
  quoteOrderLines,
  setInquiryStatus,
} from "./lib/inquiries";
import { consentInForce, sanitizeAttribution } from "./lib/attribution";
import { createOrder, mechanicOrderTerms, termsFields, validateCheckout } from "./lib/orders";
import { creditStatus } from "./lib/mechanics";
import { enforceRateLimit } from "./lib/rateLimits";
import { resolveEmailConfig } from "./lib/emailConfig";
import { getSettings } from "./lib/settings";
import { hashToken, isTokenShape } from "./lib/tokens";
import {
  addressV,
  attributionV,
  companyV,
  consentV,
  contactV,
  deliveryMethodV,
  inquiryKindV,
  inquiryStatusV,
  paymentMethodV,
  preferredChannelV,
  qualityV,
  quoteStatusV,
  vehicleSnapshotV,
} from "./lib/validators";

const MIN_FORM_MS = 3_000;
export const MAX_PHOTOS = 5;
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
];

/** Rate-limited upload URL for inquiry photos (the file is checked when attached). */
export const generateUploadUrl = publicMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await enforceRateLimit(ctx, "uploadUrl", ctx.client.key);
    return await ctx.storage.generateUploadUrl();
  },
});

async function attachPhotos(
  ctx: MutationCtx,
  photos: Id<"_storage">[],
  uploaderKey: string,
  inquiryId: Id<"inquiries">,
): Promise<void> {
  for (const storageId of photos) {
    await ctx.db.insert("uploads", {
      storageId,
      purpose: "inquiry_photo",
      uploaderKey,
      status: "attached",
      attachedTo: { type: "inquiry", id: inquiryId },
    });
    await ctx.scheduler.runAfter(0, internal.files.sniff, { storageId });
  }
}

async function checkPhotos(ctx: MutationCtx, photos: Id<"_storage">[]): Promise<void> {
  if (photos.length > MAX_PHOTOS) invalid("Najviše 5 fotografija.", "photos");
  if (new Set(photos).size !== photos.length)
    invalid("Ista fotografija je dodata dva puta.", "photos");
  for (const storageId of photos) {
    const meta = await ctx.db.system.get("_storage", storageId);
    if (!meta) invalid("Fotografija nije otpremljena. Pokušajte ponovo.", "photos");
    if (meta.size > MAX_PHOTO_BYTES) invalid("Fotografija je veća od 8 MB.", "photos");
    // A declared type must be an image; the magic-byte sniff after attaching is authoritative.
    if (meta.contentType && !PHOTO_TYPES.includes(meta.contentType)) {
      invalid("Dozvoljene su fotografije JPG, PNG, WebP, AVIF ili HEIC.", "photos");
    }
    const used = await ctx.db
      .query("uploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .first();
    if (used) invalid("Fotografija je već iskorišćena.", "photos");
  }
}

export const submit = publicMutation({
  args: {
    kind: inquiryKindV,
    vin: v.optional(v.string()),
    vehicle: v.optional(vehicleSnapshotV),
    message: v.string(),
    categorySlugs: v.optional(v.array(v.string())),
    productId: v.optional(v.id("products")),
    searchQuery: v.optional(v.string()),
    requestedCodes: v.optional(v.array(v.string())),
    photos: v.optional(v.array(v.id("_storage"))),
    contact: v.object({
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      preferredChannel: preferredChannelV,
    }),
    consent: consentV,
    attribution: v.optional(attributionV),
    /** Page the inquiry was sent from (Meta CAPI `event_source_url`). */
    eventSourceUrl: v.optional(v.string()),
    honeypot: v.string(),
    startedAt: v.number(),
  },
  returns: v.object({ number: v.string(), token: v.string() }),
  handler: async (ctx, args) => {
    const now = Date.now();
    if (args.honeypot.trim() !== "") fail("SPAM", "Upit nije poslat. Pozovite nas telefonom.");
    if (now - args.startedAt < MIN_FORM_MS) fail("SPAM", "Pokušajte ponovo za nekoliko sekundi.");
    await enforceRateLimit(ctx, "inquirySubmit", ctx.client.key);

    const name = args.contact.name.trim().slice(0, 80);
    if (!name) invalid("Upišite ime.", "contact.name");
    const email = args.contact.email?.trim() ? normalizeEmail(args.contact.email) : undefined;
    if (email && !isValidEmail(email)) invalid("Upišite ispravnu e-mail adresu.", "contact.email");
    const phone = args.contact.phone?.trim() ? normalizePhone(args.contact.phone) : undefined;
    if (args.contact.phone?.trim() && !phone)
      invalid("Upišite ispravan broj telefona.", "contact.phone");
    if (!email && !phone)
      invalid("Ostavite telefon ili e-mail da bismo vam odgovorili.", "contact");
    if (args.contact.preferredChannel === "email" && !email)
      invalid("Za odgovor e-mailom upišite e-mail adresu.", "contact.email");
    if (args.contact.preferredChannel !== "email" && !phone)
      invalid("Za odgovor telefonom ili porukom upišite broj telefona.", "contact.phone");

    const message = args.message.trim().slice(0, 2_000);
    if (message.length < 3) invalid("Napišite šta vam treba.", "message");
    const categorySlugs = (args.categorySlugs ?? []).slice(0, 5).map((s) => s.slice(0, 80));
    const requestedCodes = [
      ...new Set(
        (args.requestedCodes ?? []).map((c) => normalizeCode(c)).filter((c) => c.length >= 3),
      ),
    ].slice(0, 50);
    const photos = args.photos ?? [];
    await checkPhotos(ctx, photos);

    let vin: string | undefined;
    let vinInfo: Doc<"inquiries">["vinInfo"];
    if (args.vin?.trim()) {
      const decoded = decodeVin(args.vin);
      if (!decoded.validation.valid)
        invalid("Broj šasije (VIN) ima 17 znakova, bez slova I, O i Q.", "vin");
      vin = decoded.normalized;
      vinInfo = {
        wmi: decoded.wmi.wmi,
        ...(decoded.wmi.make ? { brandGuess: decoded.wmi.make } : {}),
        ...(decoded.modelYear !== null ? { modelYearHint: decoded.modelYear } : {}),
        ...(decoded.modelCode ? { modelCode: decoded.modelCode } : {}),
      };
    }
    if (args.kind === "vin" && !vin) invalid("Upišite broj šasije (VIN).", "vin");
    if (args.productId) {
      const product = await ctx.db.get("products", args.productId);
      if (!product) invalid("Artikal ne postoji.", "productId");
    }

    const viewer = ctx.viewer;
    const attribution = sanitizeAttribution(args.attribution);
    const { inquiryId, number, token } = await insertInquiry(ctx, {
      kind: args.kind,
      ...(vin ? { vin } : {}),
      ...(vinInfo ? { vinInfo } : {}),
      ...(args.vehicle
        ? { vehicle: { ...args.vehicle, label: args.vehicle.label.slice(0, 120) } }
        : {}),
      message,
      categorySlugs,
      ...(args.productId ? { productId: args.productId } : {}),
      ...(args.searchQuery ? { searchQuery: args.searchQuery.slice(0, 200) } : {}),
      requestedCodes,
      photos,
      contact: {
        name,
        ...(email ? { email } : {}),
        ...(phone ? { phone } : {}),
        preferredChannel: args.contact.preferredChannel,
      },
      ...(viewer ? { userId: viewer.userId } : {}),
      ...(viewer?.mechanic ? { mechanicProfileId: viewer.mechanic.profileId } : {}),
      ...(attribution ? { attribution } : {}),
      consent: consentInForce(await getSettings(ctx), args.consent, Date.now()),
      actor: viewer ? actorOf(viewer) : { type: "customer" as const, name },
      ...(ctx.client.ip && ctx.client.userAgent
        ? {
            capiContext: {
              ip: ctx.client.ip,
              userAgent: ctx.client.userAgent,
              eventSourceUrl: (args.eventSourceUrl ?? "").slice(0, 500),
            },
          }
        : {}),
    });
    await attachPhotos(ctx, photos, ctx.client.key, inquiryId);
    return { number, token };
  },
});

const quoteLineV = v.object({
  productId: v.union(v.id("products"), v.null()),
  productSlug: v.union(v.string(), v.null()),
  sku: v.union(v.string(), v.null()),
  name: v.string(),
  manufacturer: v.union(v.string(), v.null()),
  quality: v.union(qualityV, v.null()),
  quantity: v.number(),
  unitPricePara: v.number(),
  lineTotalPara: v.number(),
  availability: v.union(v.literal("in_stock"), v.literal("on_order")),
  leadTimeDays: v.union(v.number(), v.null()),
  note: v.union(v.string(), v.null()),
});

export const getByToken = publicQuery({
  args: { token: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      number: v.string(),
      status: inquiryStatusV,
      kind: inquiryKindV,
      createdAt: v.number(),
      vin: v.union(v.string(), v.null()),
      vehicleLabel: v.union(v.string(), v.null()),
      message: v.string(),
      photoCount: v.number(),
      contactName: v.string(),
      preferredChannel: preferredChannelV,
      quote: v.union(
        v.null(),
        v.object({
          quoteId: v.id("quotes"),
          version: v.number(),
          status: quoteStatusV,
          validUntil: v.number(),
          sentAt: v.union(v.number(), v.null()),
          lines: v.array(quoteLineV),
          totalPara: v.number(),
          deliveryNote: v.union(v.string(), v.null()),
        }),
      ),
      orderNumber: v.union(v.string(), v.null()),
      closedReason: v.union(v.string(), v.null()),
      timeline: v.array(
        v.object({ type: v.string(), message: v.union(v.string(), v.null()), at: v.number() }),
      ),
      /** True when the quote and changes also go out by e-mail (address given, mode test/live). */
      emailUpdates: v.boolean(),
      /** The requester's own phone / e-mail from the inquiry, to prefill the accept form. */
      prefill: v.object({
        phone: v.union(v.string(), v.null()),
        email: v.union(v.string(), v.null()),
      }),
      /**
       * Deferred payment for the signed-in approved mechanic who owns the inquiry (credit on);
       * `availablePara` null means no limit. Null for everyone else (QA FLOW-08).
       */
      deferredCredit: v.union(v.null(), v.object({ availablePara: v.union(v.number(), v.null()) })),
    }),
  ),
  handler: async (ctx, { token }) => {
    if (!isTokenShape(token)) return null;
    const tokenHash = await hashToken(token);
    const inquiry = await ctx.db
      .query("inquiries")
      .withIndex("by_publicTokenHash", (q) => q.eq("publicTokenHash", tokenHash))
      .unique();
    if (!inquiry) return null;
    const quoteDoc = inquiry.currentQuoteId
      ? await ctx.db.get("quotes", inquiry.currentQuoteId)
      : null;
    // Drafts are internal; the customer sees a quote only once it has been sent.
    const quote = quoteDoc && quoteDoc.status !== "draft" ? quoteDoc : null;
    const lines = [];
    for (const l of quote?.lines ?? []) {
      const product = l.productId ? await ctx.db.get("products", l.productId) : null;
      lines.push({
        productId: l.productId ?? null,
        productSlug: product?.slug ?? null,
        sku: l.sku ?? null,
        name: l.name,
        manufacturer: l.manufacturer ?? null,
        quality: l.quality ?? null,
        quantity: l.quantity,
        unitPricePara: l.unitPricePara,
        lineTotalPara: l.quantity * l.unitPricePara,
        availability: l.availability,
        leadTimeDays: l.leadTimeDays ?? null,
        note: l.note ?? null,
      });
    }
    const order = inquiry.orderId ? await ctx.db.get("orders", inquiry.orderId) : null;
    const events = await ctx.db
      .query("inquiryEvents")
      .withIndex("by_inquiryId_and_at", (q) => q.eq("inquiryId", inquiry._id))
      .take(100);
    return {
      number: inquiry.number,
      status: inquiry.status,
      kind: inquiry.kind,
      createdAt: inquiry._creationTime,
      vin: inquiry.vin ?? null,
      vehicleLabel: inquiry.vehicle?.label ?? null,
      message: inquiry.message,
      photoCount: inquiry.photos.length,
      contactName: inquiry.contact.name,
      preferredChannel: inquiry.contact.preferredChannel,
      quote: quote
        ? {
            quoteId: quote._id,
            version: quote.version,
            status: quote.status,
            validUntil: quote.validUntil,
            sentAt: quote.sentAt ?? null,
            lines,
            totalPara: quote.totalPara,
            deliveryNote: quote.deliveryNote ?? null,
          }
        : null,
      orderNumber: order?.number ?? null,
      closedReason: inquiry.closedReason ?? null,
      timeline: events
        .filter((e) => e.visibleToCustomer)
        .map((e) => ({ type: e.type, message: e.message ?? null, at: e.at })),
      emailUpdates:
        Boolean(inquiry.contact.email) &&
        !inquiry.isDemo &&
        !inquiry.isTest &&
        resolveEmailConfig(await getSettings(ctx)).effective !== "log",
      prefill: { phone: inquiry.contact.phone ?? null, email: inquiry.contact.email ?? null },
      deferredCredit: await deferredCreditFor(ctx, inquiry),
    };
  },
});

async function deferredCreditFor(
  ctx: QueryCtx & { viewer: Viewer | null },
  inquiry: Doc<"inquiries">,
): Promise<{ availablePara: number | null } | null> {
  const viewer = ctx.viewer;
  const m = viewer?.mechanic;
  if (!viewer || !m || m.status !== "approved" || !m.creditEnabled) return null;
  if (inquiry.userId && inquiry.userId !== viewer.userId) return null;
  const profile = await ctx.db.get("mechanicProfiles", m.profileId);
  if (!profile) return null;
  const credit = await creditStatus(ctx, profile);
  return credit.enabled ? { availablePara: credit.availablePara } : null;
}

async function inquiryByToken(ctx: MutationCtx, token: string): Promise<Doc<"inquiries">> {
  if (!isTokenShape(token)) return notFound("Upit nije pronađen.");
  const tokenHash = await hashToken(token);
  await enforceRateLimit(ctx, "tokenAction", tokenHash);
  const inquiry = await ctx.db
    .query("inquiries")
    .withIndex("by_publicTokenHash", (q) => q.eq("publicTokenHash", tokenHash))
    .unique();
  return inquiry ?? notFound("Upit nije pronađen.");
}

export const acceptQuote = publicMutation({
  args: {
    token: v.string(),
    quoteId: v.id("quotes"),
    contact: contactV,
    company: v.optional(companyV),
    delivery: v.object({ method: deliveryMethodV, address: v.optional(addressV) }),
    payment: v.object({ method: paymentMethodV }),
    note: v.optional(v.string()),
    consent: consentV,
  },
  returns: v.object({ orderNumber: v.string(), orderToken: v.string() }),
  handler: async (ctx, args) => {
    const inquiry = await inquiryByToken(ctx, args.token);
    const quote = await currentSentQuote(ctx, inquiry, args.quoteId);
    const settings = await getSettings(ctx);
    const viewer = ctx.viewer;
    // The token is the authorization; mechanic terms (tier, credit, payment terms) apply only
    // when the signed-in mechanic is the inquiry's own account (or it has none).
    const ownsInquiry = viewer !== null && (!inquiry.userId || inquiry.userId === viewer.userId);
    const buyer = viewer && !ownsInquiry ? { ...viewer, mechanic: null } : viewer;
    const checkout = validateCheckout(
      {
        contact: args.contact,
        ...(args.company ? { company: args.company } : {}),
        delivery: args.delivery,
        payment: args.payment,
        ...(inquiry.vehicle ? { vehicle: inquiry.vehicle } : {}),
        ...(args.note ? { note: args.note } : {}),
        consent: args.consent,
      },
      settings,
      buyer,
    );
    const lines = await quoteOrderLines(ctx, quote);
    const terms = await mechanicOrderTerms(ctx, buyer, checkout, lines);
    const actor = viewer
      ? actorOf(viewer)
      : { type: "customer" as const, name: inquiry.contact.name };
    const order = await createOrder(ctx, {
      checkout,
      lines,
      customerType: terms ? "mechanic" : buyer ? "customer" : "guest",
      ...(ownsInquiry && viewer
        ? { userId: viewer.userId }
        : inquiry.userId
          ? { userId: inquiry.userId }
          : {}),
      ...termsFields(terms),
      ...(inquiry.attribution ? { attribution: inquiry.attribution } : {}),
      source: "inquiry",
      inquiryId: inquiry._id,
      quoteId: quote._id,
      isDemo: inquiry.isDemo,
      actor,
    });
    await completeQuoteAcceptance(ctx, { inquiry, quote, order, actor, staff: false });
    return { orderNumber: order.number, orderToken: order.token };
  },
});

export const declineQuote = publicMutation({
  args: { token: v.string(), quoteId: v.id("quotes"), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const inquiry = await inquiryByToken(ctx, args.token);
    const quote = await currentSentQuote(ctx, inquiry, args.quoteId);
    const reason = args.reason?.trim().slice(0, 500);
    const actor = ctx.viewer
      ? actorOf(ctx.viewer)
      : { type: "customer" as const, name: inquiry.contact.name };
    await ctx.db.patch("quotes", quote._id, {
      status: "declined",
      declinedAt: Date.now(),
      ...(reason ? { declineReason: reason } : {}),
    });
    await setInquiryStatus(ctx, inquiry, "odbijena", {
      actor,
      staff: false,
      message: "Ponuda je odbijena.",
      extra: { closedReason: reason ? `Kupac: ${reason}` : "Kupac je odbio ponudu." },
    });
    await logInquiryEvent(
      ctx,
      inquiry._id,
      "quote_declined",
      actor,
      reason ?? "Bez razloga",
      false,
    );
    await emitEvent(ctx, {
      type: "quote.declined",
      aggregateType: "quote",
      aggregateId: quote._id,
      payload: {
        kind: "inquiry",
        inquiryId: inquiry._id,
        number: inquiry.number,
        quoteId: quote._id,
        ...(reason ? { reason } : {}),
      },
      dedupeKey: `quote.declined:${quote._id}`,
      actor,
    });
    return null;
  },
});

/** „Zatraži obnovljenu ponudu“ after expiry: back to `u_obradi`, staff notified. */
export const requestRenewal = publicMutation({
  args: { token: v.string() },
  returns: v.null(),
  handler: async (ctx, { token }) => {
    const inquiry = await inquiryByToken(ctx, token);
    if (inquiry.status !== "istekla") fail("CONFLICT", "Obnova se traži samo za isteklu ponudu.");
    const actor = ctx.viewer
      ? actorOf(ctx.viewer)
      : { type: "customer" as const, name: inquiry.contact.name };
    await setInquiryStatus(ctx, inquiry, "u_obradi", {
      actor,
      staff: false,
      message: "Zatražena je obnovljena ponuda.",
    });
    await logInquiryEvent(
      ctx,
      inquiry._id,
      "renewal_requested",
      actor,
      "Kupac traži obnovljenu ponudu.",
      false,
    );
    await emitEvent(ctx, {
      type: "quote.renewal_requested",
      aggregateType: "inquiry",
      aggregateId: inquiry._id,
      payload: { kind: "inquiry", inquiryId: inquiry._id, number: inquiry.number },
      dedupeKey: `quote.renewal_requested:${inquiry._id}:${Date.now()}`,
      actor,
    });
    return null;
  },
});

export const mine = userQuery({
  args: {},
  returns: v.array(
    v.object({
      number: v.string(),
      status: inquiryStatusV,
      createdAt: v.number(),
      message: v.string(),
      vehicleLabel: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("inquiries")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewer.userId))
      .order("desc")
      .take(100);
    return rows.map((i) => ({
      number: i.number,
      status: i.status,
      createdAt: i._creationTime,
      message: i.message.slice(0, 200),
      vehicleLabel: i.vehicle?.label ?? null,
    }));
  },
});
