/**
 * Function builders — every public Convex function is defined with one of these, so the
 * authorization level is visible at the definition (docs/SECURITY.md §D3).
 *
 * - publicQuery / publicMutation: anyone; `ctx.viewer` is the signed-in, non-blocked user or
 *   null. publicMutation also injects `ctx.client` (hashed IP + UA key for rate limits).
 * - userQuery / userMutation: signed-in, not blocked.
 * - staffQuery / staffMutation: role staff or owner.
 * - ownerQuery / ownerMutation: role owner.
 */
import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";

import { mutation, query, type MutationCtx } from "../_generated/server";
import { getActiveViewer, requireOwner, requireStaff, requireUser, type Viewer } from "./authz";
import { ipHashSalt } from "./env";
import { sha256Hex } from "./tokens";

export type ClientInfo = {
  /** Rate-limit key: SHA-256(salt + ip + UA), or a user/anonymous fallback when no IP. */
  key: string;
  hasIp: boolean;
  ip: string | null;
  userAgent: string | null;
};

export async function getClientInfo(ctx: MutationCtx, viewer: Viewer | null): Promise<ClientInfo> {
  const meta = await ctx.meta.getRequestMetadata();
  const ip = meta.ip ?? null;
  const userAgent = meta.userAgent ?? null;
  if (ip) {
    const key = await sha256Hex(`${ipHashSalt()}|${ip}|${userAgent ?? ""}`);
    return { key: `c:${key.slice(0, 32)}`, hasIp: true, ip, userAgent };
  }
  const key = viewer ? `u:${viewer.userId}` : "anon";
  return { key, hasIp: false, ip: null, userAgent };
}

export const publicQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ viewer: await getActiveViewer(ctx) })),
);

export const publicMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const viewer = await getActiveViewer(ctx);
    return { viewer, client: await getClientInfo(ctx, viewer) };
  }),
);

export const userQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ viewer: await requireUser(ctx) })),
);

export const userMutation = customMutation(
  mutation,
  customCtx(async (ctx) => {
    const viewer = await requireUser(ctx);
    return { viewer, client: await getClientInfo(ctx, viewer) };
  }),
);

export const staffQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ viewer: await requireStaff(ctx) })),
);

export const staffMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ viewer: await requireStaff(ctx) })),
);

export const ownerQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ viewer: await requireOwner(ctx) })),
);

export const ownerMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ viewer: await requireOwner(ctx) })),
);
