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
import { NextResponse } from "next/server";

import { buildCsp, createNonce } from "@/lib/security/headers";

const isAccountArea = createRouteMatcher(["/nalog(.*)", "/majstor(.*)", "/admin(.*)"]);

// The staff invite page is public (token-guarded) even though it lives under /admin.
const isPublicAdminPage = createRouteMatcher(["/admin/pozivnica/(.*)"]);

export const proxy = convexAuthNextjsMiddleware(
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

export const config = {
  // Everything except files with an extension and Next internals; includes /api/auth.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
