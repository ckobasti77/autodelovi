import { cookies } from "next/headers";

import { persistAttribution } from "@/lib/server/trackingCookies";

/**
 * `POST /api/atribucija` (SEO-ADS §J8): the browser captured a campaign touch into the session
 * cookie; with consent the server extends it to the 90-day `sk_attr` (first touch kept).
 * A route handler, not a Server Action, so the landing page is not re-rendered.
 */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return new Response(null, { status: 403 });
  }
  const saved = persistAttribution(await cookies());
  return new Response(null, { status: saved ? 204 : 202, headers: { "Cache-Control": "no-store" } });
}
