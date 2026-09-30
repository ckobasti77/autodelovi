// Independent verification of a11y-app-01 (stale session -> blank page on account areas).
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const OUT = "verify/a11y-app";
mkdirSync(`docs/qa/audit/${OUT}`, { recursive: true });
const host = new URL(BASE).hostname;
const stale = [
  { name: "__convexAuthJWT", value: "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ4IiwiZXhwIjoxfQ.x", domain: host, path: "/", httpOnly: true, sameSite: "Lax" },
  { name: "__convexAuthRefreshToken", value: "revoked-or-expired-token", domain: host, path: "/", httpOnly: true, sameSite: "Lax" },
];
const results = [];

async function direct(engine, width, height, route, tag) {
  const browser = await launch(engine);
  try {
    const ctx = await newContext(browser, { width, height, engine, tag: `verify01-${tag}` });
    await ctx.addCookies(stale);
    const page = await ctx.newPage();
    const resp = await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 60000 }).catch((e) => ({ err: String(e) }));
    await page.waitForTimeout(1500);
    const r = {
      kind: "direct", engine, width, route,
      status: resp?.status?.() ?? resp?.err,
      location: resp?.headers?.()["location"] ?? null,
      url: page.url(),
      title: await page.title(),
      bodyTextLen: await page.evaluate(() => document.body?.innerText.trim().length ?? -1),
      htmlLen: await page.evaluate(() => document.documentElement.outerHTML.length),
      lang: await page.evaluate(() => document.documentElement.lang),
      cookiesAfter: (await ctx.cookies()).map((c) => c.name),
    };
    r.shot = await shot(page, `${OUT}/a11y-app-01-reproduce-${engine}-${width}-${tag}`);
    await page.reload({ waitUntil: "load" }).catch(() => {});
    await page.waitForTimeout(1500);
    r.afterReload = { url: page.url(), title: await page.title() };
    results.push(r);
    await ctx.close();
  } finally {
    await browser.close();
  }
}

async function clientNav(engine, width, height) {
  const browser = await launch(engine);
  try {
    const ctx = await newContext(browser, { width, height, engine, tag: "verify01-nav" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(2500);
    await ctx.addCookies(stale); // session lapses while the tab is open
    const reqs = [];
    page.on("response", (res) => { if (res.url().includes("/nalog")) reqs.push(`${res.status()} ${res.url()} loc=${res.headers()["location"] ?? ""}`); });
    const link = page.locator('a[href="/nalog"]').first();
    const visible = await link.isVisible().catch(() => false);
    if (visible) await link.click(); else await page.evaluate(() => document.querySelector('a[href="/nalog"]')?.click());
    await page.waitForTimeout(6000);
    const r = {
      kind: "client-nav", engine, width, from: "/", clicked: 'a[href="/nalog"]', linkVisible: visible,
      url: page.url(), title: await page.title(),
      bodyTextLen: await page.evaluate(() => document.body?.innerText.trim().length ?? -1),
      h1: await page.evaluate(() => [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()).slice(0, 3)),
      responses: reqs,
    };
    r.shot = await shot(page, `${OUT}/a11y-app-01-reproduce-clientnav-${engine}-${width}`);
    results.push(r);
    await ctx.close();
  } finally {
    await browser.close();
  }
}

await direct("chromium", 390, 844, "/admin", "admin");
await direct("chromium", 1440, 900, "/majstor/brza-porudzbina", "majstor");
await direct("chromium", 1440, 900, "/nalog/porudzbine", "nalog-porudzbine");
await direct("webkit", 390, 844, "/nalog", "nalog");
await direct("firefox", 1440, 900, "/admin/porudzbine", "admin-porudzbine");
await clientNav("chromium", 1440, 900);
writeFileSync(`docs/qa/audit/${OUT}/a11y-app-01-reproduce.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
