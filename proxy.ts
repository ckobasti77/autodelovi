/**
 * Next 16 proxy (docs/SECURITY.md §D1, §D3 layer 3, §L3): Convex Auth cookie handling for the
 * `/api/auth` route + token refresh, UX-only redirects of anonymous visitors away from account
 * areas, and the per-request nonce Content-Security-Policy. Authorization itself happens in
 * Convex and in the server layouts/pages. Static security headers live in next.config.ts.
 */
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { type NextFetchEvent, type NextRequest, NextResponse } from "next/server";

import { buildCsp, createNonce } from "@/lib/security/headers";

const isAccountArea = createRouteMatcher(["/nalog(.*)", "/majstor(.*)", "/admin(.*)"]);

// The staff invite page is public (token-guarded) even though it lives under /admin.
const isPublicAdminPage = createRouteMatcher(["/admin/pozivnica/(.*)"]);

const authProxy = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    if (
      isAccountArea(request) &&
      !isPublicAdminPage(request) &&
      !(await convexAuth.isAuthenticated())
    ) {
      const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
      return nextjsMiddlewareRedirect(request, `/prijava?next=${encodeURIComponent(next)}`);
    }

    // Next reads the nonce from the request's CSP header and puts it on its own scripts; the
    // root layout reads `x-nonce` for the inline text-reveal boot script.
    const nonce = createNonce();
    const csp = buildCsp({
      nonce,
      dev: process.env.NODE_ENV === "development",
      https: request.nextUrl.protocol === "https:",
      convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL,
      convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    });
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    const response = NextResponse.next({ request: { headers } });
    response.headers.set("Content-Security-Policy", csp);
    return response;
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

/**
 * @convex-dev/auth 0.0.95 re-wraps the handler's response in `NextResponse.next(response)` whenever
 * the refresh step produced cookie changes — including the cookie *clearing* after a failed refresh
 * (stale, revoked or expired session). That copy keeps `Location` and `Set-Cookie` but drops the 3xx
 * status, so an account URL answered HTTP 200 with an empty body: a blank page (A11Y-03, D260).
 * Any `Location` on a non-redirect response here can only come from that wrapper, so it is turned
 * back into a real 307 that carries the same cookie headers.
 */
function restoreRedirect(response: Response, requestUrl: string): Response {
  const location = response.headers.get("location");
  if (location === null || (response.status >= 300 && response.status < 400)) return response;
  const redirect = NextResponse.redirect(new URL(location, requestUrl), 307);
  for (const cookie of response.headers.getSetCookie()) {
    redirect.headers.append("set-cookie", cookie);
  }
  return redirect;
}

export async function proxy(request: NextRequest, event: NextFetchEvent): Promise<Response> {
  const response = (await authProxy(request, event)) ?? NextResponse.next();
  return restoreRedirect(response, request.url);
}

export const config = {
  // Everything except files with an extension and Next internals; includes /api/auth.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
