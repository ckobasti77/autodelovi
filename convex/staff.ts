/**
 * Staff accounts and invites (docs/SECURITY.md §D5). The owner invites by e-mail; the link
 * with a one-time 256-bit token is shown once in the admin (e-mail delivery arrives with
 * step 18), the invitee signs in or registers with that e-mail and accepts. Roles and
 * blocking of staff accounts are owner-only; the last active owner can never be demoted.
 */
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { isValidEmail, normalizeEmail } from "../lib/domain/identifiers";
import { audit } from "./lib/audit";
import { actorOf } from "./lib/authz";
import { fail, invalid, notFound } from "./lib/errors";
import {
  ownerMutation,
  ownerQuery,
  publicQuery,
  staffMutation,
  staffQuery,
  userMutation,
} from "./lib/functions";
import { emailContext, siteLink } from "../lib/email/context";
import { sendTemplateNow } from "./lib/directEmail";
import { resolveEmailConfig } from "./lib/emailConfig";
import { siteUrl } from "./lib/env";
import { enforceRateLimit } from "./lib/rateLimits";
import { getSettings } from "./lib/settings";
import { hashToken, isTokenShape, randomToken } from "./lib/tokens";
import { roleV } from "./lib/validators";

const INVITE_TTL_MS = 7 * 24 * 3_600_000;

function nameOf(u: Doc<"users">): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ") || u.name || u.email || "Korisnik";
}

async function activeOwners(ctx: QueryCtx): Promise<Doc<"users">[]> {
  const owners = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "owner"))
    .take(50);
  return owners.filter((u) => u.status !== "blocked");
}

/** Staff and owner accounts (assignment lists, the users page). */
export const listUsers = staffQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      name: v.string(),
      email: v.union(v.string(), v.null()),
      role: roleV,
      blocked: v.boolean(),
      lastSeenAt: v.union(v.number(), v.null()),
      isSelf: v.boolean(),
      createdAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const out = [];
    for (const role of ["owner", "staff"] as const) {
      const rows = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", role))
        .take(100);
      for (const u of rows) {
        out.push({
          _id: u._id,
          name: nameOf(u),
          email: u.email ?? null,
          role,
          blocked: u.status === "blocked",
          lastSeenAt: u.lastSeenAt ?? null,
          isSelf: u._id === ctx.viewer.userId,
          createdAt: u._creationTime,
        });
      }
    }
    return out;
  },
});

export const listInvites = ownerQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("staffInvites"),
      email: v.string(),
      role: v.union(v.literal("staff"), v.literal("owner")),
      status: v.union(
        v.literal("pending"),
        v.literal("accepted"),
        v.literal("revoked"),
        v.literal("expired"),
      ),
      createdAt: v.number(),
      expiresAt: v.number(),
      createdByName: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db.query("staffInvites").order("desc").take(50);
    const out = [];
    for (const i of rows) {
      const creator = await ctx.db.get("users", i.createdBy);
      out.push({
        _id: i._id,
        email: i.emailLower,
        role: i.role,
        status: i.acceptedAt
          ? ("accepted" as const)
          : i.revokedAt
            ? ("revoked" as const)
            : i.expiresAt < Date.now()
              ? ("expired" as const)
              : ("pending" as const),
        createdAt: i._creationTime,
        expiresAt: i.expiresAt,
        createdByName: creator ? nameOf(creator) : "—",
      });
    }
    return out;
  },
});

/**
 * Owner creates an invite. Returns the raw token once (the admin shows the setup link with a
 * copy button); only its SHA-256 is stored. A previous pending invite for the same e-mail is
 * revoked.
 */
export const createInvite = ownerMutation({
  args: { email: v.string(), role: v.union(v.literal("staff"), v.literal("owner")) },
  returns: v.object({ token: v.string(), expiresAt: v.number(), emailed: v.boolean() }),
  handler: async (ctx, { email, role }) => {
    const emailLower = normalizeEmail(email);
    if (!isValidEmail(emailLower))
      invalid("Adresa e-pošte nije ispravna. Primer: ime@primer.rs.", "email");
    for (const candidate of new Set([email.trim(), emailLower])) {
      const existing = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", candidate))
        .first();
      if (existing && (existing.role === "staff" || existing.role === "owner"))
        invalid("Ovaj nalog već ima pristup administraciji.", "email");
    }
    const now = Date.now();
    const previous = await ctx.db
      .query("staffInvites")
      .withIndex("by_emailLower", (q) => q.eq("emailLower", emailLower))
      .take(20);
    for (const p of previous) {
      if (!p.acceptedAt && !p.revokedAt)
        await ctx.db.patch("staffInvites", p._id, { revokedAt: now });
    }
    const token = randomToken(32);
    const expiresAt = now + INVITE_TTL_MS;
    const inviteId = await ctx.db.insert("staffInvites", {
      emailLower,
      role,
      tokenHash: await hashToken(token),
      expiresAt,
      createdBy: ctx.viewer.userId,
    });
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "staff.invite",
      entityType: "staffInvite",
      entityId: inviteId,
      summary: `Pozivnica za ${emailLower} (${role === "owner" ? "vlasnik" : "zaposleni"})`,
    });
    // E-mailed only when delivery is live; the link is always shown once in the admin.
    const settings = await getSettings(ctx);
    let emailed = false;
    if (resolveEmailConfig(settings).effective === "live") {
      const ectx = emailContext(settings, siteUrl());
      const invitedBy = actorOf(ctx.viewer).name;
      const result = await sendTemplateNow(
        ctx,
        "staff_invite",
        {
          inviteUrl: siteLink(ectx, `/admin/pozivnica/${token}`),
          role,
          expiresAt,
          ...(invitedBy ? { invitedBy } : {}),
        },
        [emailLower],
        { related: { type: "user", id: inviteId } },
      );
      emailed = result.ok;
    }
    return { token, expiresAt, emailed };
  },
});

export const revokeInvite = ownerMutation({
  args: { inviteId: v.id("staffInvites") },
  returns: v.null(),
  handler: async (ctx, { inviteId }) => {
    const invite = await ctx.db.get("staffInvites", inviteId);
    if (!invite) return notFound("Pozivnica ne postoji.");
    if (invite.acceptedAt || invite.revokedAt) return null;
    await ctx.db.patch("staffInvites", inviteId, { revokedAt: Date.now() });
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "staff.invite_revoke",
      entityType: "staffInvite",
      entityId: inviteId,
      summary: `Povučena pozivnica za ${invite.emailLower}`,
    });
    return null;
  },
});

/** Owner changes a role (customer / staff / owner). Never on self; never the last owner. */
export const setRole = ownerMutation({
  args: { userId: v.id("users"), role: roleV },
  returns: v.null(),
  handler: async (ctx, { userId, role }) => {
    if (userId === ctx.viewer.userId) invalid("Svoju ulogu ne možete menjati.");
    const u = await ctx.db.get("users", userId);
    if (!u) return notFound("Korisnik ne postoji.");
    const current = u.role ?? "customer";
    if (current === role) return null;
    if (current === "owner" && (await activeOwners(ctx)).length <= 1)
      invalid("Mora ostati bar jedan vlasnik.");
    await ctx.db.patch("users", userId, { role });
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "staff.role",
      entityType: "user",
      entityId: userId,
      summary: `${nameOf(u)}: uloga ${current} → ${role}`,
      diff: [{ field: "role", before: current, after: role }],
    });
    return null;
  },
});

/** Owner blocks / unblocks a staff account (never self, never the last owner). */
export const setBlocked = ownerMutation({
  args: { userId: v.id("users"), blocked: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { userId, blocked }) => {
    if (userId === ctx.viewer.userId) invalid("Svoj nalog ne možete blokirati.");
    const u = await ctx.db.get("users", userId);
    if (!u) return notFound("Korisnik ne postoji.");
    if (blocked && u.role === "owner" && (await activeOwners(ctx)).length <= 1)
      invalid("Mora ostati bar jedan aktivan vlasnik.");
    const status = blocked ? "blocked" : "active";
    if ((u.status ?? "active") === status) return null;
    await ctx.db.patch("users", userId, { status });
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: blocked ? "staff.block" : "staff.unblock",
      entityType: "user",
      entityId: userId,
      summary: `${nameOf(u)}: ${blocked ? "blokiran" : "odblokiran"}`,
    });
    return null;
  },
});

/** Public: what an invite link is for (masked e-mail + role), without consuming it. */
export const inviteInfo = publicQuery({
  args: { token: v.string() },
  returns: v.object({
    status: v.union(
      v.literal("valid"),
      v.literal("invalid"),
      v.literal("expired"),
      v.literal("used"),
    ),
    emailMasked: v.union(v.string(), v.null()),
    role: v.union(v.literal("staff"), v.literal("owner"), v.null()),
    emailMatches: v.boolean(),
  }),
  handler: async (ctx, { token }) => {
    const none = { status: "invalid" as const, emailMasked: null, role: null, emailMatches: false };
    if (!isTokenShape(token)) return none;
    const tokenHash = await hashToken(token);
    const invite = await ctx.db
      .query("staffInvites")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!invite || invite.revokedAt) return none;
    const [local = "", domain = ""] = invite.emailLower.split("@");
    const emailMasked = `${local.slice(0, 2)}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
    const viewerEmail = ctx.viewer?.user.email ? normalizeEmail(ctx.viewer.user.email) : null;
    return {
      status: invite.acceptedAt
        ? ("used" as const)
        : invite.expiresAt < Date.now()
          ? ("expired" as const)
          : ("valid" as const),
      emailMasked,
      role: invite.role,
      emailMatches: viewerEmail === invite.emailLower,
    };
  },
});

/** Signed-in user accepts an invite: the account e-mail must match; binds the role. */
export const acceptInvite = userMutation({
  args: { token: v.string() },
  returns: v.object({ role: v.union(v.literal("staff"), v.literal("owner")) }),
  handler: async (ctx, { token }) => {
    if (!isTokenShape(token)) return notFound("Pozivnica nije pronađena.");
    const tokenHash = await hashToken(token);
    await enforceRateLimit(ctx, "tokenAction", tokenHash);
    const invite = await ctx.db
      .query("staffInvites")
      .withIndex("by_tokenHash", (q) => q.eq("tokenHash", tokenHash))
      .unique();
    if (!invite) return notFound("Pozivnica nije pronađena.");
    if (invite.acceptedAt) fail("CONFLICT", "Pozivnica je već iskorišćena.");
    if (invite.revokedAt) fail("CONFLICT", "Pozivnica je povučena. Zatražite novu.");
    if (invite.expiresAt < Date.now()) fail("EXPIRED", "Pozivnica je istekla. Zatražite novu.");
    const email = normalizeEmail(ctx.viewer.user.email ?? "");
    if (email !== invite.emailLower)
      fail("FORBIDDEN", "Prijavite se nalogom sa adresom e-pošte na koju je poslata pozivnica.");
    const current = ctx.viewer.user.role ?? "customer";
    const role = current === "owner" ? "owner" : invite.role;
    const now = Date.now();
    await ctx.db.patch("users", ctx.viewer.userId, { role });
    await ctx.db.patch("staffInvites", invite._id, {
      acceptedAt: now,
      acceptedBy: ctx.viewer.userId,
    });
    await audit(ctx, {
      actor: actorOf(ctx.viewer),
      action: "staff.invite_accept",
      entityType: "user",
      entityId: ctx.viewer.userId,
      summary: `${email}: prihvaćena pozivnica (${role === "owner" ? "vlasnik" : "zaposleni"})`,
      diff: [{ field: "role", before: current, after: role }],
    });
    return { role };
  },
});

/**
 * Staff activity stamp for Admin → Korisnici („poslednja aktivnost“): the admin shell calls
 * it on load; writes at most once per 10 minutes per account. An activity stamp, not a
 * business write, so it is not audited (it would flood the log).
 */
export const touchStaffActivity = staffMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    if (ctx.viewer.user.lastSeenAt && now - ctx.viewer.user.lastSeenAt < 10 * 60_000) return null;
    await ctx.db.patch("users", ctx.viewer.userId, { lastSeenAt: now });
    return null;
  },
});
