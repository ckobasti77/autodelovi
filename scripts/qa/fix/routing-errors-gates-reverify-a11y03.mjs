// Independent re-verification of A11Y-03 (stale / revoked session on account URLs -> real 307 to
// /prijava instead of HTTP 200 + Location + empty body). Every browser is closed in finally.
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/routing-errors-gates-reverify-a11y03.mjs [section…]
// Writes docs/qa/fix/routing-errors-gates/verify/a11y03-reverify.json + WebP screenshots.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

import { BASE, launch, loginWith, newContext, shot, watch } from "../audit/kit.mjs";

const DIR = "docs/qa/fix/routing-errors-gates/verify";
const REL = "../fix/routing-errors-gates/verify"; // shot() resolves relative to docs/qa/audit
mkdirSync(DIR, { recursive: true });
const want = process.argv.slice(2);
const host = new URL(BASE).hostname;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
// Decodable JWT that expired in 2023: forces the library to attempt a refresh.
const expiredJwt = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ sub: "x", iat: 1700000000, exp: 1700003600 })}.sig`;
const cookie = (name, value) => ({ name, value, domain: host, path: "/", httpOnly: true, sameSite: "Lax" });
const staleCookies = (refresh = "revoked-or-expired-token") => [
  cookie("__convexAuthJWT", expiredJwt),
  cookie("__convexAuthRefreshToken", refresh),
];
const accounts = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const outFile = `${DIR}/a11y03-reverify${want.length ? `-${want.join("-")}` : ""}.json`;
const R = { base: BASE, at: new Date().toISOString() };

async function section(name, fn) {
  if (want.length && !want.includes(name)) return;
  try {
    R[name] = await fn();
  } catch (e) {
    R[name] = { error: String(e).slice(0, 500) };
  }
  console.log(name, JSON.stringify(R[name]).slice(0, 2500));
  writeFileSync(outFile, JSON.stringify(R, null, 2));
}

async function inspect(page) {
  return {
    url: page.url().replace(BASE, ""),
    title: await page.title(),
    lang: await page.evaluate(() => document.documentElement.getAttribute("lang")),
    bodyTextLen: await page.evaluate(() => document.body?.innerText.trim().length ?? -1),
    h1: await page.locator("h1").first().innerText().catch(() => null),
    signInForm: await page.getByTestId("auth-email").isVisible().catch(() => false),
  };
}

async function probe(engine, { width, route, refresh, reducedMotion = "no-preference", label, doShot = false, cookies }) {
  const browser = await launch(engine);
  try {
    const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, engine, reducedMotion, tag: "reverify-a11y03" });
    await ctx.addCookies(cookies ?? staleCookies(refresh));
    const page = await ctx.newPage();
    const log = watch(page);
    const chain = [];
    page.on("response", (r) => {
      if (r.request().isNavigationRequest() && r.request().frame() === page.mainFrame())
        chain.push(`${r.status()} ${r.url().replace(BASE, "")}${r.headers()["location"] ? ` -> ${r.headers()["location"]}` : ""}`);
    });
    const resp = await page.goto(BASE + route, { waitUntil: "load", timeout: 180_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(1200);
    const r = { engine, width, reducedMotion, route, label, finalStatus: resp?.status(), chain, ...(await inspect(page)) };
    r.authCookiesLeft = (await ctx.cookies()).filter((c) => c.name.includes("convexAuth")).map((c) => c.name);
    r.nextParam = new URL(page.url()).searchParams.get("next");
    if (doShot) r.shot = await shot(page, `${REL}/a11y03-${label}-${engine}-${width}`);
    // Keyboard: the sign-in form must be reachable with Tab from the top of the page.
    if (r.signInForm) {
      let reached = false;
      for (let i = 0; i < 40 && !reached; i++) {
        await page.keyboard.press("Tab");
        reached = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "auth-email");
      }
      r.emailReachableByTab = reached;
    }
    r.errorsBeforeReload = { console: [...log.console], pageErrors: [...log.pageErrors] };
    await page.reload({ waitUntil: "load", timeout: 180_000 });
    await page.waitForTimeout(800);
    r.afterReload = { url: page.url().replace(BASE, ""), title: await page.title() };
    r.consoleErrors = log.console;
    r.pageErrors = log.pageErrors;
    r.badResponses = log.badResponses;
    await ctx.close();
    return r;
  } finally {
    await browser.close();
  }
}

try {
  // 1) The audit's corrected reproduction, across engines, widths and the routes it listed.
  await section("direct", async () => {
    const runs = [];
    runs.push(await probe("chromium", { width: 390, route: "/admin", label: "admin", doShot: true }));
    runs.push(await probe("chromium", { width: 1440, route: "/admin", label: "admin", doShot: true }));
    runs.push(await probe("chromium", { width: 1440, route: "/majstor/brza-porudzbina", label: "majstor-brza" }));
    runs.push(await probe("chromium", { width: 390, route: "/majstor/cenovnik", label: "majstor-cenovnik" }));
    runs.push(await probe("chromium", { width: 1440, route: "/nalog/porudzbine", label: "nalog-porudzbine" }));
    runs.push(await probe("chromium", { width: 1440, route: "/admin/porudzbine/SK-2026-000092", label: "admin-order-emaillink" }));
    runs.push(await probe("chromium", { width: 390, route: "/majstor", label: "majstor-reduced", reducedMotion: "reduce" }));
    runs.push(await probe("chromium", { width: 390, route: "/nalog", label: "nalog-refresh-only", cookies: [cookie("__convexAuthRefreshToken", "x")] }));
    runs.push(await probe("chromium", { width: 390, route: "/nalog", label: "nalog-jwt-only", cookies: [cookie("__convexAuthJWT", expiredJwt)] }));
    runs.push(await probe("webkit", { width: 390, route: "/nalog", label: "nalog", doShot: true }));
    runs.push(await probe("firefox", { width: 1440, route: "/admin/porudzbine", label: "admin-porudzbine", doShot: true }));
    return runs;
  });

  // 1b) Re-run of the WebKit / Firefox probes with errors split before / after the reload.
  await section("engines", async () => [
    await probe("webkit", { width: 390, route: "/nalog", label: "nalog-rerun" }),
    await probe("webkit", { width: 1440, route: "/admin", label: "admin-rerun" }),
    await probe("firefox", { width: 1440, route: "/admin/porudzbine", label: "admin-porudzbine-rerun" }),
  ]);

  // 2) A genuinely revoked refresh token (sign in, capture, sign out), then a fresh context with it.
  await section("revoked", async () => {
    const browser = await launch("chromium");
    let revoked = null;
    try {
      const ctx = await newContext(browser, { width: 1440, tag: "reverify-a11y03-login" });
      const page = await ctx.newPage();
      await loginWith(page, accounts.customer.email, accounts.customer.password, "/nalog");
      revoked = (await ctx.cookies()).find((c) => c.name.endsWith("__convexAuthRefreshToken"))?.value ?? null;
      await page.goto(`${BASE}/prijava`, { waitUntil: "networkidle", timeout: 180_000 });
      await page.getByTestId("auth-sign-out").click();
      await page.getByTestId("auth-submit").waitFor({ timeout: 60_000 });
      await ctx.close();
    } finally {
      await browser.close();
    }
    if (!revoked) return { error: "could not capture a refresh token" };
    return await probe("chromium", { width: 390, route: "/nalog/porudzbine", refresh: revoked, label: "nalog-real-revoked", doShot: true });
  });

  // 3) Session lapses while a tab is open; the header account link is followed client-side.
  await section("clientNav", async () => {
    const browser = await launch("chromium");
    try {
      const ctx = await newContext(browser, { width: 1440, height: 900, tag: "reverify-a11y03-nav" });
      const page = await ctx.newPage();
      const log = watch(page);
      await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 180_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(2000);
      await ctx.addCookies(staleCookies());
      const responses = [];
      page.on("response", (res) => {
        if (/\/(nalog|prijava)/.test(res.url())) responses.push(`${res.status()} ${res.url().replace(BASE, "")}${res.headers()["location"] ? ` -> ${res.headers()["location"]}` : ""}`);
      });
      const link = page.locator('header a[href="/nalog"], a[href="/nalog"]').first();
      const visible = await link.isVisible().catch(() => false);
      if (visible) await link.click();
      else await page.evaluate(() => document.querySelector('a[href="/nalog"]')?.click());
      await page.waitForURL((u) => u.pathname === "/prijava", { timeout: 60_000 }).catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1500);
      const r = { linkVisible: visible, responses, ...(await inspect(page)) };
      r.shot = await shot(page, `${REL}/a11y03-clientnav-chromium-1440`);
      r.consoleErrors = log.console;
      r.pageErrors = log.pageErrors;
      await ctx.close();
      return r;
    } finally {
      await browser.close();
    }
  });

  // 4) After the stale redirect the user signs in and lands on the page they asked for (next=).
  await section("signInAfterRedirect", async () => {
    const browser = await launch("chromium");
    try {
      const ctx = await newContext(browser, { width: 390, height: 844, tag: "reverify-a11y03-next" });
      await ctx.addCookies(staleCookies());
      const page = await ctx.newPage();
      await page.goto(`${BASE}/nalog/porudzbine`, { waitUntil: "networkidle", timeout: 180_000 });
      const landed = page.url().replace(BASE, "");
      await page.getByTestId("auth-email").fill(accounts.customer.email);
      await page.getByTestId("auth-password").fill(accounts.customer.password);
      await page.getByTestId("auth-password").press("Enter");
      await page.waitForURL((u) => u.pathname.startsWith("/nalog"), { timeout: 90_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      const r = { landed, after: await inspect(page) };
      await ctx.close();
      return r;
    } finally {
      await browser.close();
    }
  });

  // 5) Regression: valid sessions are untouched — a fresh session, and an expired JWT with a
  // valid refresh token (the library refreshes and re-wraps the response with new cookies).
  await section("validSession", async () => {
    const browser = await launch("chromium");
    const out = [];
    try {
      const ctx = await newContext(browser, { width: 1440, height: 900, tag: "reverify-a11y03-valid" });
      const page = await ctx.newPage();
      await loginWith(page, accounts.customer.email, accounts.customer.password, "/nalog");
      const chain = [];
      page.on("response", (r) => {
        if (r.request().isNavigationRequest()) chain.push(`${r.status()} ${r.url().replace(BASE, "")}`);
      });
      let resp = await page.goto(`${BASE}/nalog/porudzbine`, { waitUntil: "networkidle", timeout: 180_000 });
      out.push({ case: "fresh customer session", status: resp?.status(), chain: chain.splice(0), ...(await inspect(page)) });
      // Expire the JWT only; the refresh token stays valid.
      const jwt = (await ctx.cookies()).find((c) => c.name.endsWith("__convexAuthJWT"));
      await ctx.addCookies([{ ...jwt, value: expiredJwt }]);
      resp = await page.goto(`${BASE}/nalog/porudzbine`, { waitUntil: "networkidle", timeout: 180_000 });
      const setCookies = ((await resp?.headerValues("set-cookie")) ?? [])
        .flatMap((v) => v.split("\n"))
        .map((v) => v.split(";")[0].replace(/=(.{12}).+$/, "=$1…"));
      out.push({ case: "expired JWT + valid refresh token", status: resp?.status(), chain: chain.splice(0), setCookies, ...(await inspect(page)) });
      out.at(-1).shot = await shot(page, `${REL}/a11y03-refreshed-session-nalog-1440`);
      await ctx.close();

      const octx = await newContext(browser, { width: 1440, height: 900, tag: "reverify-a11y03-owner" });
      const op = await octx.newPage();
      const email = process.env.SEED_ADMIN_EMAIL;
      const password = process.env.SEED_ADMIN_PASSWORD;
      if (email && password) {
        await loginWith(op, email, password, "/admin");
        const r2 = await op.goto(`${BASE}/admin/porudzbine`, { waitUntil: "networkidle", timeout: 180_000 });
        out.push({ case: "owner session /admin/porudzbine", status: r2?.status(), ...(await inspect(op)) });
      } else {
        out.push({ case: "owner session", skipped: "SEED_ADMIN_* not set" });
      }
      await octx.close();
      return out;
    } finally {
      await browser.close();
    }
  });
} finally {
  writeFileSync(outFile, JSON.stringify(R, null, 2));
}
