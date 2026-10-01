/**
 * Function builders — every public Convex function is defined with one of these, so the
 * authorization level is visible at the definition (docs/SECURITY.md §D3).
 *
 * - publicQuery / publicMutation: anyone; `ctx.viewer` is the signed-in, non-blocked user or
 *   null. publicMutation also injects `ctx.client` (salted hash of the caller's IP, the
 *   per-visitor rate-limit key).
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
  /** Rate-limit key: salted SHA-256 of the IP subject, or a user/anonymous fallback. */
  key: string;
  hasIp: boolean;
  ip: string | null;
  userAgent: string | null;
};

/**
 * The subject a per-visitor limit counts: an IPv4 address as is, an IPv6 address by its /64
 * prefix (one subscriber line gets a whole /64, so rotating the interface id is free).
 * Request headers such as the User-Agent are caller-controlled and never part of the key
 * (QA BE-02, D221).
 */
export function ipSubject(ip: string): string {
  const raw = ip
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .split("%")[0]!;
  if (!raw.includes(":")) return raw;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(raw);
  if (mapped) return mapped[1]!;
  const [head = "", tail = ""] = raw.split("::");
  const front = head ? head.split(":") : [];
  const back = raw.includes("::") && tail ? tail.split(":") : [];
  const groups = raw.includes("::")
    ? [...front, ...Array<string>(Math.max(0, 8 - front.length - back.length)).fill("0"), ...back]
    : front;
  const prefix = groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, "") || "0");
  return `${prefix.join(":")}::/64`;
}

export async function getClientInfo(ctx: MutationCtx, viewer: Viewer | null): Promise<ClientInfo> {
  const meta = await ctx.meta.getRequestMetadata();
  const ip = meta.ip ?? null;
  const userAgent = meta.userAgent ?? null;
  if (ip) {
    const key = await sha256Hex(`${ipHashSalt()}|${ipSubject(ip)}`);
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
