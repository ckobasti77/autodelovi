/**
 * Next 16 proxy (docs/SECURITY.md §D1, §D3 layer 3): Convex Auth cookie handling for the
 * `/api/auth` route + token refresh, and UX-only redirects of anonymous visitors away from
 * account areas. Authorization itself happens in Convex and in the server layouts/pages.
 * Step 20 adds the CSP nonce and security headers here (additive).
 */
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

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
  },
  { cookieConfig: { maxAge: 60 * 60 * 24 * 30 } },
);

export const config = {
  // Everything except files with an extension and Next internals; includes /api/auth.
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
