import { NextRequest, NextResponse } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { isLiveRoute, ROUTES } from "@/constants/routes";

/**
 * The proxy's own logic around @convex-dev/auth (D265, D268). The library is replaced by a stub
 * that reproduces its 0.0.95 behaviour after a failed refresh: the handler's redirect is copied
 * into `NextResponse.next(response)` — Location and cookie-clearing Set-Cookie kept, 307 lost.
 */
const authMock = vi.hoisted(() => ({ calls: 0, staleSession: false }));
vi.mock("@convex-dev/auth/nextjs/server", () => ({
  createRouteMatcher: (patterns: string[]) => (request: NextRequest) =>
    patterns.some((p) => new RegExp(`^${p}$`).test(request.nextUrl.pathname)),
  nextjsMiddlewareRedirect: (request: NextRequest, route: string) =>
    NextResponse.redirect(new URL(route, request.url)),
  convexAuthNextjsMiddleware:
    (
      handler: (
        request: NextRequest,
        ctx: { convexAuth: { isAuthenticated: () => Promise<boolean> } },
      ) => Promise<Response>,
    ) =>
    async (request: NextRequest) => {
      authMock.calls++;
      const response = await handler(request, {
        convexAuth: { isAuthenticated: async () => false },
      });
      if (!authMock.staleSession) return response;
      const wrapped = NextResponse.next(response);
      wrapped.cookies.set("__convexAuthJWT", "", { expires: new Date(0) });
      wrapped.cookies.set("__convexAuthRefreshToken", "", { expires: new Date(0) });
      return wrapped;
    },
}));

const { proxy } = await import("@/proxy");
const run = (url: string, method = "GET") =>
  proxy(new NextRequest(url, { method }), {} as Parameters<typeof proxy>[1]);

describe("isLiveRoute", () => {
  it.each([
    ["/", true],
    ["/styleguide", true],
    ["/styleguide#boje", true],
    ["/styleguide?strana=2", true],
    ["/delovi", true],
    ["/delovi/kocnice", true],
    [ROUTES.searchFor("1K0 615"), true],
    ["/majstor", true],
    ["/majstor/brza-porudzbina?kodovi=1K0615301AA", true],
    ["/admin/majstori", true],
    ["/ponuda/zimske-gume", true],
    ["/nepostojeca-strana", false],
    ["/za-majstore", true],
    ["/za-majstore/registracija", true],
    ["/stylegui", false],
  ])("%s → %s", (href, expected) => {
    expect(isLiveRoute(href)).toBe(expected);
  });

  it("builds encoded helper routes", () => {
    expect(ROUTES.searchFor("1K0 615/301")).toBe("/pretraga?q=1K0%20615%2F301");
    expect(ROUTES.inquiryWith({ q: "turbina", kodovi: ["A1", "B2"] })).toBe(
      "/upit?q=turbina&kodovi=A1%2CB2",
    );
    expect(ROUTES.inquiryWith({})).toBe("/upit");
  });
});

describe("proxy", () => {
  it("turns the library's 200 + Location after a failed refresh back into a 307 (A11Y-03)", async () => {
    authMock.staleSession = true;
    const response = await run("http://localhost/admin/porudzbine");
    authMock.staleSession = false;
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/prijava?next=%2Fadmin%2Fporudzbine",
    );
    const cookies = response.headers.getSetCookie().join("\n");
    expect(cookies).toContain("__convexAuthJWT=;");
    expect(cookies).toContain("__convexAuthRefreshToken=;");
  });

  it("keeps the anonymous redirect and normal pages as they are", async () => {
    expect((await run("http://localhost/nalog")).status).toBe(307);
    const page = await run("http://localhost/delovi");
    expect(page.headers.get("location")).toBeNull();
    expect(page.headers.get("x-middleware-next")).toBe("1");
  });

  it.each([
    ["http://localhost/deo/KOCIONI-DISK-DEMO-0004", "http://localhost/deo/kocioni-disk-demo-0004"],
    ["http://localhost/DEO/kocioni-disk", "http://localhost/deo/kocioni-disk"],
    ["http://localhost/Delovi/Kocioni-Diskovi?marka=VW", "http://localhost/delovi/kocioni-diskovi?marka=VW"],
    ["http://localhost/Kontakt", "http://localhost/kontakt"],
  ])("308s %s to the lowercase path (SEO-16)", async (from, to) => {
    const before = authMock.calls;
    const response = await run(from);
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(to);
    expect(authMock.calls).toBe(before);
  });

  it.each([
    "http://localhost/porudzbina/AbC123xYz",
    "http://localhost/upit/AbC123xYz",
    "http://localhost/admin/pozivnica/AbC123xYz",
    "http://localhost/obavestenja/odjava/AbC123xYz",
    "http://localhost/nalog/porudzbine/SK-2026-000092",
  ])("never rewrites case-sensitive tokens and order numbers: %s", async (url) => {
    const response = await run(url);
    expect(response.status).not.toBe(308);
  });

  it("does not redirect non-GET requests", async () => {
    expect((await run("http://localhost/Deo/X", "POST")).status).not.toBe(308);
  });
});
