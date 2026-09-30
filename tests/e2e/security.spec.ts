/**
 * Step 20 — security headers on the production build (docs/SECURITY-AUDIT.md):
 * - every document carries the static headers and a per-request nonce CSP, and every executable
 *   script in the HTML carries that nonce;
 * - no CSP violation on the storefront (incl. the live 3D hero: WASM decoder + blob workers),
 *   with analytics after consent, and in the admin (Excel import worker, e-mail previews);
 * - token pages send no Referer and analytics never receive the token;
 * - the post-login redirect ignores protocol-relative tricks.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { TEST_IDS } from "@/constants/testIds";
// Brings the `window.__sklop3d` declaration (type only; nothing is imported at runtime).
import type {} from "@/components/three/testHooks";

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET ?? "e2e-revalidate-secret";
const TRACKING_HOSTS = /googletagmanager\.com|google-analytics\.com|googleadservices\.com|doubleclick\.net|facebook\.net|facebook\.com/;

function convexRun<T>(fn: string, args: Record<string, unknown> = {}): T {
  const out = execFileSync(
    process.execPath,
    [path.resolve("node_modules/convex/bin/main.js"), "run", `testing:${fn}`, JSON.stringify(args)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
  const start = out.search(/[[{"]|^-?\d|^null/m);
  return JSON.parse(out.slice(start)) as T;
}

/** Collects CSP violations (DOM event) and CSP console errors from the first script on. */
async function watchCsp(page: Page): Promise<() => Promise<string[]>> {
  const consoleHits: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) consoleHits.push(m.text());
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __csp: string[] };
    w.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      w.__csp.push(`${e.effectiveDirective} ${e.blockedURI}`);
    });
  });
  return async () => [
    ...consoleHits,
    ...(await page.evaluate(() => (window as unknown as { __csp: string[] }).__csp)),
  ];
}

function nonceOf(csp: string | undefined): string | null {
  return /'nonce-([^']+)'/.exec(csp ?? "")?.[1] ?? null;
}

test.describe("headers", () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "HTTP-level checks run once");

  test("documents carry the static headers and a fresh nonce CSP; every script has the nonce", async ({
    page,
    request,
  }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["permissions-policy"]).toContain("camera=()");
    expect(h["cross-origin-opener-policy"]).toBe("same-origin");
    expect(h["strict-transport-security"]).toContain("max-age=63072000");
    const csp = h["content-security-policy"]!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).not.toContain("'unsafe-eval'");
    const again = (await request.get("/")).headers()["content-security-policy"];
    expect(nonceOf(again)).not.toBe(nonceOf(csp));

    const response = await page.goto("/delovi");
    const nonce = nonceOf(response?.headers()["content-security-policy"]);
    expect(nonce).toBeTruthy();
    const scripts = await page.evaluate(() =>
      [...document.querySelectorAll("script")]
        .filter((s) => !s.type || s.type === "text/javascript" || s.type === "module")
        .map((s) => s.nonce),
    );
    expect(scripts.length).toBeGreaterThan(3);
    expect(scripts.every((n) => n === nonce)).toBe(true);
  });

  test("token pages send no Referer; static files still get the static headers", async ({ request }) => {
    const { number } = convexRun<{ number: string }>("createTestOrder", { tag: `sec${Date.now()}` });
    const token = convexRun<string>("orderStatusToken", { number });
    const res = await request.get(`/porudzbina/${token}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["referrer-policy"]).toBe("no-referrer");
    expect(await res.text()).toContain('<meta name="referrer" content="no-referrer"');
    const robots = await request.get("/robots.txt");
    expect(robots.headers()["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("no CSP violations", () => {
  test("storefront: home with the live 3D hero, category, product, cart, inquiry, sign-in", async ({
    page,
  }) => {
    const violations = await watchCsp(page);
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.__sklop3d));
    await page.evaluate(() => window.scrollTo(0, 80));
    const tier = await page.evaluate(() => window.__sklop3d?.tier);
    if (tier !== "low") {
      await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
    }
    await page.goto("/delovi/kocioni-diskovi");
    const product = await page.locator('a[href^="/deo/"]').first().getAttribute("href");
    for (const path of [product ?? "/delovi", "/korpa", "/upit", "/prijava"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
    }
    expect(await violations()).toEqual([]);
  });

  test("analytics after consent load under the policy; token pages stay out of analytics", async ({
    page,
    context,
    request,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "runs once");
    const previous = convexRun<string>("setTracking", {
      ga4Id: "G-E2ESEC001",
      gadsId: "AW-123456789",
      metaPixelId: "123456789012345",
    });
    await request.post("/api/revalidate", {
      headers: { "x-revalidate-secret": REVALIDATE_SECRET },
      data: { tags: ["settings"] },
    });
    try {
      const { hostname } = new URL(testInfo.project.use.baseURL ?? "http://localhost:3100");
      await context.addCookies([
        {
          name: "sk_consent",
          value: encodeURIComponent(
            JSON.stringify({ v: 1, analytics: true, ads: true, at: Date.now(), id: "e2e-accepted-0001" }),
          ),
          domain: hostname,
          path: "/",
        },
      ]);
      const requests: string[] = [];
      await page.route(TRACKING_HOSTS, async (route) => {
        requests.push(route.request().url());
        const url = route.request().url();
        const body = /fbevents\.js/.test(url)
          ? "window.__fbqCalls=[];(function(f){var q=f.queue||[];f.callMethod=function(){window.__fbqCalls.push([].slice.call(arguments))};q.forEach(function(a){window.__fbqCalls.push([].slice.call(a))});f.queue=[];})(window.fbq);"
          : "window.__gtagLoaded=true;";
        await route.fulfill({ status: 200, contentType: "text/javascript", body });
      });
      const violations = await watchCsp(page);

      await page.goto("/delovi");
      await expect.poll(() => requests.some((u) => u.includes("gtag/js?id=G-E2ESEC001"))).toBe(true);
      await expect.poll(() => requests.some((u) => u.includes("fbevents.js"))).toBe(true);
      await expect
        .poll(() => page.evaluate(() => Boolean((window as unknown as { __gtagLoaded?: boolean }).__gtagLoaded)))
        .toBe(true);

      const { number } = convexRun<{ number: string }>("createTestOrder", { tag: `sec${Date.now()}` });
      const token = convexRun<string>("orderStatusToken", { number });
      await page.goto(`/porudzbina/${token}`);
      await expect.poll(() => requests.some((u) => u.includes("fbevents.js"))).toBe(true);
      await expect
        .poll(() => page.evaluate(() => Array.isArray((window as unknown as { __fbqCalls?: unknown[] }).__fbqCalls)))
        .toBe(true);
      const layer = await page.evaluate(() =>
        (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>)),
      );
      const config = layer.find((e) => e[0] === "config" && e[1] === "G-E2ESEC001");
      expect((config?.[2] as { page_location?: string })?.page_location).toMatch(
        /\/porudzbina\/\[token\]$/,
      );
      expect(JSON.stringify(layer)).not.toContain(token);
      const fbq = await page.evaluate(
        () => (window as unknown as { __fbqCalls: unknown[][] }).__fbqCalls,
      );
      expect(fbq.some((c) => c[0] === "track")).toBe(false);
      expect(requests.some((u) => u.includes(token))).toBe(false);
      expect(await violations()).toEqual([]);
    } finally {
      convexRun<string>("setTracking", { restore: previous });
      await request.post("/api/revalidate", {
        headers: { "x-revalidate-secret": REVALIDATE_SECRET },
        data: { tags: ["settings"] },
      });
    }
  });
});

test.describe("admin under the policy", () => {
  test.skip(!email || !password, "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "admin runs on desktop");

  test("post-login redirect ignores /\\host; admin screens, import worker and e-mail previews load", async ({
    page,
  }) => {
    const violations = await watchCsp(page);
    await page.goto(`/prijava?next=${encodeURIComponent("/\\evil.example/steal")}`);
    await page.getByTestId(TEST_IDS.authEmail).fill(email!);
    await page.getByTestId(TEST_IDS.authPassword).fill(password!);
    await page.getByTestId(TEST_IDS.authSubmit).click();
    await expect(page.getByTestId(TEST_IDS.authViewer)).toBeVisible({ timeout: 60_000 });
    expect(page.url()).not.toContain("evil.example");
    expect(new URL(page.url()).pathname).toBe("/prijava");

    for (const path of ["/admin", "/admin/uvoz", "/admin/mejlovi/sabloni", "/admin/privatnost"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({ timeout: 30_000 });
    }
    // The privacy export downloads JSON for an address (owner only).
    await page.getByLabel("E-pošta kupca").fill("niko-ne-postoji@sklop.test");
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Preuzmi sve podatke (JSON)" }).click();
    expect((await download).suggestedFilename()).toMatch(/^podaci-kupca-\d{4}-\d{2}-\d{2}\.json$/);
    expect(await violations()).toEqual([]);
  });
});
