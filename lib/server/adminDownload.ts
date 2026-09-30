import "server-only";

/**
 * Helpers for staff download route handlers (`/admin/uvoz/sablon`, `/admin/uvoz/[id]/izvestaj`,
 * `/admin/izvoz/[vrsta]`): the Convex token of the signed-in user (Convex decides whether
 * they are staff), private no-store responses and attachment headers.
 */
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import type { NextRequest } from "next/server";

import { ROUTES } from "@/constants/routes";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
} as const;

export function plainResponse(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { ...PRIVATE_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
  });
}

/** The user's Convex token, or a redirect to sign-in that comes back to this URL. */
export async function tokenOrSignIn(request: NextRequest): Promise<string | Response> {
  const token = await convexAuthNextjsToken();
  if (token) return token;
  const next = encodeURIComponent(`${request.nextUrl.pathname}${request.nextUrl.search}`);
  return Response.redirect(new URL(`${ROUTES.signIn}?next=${next}`, request.nextUrl.origin), 303);
}

export function attachment(
  body: Uint8Array | string,
  fileName: string,
  contentType: string,
): Response {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  return new Response(bytes.slice().buffer as ArrayBuffer, {
    status: 200,
    headers: {
      ...PRIVATE_HEADERS,
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${fileName.replace(/[^\w.-]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Length": String(bytes.byteLength),
    },
  });
}

export const CSV_TYPE = "text/csv; charset=utf-8";
