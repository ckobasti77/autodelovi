/**
 * Staff customer records (`/admin/kupci`): registered accounts with their orders, inquiries,
 * mechanic profile and staff notes; block / unblock customer accounts. Staff and owner
 * accounts are managed in `staff.ts` (owner only).
 */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import { audit } from "./lib/audit";
import { actorOf } from "./lib/authz";
import { invalid, notFound } from "./lib/errors";
import { staffMutation, staffQuery } from "./lib/functions";
import {
  actorV,
  inquiryStatusV,
  mechanicStatusV,
  orderStatusV,
  roleV,
  userMechanicStatusV,
} from "./lib/validators";

const rowV = v.object({
  _id: v.id("users"),
  name: v.string(),
  email: v.union(v.string(), v.null()),
  phone: v.union(v.string(), v.null()),
  role: roleV,
  blocked: v.boolean(),
  mechanicStatus: userMechanicStatusV,
  orderCount: v.number(),
  createdAt: v.number(),
  lastSeenAt: v.union(v.number(), v.null()),
  isDemo: v.boolean(),
});

function displayName(u: Doc<"users">): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || u.email || "Kupac";
}

/**
 * Customer accounts, newest first. `segment`: all customers, mechanics (any status) or
 * blocked accounts. `email` looks up one account exactly (the palette covers other keys).
 */
export const list = staffQuery({
  args: {
    segment: v.optional(v.union(v.literal("all"), v.literal("mechanics"), v.literal("blocked"))),
    email: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(rowV),
  handler: async (ctx, { segment, email, paginationOpts }) => {
    const toRow = async (u: Doc<"users">) => ({
      _id: u._id,
      name: displayName(u),
      email: u.email ?? null,
      phone: u.phoneE164 ?? null,
      role: u.role ?? ("customer" as const),
      blocked: u.status === "blocked",
      mechanicStatus: u.mechanicStatus ?? ("none" as const),
      orderCount: (
        await ctx.db
          .query("orders")
          .withIndex("by_userId", (q) => q.eq("userId", u._id))
          .take(100)
      ).length,
      createdAt: u._creationTime,
      lastSeenAt: u.lastSeenAt ?? null,
      isDemo: u.isDemo === true,
    });
    const term = email?.trim();
    if (term) {
      const found = new Map<string, Doc<"users">>();
      for (const candidate of new Set([term, term.toLowerCase()])) {
        for (const u of await ctx.db
          .query("users")
          .withIndex("email", (q) => q.eq("email", candidate))
          .take(5))
          found.set(u._id, u);
      }
      const page = [];
      for (const u of found.values())
        if ((u.role ?? "customer") === "customer") page.push(await toRow(u));
      return { page, isDone: true, continueCursor: "" };
    }
    const base = ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "customer"))
      .order("desc");
    const query =
      segment === "mechanics"
        ? base.filter((q) => q.neq(q.field("mechanicProfileId"), undefined))
        : segment === "blocked"
          ? base.filter((q) => q.eq(q.field("status"), "blocked"))
          : base;
    const result = await query.paginate(paginationOpts);
    const page = [];
    for (const u of result.page) page.push(await toRow(u));
    return { ...result, page };
  },
});

export const get = staffQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.null(),
    v.object({
      user: v.object({
        _id: v.id("users"),
        name: v.string(),
        firstName: v.union(v.string(), v.null()),
        lastName: v.union(v.string(), v.null()),
        email: v.union(v.string(), v.null()),
        phone: v.union(v.string(), v.null()),
        role: roleV,
        blocked: v.boolean(),
        marketingConsent: v.boolean(),
        createdAt: v.number(),
        lastSeenAt: v.union(v.number(), v.null()),
        isDemo: v.boolean(),
      }),
      mechanic: v.union(
        v.null(),
        v.object({
          profileId: v.id("mechanicProfiles"),
          companyName: v.string(),
          pib: v.string(),
          city: v.string(),
          status: mechanicStatusV,
          tierName: v.union(v.string(), v.null()),
          creditEnabled: v.boolean(),
          creditLimitPara: v.union(v.number(), v.null()),
        }),
      ),
      stats: v.object({ orders: v.number(), valuePara: v.number(), open: v.number() }),
      orders: v.array(
        v.object({
          number: v.string(),
          status: orderStatusV,
          totalPara: v.number(),
          createdAt: v.number(),
        }),
      ),
      inquiries: v.array(
        v.object({
          number: v.string(),
          status: inquiryStatusV,
          summary: v.string(),
          createdAt: v.number(),
        }),
      ),
      vehicles: v.array(
        v.object({
          label: v.string(),
          vin: v.union(v.string(), v.null()),
          plate: v.union(v.string(), v.null()),
        }),
      ),
      notes: v.array(v.object({ message: v.string(), actor: actorV, at: v.number() })),
    }),
  ),
  handler: async (ctx, { userId }) => {
    const u = await ctx.db.get("users", userId);
    if (!u) return null;
    const profile = u.mechanicProfileId
      ? await ctx.db.get("mechanicProfiles", u.mechanicProfileId)
      : null;
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
    const inquiries = await ctx.db
      .query("inquiries")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
    const vehicles = await ctx.db
      .query("savedVehicles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(50);
    const notes = await ctx.db
      .query("customerNotes")
      .withIndex("by_userId_and_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
    const live = orders.filter((o) => o.status !== "otkazana");
    return {
      user: {
        _id: u._id,
        name: displayName(u),
        firstName: u.firstName ?? null,
        lastName: u.lastName ?? null,
        email: u.email ?? null,
        phone: u.phoneE164 ?? null,
        role: u.role ?? "customer",
        blocked: u.status === "blocked",
        marketingConsent: u.marketingConsent === true,
        createdAt: u._creationTime,
        lastSeenAt: u.lastSeenAt ?? null,
        isDemo: u.isDemo === true,
      },
      mechanic:
        profile && profile.userId === u._id
          ? {
              profileId: profile._id,
              companyName: profile.companyName,
              pib: profile.pib,
              city: profile.city,
              status: profile.status,
              tierName: profile.tierId
                ? ((await ctx.db.get("priceTiers", profile.tierId))?.name ?? null)
                : null,
              creditEnabled: profile.creditEnabled,
              creditLimitPara: profile.creditLimitPara ?? null,
            }
          : null,
      stats: {
        orders: live.length,
        valuePara: live.reduce((s, o) => s + o.totals.totalPara, 0),
        open: live.filter((o) => !["zavrsena", "preuzeta", "isporucena"].includes(o.status)).length,
      },
      orders: orders.slice(0, 20).map((o) => ({
        number: o.number,
        status: o.status,
        totalPara: o.totals.totalPara,
        createdAt: o._creationTime,
      })),
      inquiries: inquiries.map((i) => ({
        number: i.number,
        status: i.status,
        summary: i.vehicle?.label ?? i.message.slice(0, 80),
        createdAt: i._creationTime,
      })),
      vehicles: vehicles.map((sv) => ({
        label: sv.label ?? sv.vin ?? "Vozilo",
        vin: sv.vin ?? null,
        plate: sv.plate ?? null,
      })),
      notes: notes.map((n) => ({ message: n.message, actor: n.actor, at: n.at })),
    };
  },
});

export const addNote = staffMutation({
  args: { userId: v.id("users"), message: v.string() },
  returns: v.null(),
  handler: async (ctx, { userId, message }) => {
    const u = await ctx.db.get("users", userId);
    if (!u) return notFound("Kupac ne postoji.");
    const text = message.trim().slice(0, 1_000);
    if (!text) invalid("Beleška je prazna.", "message");
    const actor = actorOf(ctx.viewer);
    await ctx.db.insert("customerNotes", { userId, message: text, actor, at: Date.now() });
    await audit(ctx, {
      actor,
      action: "customer.note",
      entityType: "user",
      entityId: userId,
      summary: `Beleška o kupcu ${displayName(u)}`,
    });
    return null;
  },
});

/** Blocks or unblocks a customer account (sign-in refused, public functions treat it as anonymous). */
export const setBlocked = staffMutation({
  args: { userId: v.id("users"), blocked: v.boolean(), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { userId, blocked, reason }) => {
    const u = await ctx.db.get("users", userId);
    if (!u) return notFound("Kupac ne postoji.");
    if ((u.role ?? "customer") !== "customer")
      invalid("Nalozi zaposlenih se menjaju u delu Korisnici.");
    const status = blocked ? "blocked" : "active";
    if ((u.status ?? "active") === status) return null;
    const text = reason?.trim().slice(0, 300);
    if (blocked && (!text || text.length < 3)) invalid("Upišite razlog blokade.", "reason");
    const actor = actorOf(ctx.viewer);
    const now = Date.now();
    await ctx.db.patch("users", userId, { status });
    await ctx.db.insert("customerNotes", {
      userId,
      message: blocked ? `Nalog blokiran: ${text}` : "Nalog odblokiran.",
      actor,
      at: now,
    });
    await audit(ctx, {
      actor,
      action: blocked ? "customer.block" : "customer.unblock",
      entityType: "user",
      entityId: userId,
      summary: `${displayName(u)}: ${blocked ? `blokiran (${text})` : "odblokiran"}`,
      diff: [{ field: "status", before: u.status ?? "active", after: status }],
    });
    return null;
  },
});
