/**
 * Viewer resolution and role checks (docs/SECURITY.md §D2–§D3). Identity comes only from
 * the Convex Auth session (`getAuthUserId`), never from arguments.
 */
import { getAuthUserId } from "@convex-dev/auth/server";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { fail } from "./errors";
import type { Actor } from "./validators";

export type ViewerRole = "customer" | "staff" | "owner";

export type ViewerMechanic = {
  profileId: Id<"mechanicProfiles">;
  status: Doc<"mechanicProfiles">["status"];
  tierId: Id<"priceTiers"> | undefined;
  creditEnabled: boolean;
  creditLimitPara: number | undefined;
};

export type Viewer = {
  userId: Id<"users">;
  user: Doc<"users">;
  role: ViewerRole;
  isStaff: boolean;
  isOwner: boolean;
  blocked: boolean;
  mechanic: ViewerMechanic | null;
};

/** The signed-in user (blocked users included, flagged) or `null`. */
export async function getViewer(ctx: QueryCtx): Promise<Viewer | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await viewerForUser(ctx, userId);
}

/**
 * The viewer shape of a given account. Only for server-side decisions made on behalf of a
 * customer by staff (e.g. which payment methods a mechanic may use when staff convert a
 * quote); never an authorization source for the caller.
 */
export async function viewerForUser(ctx: QueryCtx, userId: Id<"users">): Promise<Viewer | null> {
  const user = await ctx.db.get("users", userId);
  if (user === null) return null;
  const role: ViewerRole = user.role ?? "customer";
  let mechanic: ViewerMechanic | null = null;
  if (user.mechanicProfileId) {
    const profile = await ctx.db.get("mechanicProfiles", user.mechanicProfileId);
    if (profile && profile.userId === user._id) {
      mechanic = {
        profileId: profile._id,
        status: profile.status,
        tierId: profile.tierId,
        creditEnabled: profile.creditEnabled,
        creditLimitPara: profile.creditLimitPara,
      };
    }
  }
  return {
    userId,
    user,
    role,
    isStaff: role === "staff" || role === "owner",
    isOwner: role === "owner",
    blocked: user.status === "blocked",
    mechanic,
  };
}

/** Public functions treat blocked users as anonymous. */
export async function getActiveViewer(ctx: QueryCtx): Promise<Viewer | null> {
  const viewer = await getViewer(ctx);
  return viewer && !viewer.blocked ? viewer : null;
}

export async function requireUser(ctx: QueryCtx): Promise<Viewer> {
  const viewer = await getViewer(ctx);
  if (!viewer) return fail("UNAUTHENTICATED", "Prijavite se da biste nastavili.");
  if (viewer.blocked) return fail("BLOCKED", "Nalog je blokiran. Pozovite nas.");
  return viewer;
}

export async function requireRole(ctx: QueryCtx, roles: readonly ViewerRole[]): Promise<Viewer> {
  const viewer = await requireUser(ctx);
  if (!roles.includes(viewer.role)) return fail("FORBIDDEN", "Nemate pristup ovoj radnji.");
  return viewer;
}

export function requireStaff(ctx: QueryCtx): Promise<Viewer> {
  return requireRole(ctx, ["staff", "owner"]);
}

export function requireOwner(ctx: QueryCtx): Promise<Viewer> {
  return requireRole(ctx, ["owner"]);
}

export async function requireApprovedMechanic(
  ctx: QueryCtx,
): Promise<Viewer & { mechanic: ViewerMechanic }> {
  const viewer = await requireUser(ctx);
  if (!viewer.mechanic || viewer.mechanic.status !== "approved") {
    return fail("FORBIDDEN", "Ova opcija je dostupna odobrenim majstorima.");
  }
  return viewer as Viewer & { mechanic: ViewerMechanic };
}

export function isApprovedMechanic(viewer: Viewer | null): boolean {
  return viewer?.mechanic?.status === "approved";
}

/** Audit / event actor for the viewer (or the system when absent). */
export function actorOf(viewer: Viewer | null): Actor {
  if (!viewer) return { type: "system" };
  const name =
    [viewer.user.firstName, viewer.user.lastName].filter(Boolean).join(" ") ||
    viewer.user.name ||
    viewer.user.email;
  const type: Actor["type"] = viewer.isOwner
    ? "owner"
    : viewer.isStaff
      ? "staff"
      : viewer.mechanic
        ? "mechanic"
        : "customer";
  return { type, userId: viewer.userId, ...(name ? { name } : {}) };
}

export const SYSTEM_ACTOR: Actor = { type: "system", name: "Sistem" };
