/**
 * Data-subject requests under ZZPL (docs/PRIVACY-PROCESS.md, docs/SECURITY.md §L5), owner only:
 *
 * - `customerData` — everything stored about one person (account and/or e-mail address used
 *   as a guest), as JSON for the access/portability answer.
 * - `anonymize` — erasure. Orders stay (accounting obligation, 10 years) with the personal
 *   contact replaced; company data (a legal entity) stays. Inquiries without an order,
 *   photos, saved vehicles, favorites, carts, subscriptions, notifications, staff notes, the
 *   e-mail copies and the login itself are deleted. Works in bounded passes and is
 *   idempotent: call again while `done` is false.
 *
 * The audit log keeps who ran the request, never the person's data.
 */
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { isValidEmail, normalizeEmail } from "../lib/domain/identifiers";
import { buildSearchText } from "../lib/domain/search";
import { audit } from "./lib/audit";
import { actorOf } from "./lib/authz";
import { fail, invalid } from "./lib/errors";
import { ownerMutation, ownerQuery } from "./lib/functions";

/** Records per table in one export / one anonymization pass. */
const LIMIT = 100;
export const ANONYMIZE_PHRASE = "ANONIMIZUJ";
const ANON_NAME = "Anonimizovano";

type Subject = { user: Doc<"users"> | null; email: string | null };

async function resolveSubject(
  ctx: QueryCtx,
  args: { userId?: Id<"users">; email?: string },
): Promise<Subject> {
  let user = args.userId ? await ctx.db.get("users", args.userId) : null;
  let email = args.email?.trim() ? normalizeEmail(args.email) : null;
  if (email && !isValidEmail(email))
    invalid("Adresa e-pošte nije ispravna. Primer: ime@primer.rs.", "email");
  if (!user && email) {
    const e = email;
    user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", e))
      .first();
  }
  if (!email && user?.email) email = normalizeEmail(user.email);
  if (!user && !email) invalid("Izaberite kupca ili upišite adresu e-pošte.");
  return { user, email };
}

/** Orders of the subject: by account and by the contact e-mail used as a guest. */
async function subjectOrders(ctx: QueryCtx, s: Subject): Promise<Doc<"orders">[]> {
  const found = new Map<Id<"orders">, Doc<"orders">>();
  if (s.user) {
    const userId = s.user._id;
    for (const o of await ctx.db
      .query("orders")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(LIMIT))
      found.set(o._id, o);
  }
  if (s.email) {
    const email = s.email;
    for (const o of await ctx.db
      .query("orders")
      .withIndex("by_contact_email", (q) => q.eq("contact.email", email))
      .take(LIMIT))
      found.set(o._id, o);
  }
  return [...found.values()];
}

async function subjectInquiries(ctx: QueryCtx, s: Subject): Promise<Doc<"inquiries">[]> {
  const found = new Map<Id<"inquiries">, Doc<"inquiries">>();
  if (s.user) {
    const userId = s.user._id;
    for (const i of await ctx.db
      .query("inquiries")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(LIMIT))
      found.set(i._id, i);
  }
  if (s.email) {
    const email = s.email;
    for (const i of await ctx.db
      .query("inquiries")
      .withIndex("by_contact_email", (q) => q.eq("contact.email", email))
      .take(LIMIT))
      found.set(i._id, i);
  }
  return [...found.values()];
}

async function subjectSubscriptions(ctx: QueryCtx, s: Subject) {
  if (!s.email) return [];
  const email = s.email;
  return await ctx.db
    .query("backInStockSubscriptions")
    .withIndex("by_email", (q) => q.eq("email", email))
    .take(LIMIT);
}

async function mechanicProfileOf(ctx: QueryCtx, user: Doc<"users"> | null) {
  if (!user) return null;
  return await ctx.db
    .query("mechanicProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .first();
}

const subjectArgs = {
  userId: v.optional(v.id("users")),
  email: v.optional(v.string()),
};

export const customerData = ownerQuery({
  args: subjectArgs,
  returns: v.object({
    fileName: v.string(),
    json: v.string(),
    counts: v.record(v.string(), v.number()),
  }),
  handler: async (ctx, args) => {
    const s = await resolveSubject(ctx, args);
    const user = s.user;
    const orders = await subjectOrders(ctx, s);
    const inquiries = await subjectInquiries(ctx, s);
    const subscriptions = await subjectSubscriptions(ctx, s);
    const mechanic = await mechanicProfileOf(ctx, user);

    const orderExport = [];
    for (const o of orders) {
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_orderId", (q) => q.eq("orderId", o._id))
        .take(200);
      orderExport.push({
        number: o.number,
        createdAt: new Date(o._creationTime).toISOString(),
        status: o.status,
        contact: o.contact,
        company: o.company ?? null,
        delivery: { method: o.delivery.method, address: o.delivery.address ?? null },
        payment: { method: o.payment.method, status: o.payment.status },
        totalRsd: o.totals.totalPara / 100,
        vehicle: o.vehicle ?? null,
        customerNote: o.customerNote ?? null,
        consent: o.consent,
        attribution: o.attribution ?? null,
        items: items.map((i) => ({
          sku: i.sku,
          name: i.name,
          quantity: i.quantity,
          unitPriceRsd: i.unitPricePara / 100,
        })),
      });
    }

    const vehicles = user
      ? await ctx.db
          .query("savedVehicles")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .take(LIMIT)
      : [];
    const favorites = user
      ? await ctx.db
          .query("favorites")
          .withIndex("by_userId_and_productId", (q) => q.eq("userId", user._id))
          .take(500)
      : [];
    const favoriteSkus: string[] = [];
    for (const f of favorites) {
      const p = await ctx.db.get("products", f.productId);
      if (p) favoriteSkus.push(p.sku);
    }
    const consents = user
      ? await ctx.db
          .query("consentRecords")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .take(LIMIT)
      : [];

    const data = {
      generatedAt: new Date().toISOString(),
      subject: { email: s.email, accountId: user?._id ?? null },
      account: user
        ? {
            email: user.email ?? null,
            name: user.name ?? null,
            firstName: user.firstName ?? null,
            lastName: user.lastName ?? null,
            phone: user.phoneE164 ?? null,
            role: user.role ?? "customer",
            status: user.status ?? "active",
            marketingConsent: user.marketingConsent ?? false,
            createdAt: new Date(user._creationTime).toISOString(),
            lastSeenAt: user.lastSeenAt ? new Date(user.lastSeenAt).toISOString() : null,
          }
        : null,
      mechanicProfile: mechanic
        ? {
            companyName: mechanic.companyName,
            pib: mechanic.pib,
            mb: mechanic.mb,
            contactPerson: mechanic.contactPerson,
            phone: mechanic.phone,
            email: mechanic.email,
            city: mechanic.city,
            address: mechanic.address,
            status: mechanic.status,
            consent: mechanic.consent,
            attribution: mechanic.attribution ?? null,
          }
        : null,
      orders: orderExport,
      inquiries: inquiries.map((i) => ({
        number: i.number,
        createdAt: new Date(i._creationTime).toISOString(),
        status: i.status,
        contact: i.contact,
        message: i.message,
        vin: i.vin ?? null,
        vehicle: i.vehicle ?? null,
        photoCount: i.photos.length,
        consent: i.consent,
        attribution: i.attribution ?? null,
      })),
      savedVehicles: vehicles.map((sv) => ({
        label: sv.label ?? null,
        year: sv.year ?? null,
        vin: sv.vin ?? null,
        plate: sv.plate ?? null,
        note: sv.note ?? null,
      })),
      favorites: favoriteSkus,
      backInStock: subscriptions.map((b) => ({
        status: b.status,
        consentAt: new Date(b.consentAt).toISOString(),
      })),
      cookieConsents: consents.map((c) => ({
        at: new Date(c.at).toISOString(),
        analytics: c.choices.analytics,
        ads: c.choices.ads,
        policyVersion: c.policyVersion,
      })),
    };
    const counts = {
      orders: orderExport.length,
      inquiries: inquiries.length,
      savedVehicles: vehicles.length,
      favorites: favoriteSkus.length,
      backInStock: subscriptions.length,
      cookieConsents: consents.length,
    };
    const day = new Date().toISOString().slice(0, 10);
    return {
      fileName: `podaci-kupca-${day}.json`,
      json: JSON.stringify(data, null, 2),
      counts,
    };
  },
});

/** Records the export in the audit log (the query itself cannot write). */
export const logExport = ownerMutation({
  args: subjectArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const s = await resolveSubject(ctx, args);
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "privacy.export",
      entityType: "user",
      entityId: s.user?._id ?? "guest",
      summary: s.user ? "Izvoz podataka kupca (nalog)" : "Izvoz podataka kupca (bez naloga)",
    });
    return null;
  },
});

async function deleteEmailCopies(
  ctx: MutationCtx,
  relatedType: "order" | "inquiry" | "mechanic" | "user",
  relatedId: string,
): Promise<number> {
  const rows = await ctx.db
    .query("emailLog")
    .withIndex("by_relatedType_and_relatedId", (q) =>
      q.eq("relatedType", relatedType).eq("relatedId", relatedId),
    )
    .take(LIMIT);
  for (const row of rows) await ctx.db.delete("emailLog", row._id);
  return rows.length;
}

async function deleteStorageFile(ctx: MutationCtx, storageId: Id<"_storage">): Promise<void> {
  const upload = await ctx.db
    .query("uploads")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .first();
  if (upload) await ctx.db.delete("uploads", upload._id);
  if (await ctx.db.system.get("_storage", storageId)) await ctx.storage.delete(storageId);
}

function withoutVin<T extends { vin?: string }>(vehicle: T | undefined): T | undefined {
  if (!vehicle) return undefined;
  const copy = { ...vehicle };
  delete copy.vin;
  return copy;
}

async function anonymizeOrder(ctx: MutationCtx, order: Doc<"orders">): Promise<void> {
  const address = order.delivery.address;
  await ctx.db.patch("orders", order._id, {
    contact: { firstName: ANON_NAME, lastName: "", email: "", phone: "" },
    delivery: {
      ...order.delivery,
      ...(address
        ? { address: { street: "—", city: address.city, postalCode: address.postalCode } }
        : {}),
    },
    vehicle: withoutVin(order.vehicle),
    customerNote: undefined,
    attribution: undefined,
    userId: undefined,
    searchText: buildSearchText([order.number, order.company?.name, order.company?.pib]),
    updatedAt: Date.now(),
  });
  await deleteEmailCopies(ctx, "order", order._id);
}

/** An inquiry that became an order stays (anonymized); any other one is deleted. */
async function eraseInquiry(
  ctx: MutationCtx,
  inquiry: Doc<"inquiries">,
): Promise<"kept" | "deleted"> {
  for (const photo of inquiry.photos) await deleteStorageFile(ctx, photo);
  await deleteEmailCopies(ctx, "inquiry", inquiry._id);
  if (inquiry.orderId) {
    await ctx.db.patch("inquiries", inquiry._id, {
      contact: { name: ANON_NAME, preferredChannel: inquiry.contact.preferredChannel },
      message: "[anonimizovano]",
      vin: undefined,
      vinInfo: undefined,
      vehicle: withoutVin(inquiry.vehicle),
      photos: [],
      attribution: undefined,
      userId: undefined,
      searchText: buildSearchText([inquiry.number]),
      updatedAt: Date.now(),
    });
    return "kept";
  }
  const quotes = await ctx.db
    .query("quotes")
    .withIndex("by_inquiryId_and_version", (q) => q.eq("inquiryId", inquiry._id))
    .take(50);
  for (const quote of quotes) await ctx.db.delete("quotes", quote._id);
  const events = await ctx.db
    .query("inquiryEvents")
    .withIndex("by_inquiryId_and_at", (q) => q.eq("inquiryId", inquiry._id))
    .take(500);
  for (const event of events) await ctx.db.delete("inquiryEvents", event._id);
  await ctx.db.delete("inquiries", inquiry._id);
  return "deleted";
}

/** Deletes every row of `rows` (already bounded). */
async function deleteAll<
  T extends
    "savedVehicles" | "favorites" | "notifications" | "customerNotes" | "backInStockSubscriptions",
>(ctx: MutationCtx, table: T, rows: Doc<T>[]): Promise<number> {
  for (const row of rows) await ctx.db.delete(table, row._id);
  return rows.length;
}

/** The login: sessions, refresh tokens, verification codes, accounts, then the user. */
async function deleteAccount(ctx: MutationCtx, user: Doc<"users">): Promise<void> {
  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", user._id))
    .take(LIMIT);
  for (const session of sessions) {
    const tokens = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
      .take(500);
    for (const token of tokens) await ctx.db.delete("authRefreshTokens", token._id);
    await ctx.db.delete("authSessions", session._id);
  }
  const accounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", user._id))
    .take(10);
  for (const account of accounts) {
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", account._id))
      .take(50);
    for (const code of codes) await ctx.db.delete("authVerificationCodes", code._id);
    await ctx.db.delete("authAccounts", account._id);
  }
  await deleteEmailCopies(ctx, "user", user._id);
  await ctx.db.delete("users", user._id);
}

export const anonymize = ownerMutation({
  args: { ...subjectArgs, confirmPhrase: v.string() },
  returns: v.object({
    done: v.boolean(),
    counts: v.record(v.string(), v.number()),
  }),
  handler: async (ctx, args) => {
    if (args.confirmPhrase.trim().toUpperCase() !== ANONYMIZE_PHRASE) {
      invalid(`Za anonimizaciju upišite ${ANONYMIZE_PHRASE}.`, "confirmPhrase");
    }
    const s = await resolveSubject(ctx, args);
    const user = s.user;
    if (user && (user.role === "staff" || user.role === "owner")) {
      fail("FORBIDDEN", "Nalog zaposlenog se ne anonimizuje ovde — prvo mu oduzmite ulogu.");
    }
    const counts: Record<string, number> = {};

    const orders = await subjectOrders(ctx, s);
    for (const order of orders) await anonymizeOrder(ctx, order);
    counts.orders = orders.length;

    const inquiries = await subjectInquiries(ctx, s);
    counts.inquiriesKept = 0;
    counts.inquiriesDeleted = 0;
    for (const inquiry of inquiries) {
      const outcome = await eraseInquiry(ctx, inquiry);
      counts[outcome === "kept" ? "inquiriesKept" : "inquiriesDeleted"]++;
    }

    counts.backInStock = await deleteAll(
      ctx,
      "backInStockSubscriptions",
      await subjectSubscriptions(ctx, s),
    );

    // A full batch means there may be more: the account stays until everything is done, so
    // the next pass still finds the records through it.
    const more = orders.length >= LIMIT || inquiries.length >= LIMIT || counts.backInStock >= LIMIT;

    if (user && !more) {
      const userId = user._id;
      counts.savedVehicles = await deleteAll(
        ctx,
        "savedVehicles",
        await ctx.db
          .query("savedVehicles")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .take(LIMIT),
      );
      counts.favorites = await deleteAll(
        ctx,
        "favorites",
        await ctx.db
          .query("favorites")
          .withIndex("by_userId_and_productId", (q) => q.eq("userId", userId))
          .take(500),
      );
      counts.notifications = await deleteAll(
        ctx,
        "notifications",
        await ctx.db
          .query("notifications")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .take(500),
      );
      counts.customerNotes = await deleteAll(
        ctx,
        "customerNotes",
        await ctx.db
          .query("customerNotes")
          .withIndex("by_userId_and_at", (q) => q.eq("userId", userId))
          .take(LIMIT),
      );
      for (const status of ["active", "merged", "converted", "abandoned"] as const) {
        const carts = await ctx.db
          .query("carts")
          .withIndex("by_userId_and_status", (q) => q.eq("userId", userId).eq("status", status))
          .take(20);
        for (const cart of carts) {
          const items = await ctx.db
            .query("cartItems")
            .withIndex("by_cartId", (q) => q.eq("cartId", cart._id))
            .take(200);
          for (const item of items) await ctx.db.delete("cartItems", item._id);
          await ctx.db.delete("carts", cart._id);
        }
      }
      const consents = await ctx.db
        .query("consentRecords")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .take(LIMIT);
      // Proof of consent stays (2 years), no longer linked to a person.
      for (const c of consents) await ctx.db.patch("consentRecords", c._id, { userId: undefined });
      counts.cookieConsents = consents.length;

      const mechanic = await mechanicProfileOf(ctx, user);
      if (mechanic) {
        await ctx.db.patch("mechanicProfiles", mechanic._id, {
          contactPerson: ANON_NAME,
          phone: "",
          email: "",
          address: "—",
          internalNote: undefined,
          attribution: undefined,
          status: mechanic.status === "approved" ? "suspended" : mechanic.status,
          creditEnabled: false,
          updatedAt: Date.now(),
        });
        await deleteEmailCopies(ctx, "mechanic", mechanic._id);
        counts.mechanicProfile = 1;
      }
      await deleteAccount(ctx, user);
      counts.account = 1;
    }

    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "privacy.anonymize",
      entityType: "user",
      entityId: user?._id ?? "guest",
      summary: `Anonimizacija kupca${user ? "" : " bez naloga"}: ${counts.orders} porudžbina, ${counts.inquiriesDeleted} obrisanih upita${more ? " (nastavlja se)" : ""}`,
    });
    return { done: !more, counts };
  },
});
