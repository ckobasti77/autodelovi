// routing-errors-gates verification: A11Y-03 (stale session -> 307 /prijava), COPY-06 (Serbian 403),
// FLOW-05/PERF-13 (404 titles + root 404 markup). One browser, closed in finally.
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/routing-errors-gates-verify.mjs [section…]
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, loginWith, axe, watch } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/routing-errors-gates/verify.json";
const want = process.argv.slice(2);
const R = {};
const accounts = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const browser = await launch();
async function section(name, fn) {
  if (want.length && !want.includes(name)) return;
  try { R[name] = await fn(); } catch (e) { R[name] = { error: String(e).slice(0, 400) }; }
  console.log(name, JSON.stringify(R[name]).slice(0, 1500));
}
try {
  await section("staleSession", async () => {
    const out = [];
    for (const route of ["/admin", "/nalog", "/majstor/brza-porudzbina"]) {
      const ctx = await newContext(browser, { width: 390, height: 844, tag: "fix-stale" });
      const { hostname } = new URL(BASE);
      await ctx.addCookies([
        { name: "__convexAuthJWT", value: "eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjE3NTkyNTUzMjR9.x", domain: hostname, path: "/" },
        { name: "__convexAuthRefreshToken", value: "revoked-or-expired-token", domain: hostname, path: "/" },
      ]);
      const p = await ctx.newPage();
      const chain = [];
      p.on("response", (r) => { if (r.request().isNavigationRequest()) chain.push(`${r.status()} ${r.url().replace(BASE, "")}`); });
      await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
      await p.waitForLoadState("networkidle").catch(() => {});
      out.push({ route, chain, url: p.url().replace(BASE, ""), title: await p.title(), h1: await p.locator("h1").first().innerText().catch(() => null) });
      if (route === "/admin") out.at(-1).ev = await shot(p, "../fix/routing-errors-gates/a11y03-stale-admin-390");
      await ctx.close();
    }
    return out;
  });

  await section("forbidden", async () => {
    const out = [];
    for (const width of [390, 1440]) {
      const ctx = await newContext(browser, { width, height: 900, tag: "fix-403" });
      const p = await ctx.newPage();
      const log = watch(p);
      await loginWith(p, accounts.customer.email, accounts.customer.password, "/nalog");
      for (const route of ["/admin", "/admin/porudzbine"]) {
        const resp = await p.goto(BASE + route, { waitUntil: "networkidle", timeout: 180000 });
        await p.waitForTimeout(1500);
        const row = { width, route, status: resp?.status(), title: await p.title(), h1: await p.locator("h1").first().innerText().catch(() => null), text: (await p.locator("main").innerText().catch(() => "")).slice(0, 300) };
        if (route === "/admin") {
          row.ev = await shot(p, `../fix/routing-errors-gates/copy06-admin-403-${width}`);
          row.axe = await axe(p);
        }
        row.consoleErrors = log.console.splice(0).filter((m) => !/403|Forbidden|HTTP_ERROR_FALLBACK/i.test(m));
        out.push(row);
      }
      await ctx.close();
    }
    return out;
  });

  await section("notFound", async () => {
    const out = [];
    for (const width of [390, 1440]) {
      const ctx = await newContext(browser, { width, height: 900, tag: "fix-404" });
      const p = await ctx.newPage();
      const log = watch(p);
      for (const route of ["/ovo-ne-postoji", "/deo/ne-postoji-demo-9999"]) {
        const resp = await p.goto(BASE + route, { waitUntil: "networkidle", timeout: 180000 });
        await p.waitForTimeout(1500);
        const row = { width, route, status: resp?.status(), title: await p.title(), h1: await p.locator("h1").first().innerText().catch(() => null) };
        if (width === 390 || route === "/ovo-ne-postoji") row.ev = await shot(p, `../fix/routing-errors-gates/404${route.replaceAll("/", "-")}-${width}`);
        if (route === "/ovo-ne-postoji") row.axe = await axe(p);
        row.consoleErrors = log.console.splice(0).filter((m) => !/404|Not Found|HTTP_ERROR_FALLBACK/i.test(m));
        row.searchFieldHeight = await p.locator('form[role="search"] input[name="q"]').first().evaluate((el) => el.closest("label, [data-testid]")?.getBoundingClientRect().height ?? el.getBoundingClientRect().height).catch(() => null);
        out.push(row);
      }
      await ctx.close();
    }
    return out;
  });
} finally {
  await browser.close();
  writeFileSync(OUT, JSON.stringify(R, null, 2));
  console.log("saved", OUT);
}
