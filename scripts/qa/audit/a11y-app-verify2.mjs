// a11y-app (third pass, part 2): no-JS credential submit (correct form), collapsed admin rail at 1024.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { BASE, launch, newContext, shot, axe } from "./kit.mjs";
import { focused } from "./a11y-app-lib.mjs";

const DIR = "docs/qa/audit/a11y-app";
const OUT = `${DIR}/verify2.json`;
const R = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const want = process.argv.slice(2);
const save = () => writeFileSync(OUT, JSON.stringify(R, null, 2));
const browser = await launch();
async function section(name, fn) {
  if (want.length && !want.includes(name)) return;
  const t = Date.now();
  try { R[name] = await fn(); } catch (e) { R[name] = { error: String(e).slice(0, 400) }; }
  R[name]._ms = Date.now() - t;
  save();
  console.log(name, JSON.stringify(R[name]).slice(0, 2000));
}

await section("nojs", async () => {
  const out = [];
  for (const [route, fill] of [
    ["/prijava", { email: "audit-a11y-app-nojs@primer.rs", password: "TajnaLozinka-555" }],
    ["/registracija", { name: "Audit Nojs", email: "audit-a11y-app-nojs@primer.rs", password: "TajnaLozinka-555" }],
  ]) {
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false, locale: "sr-Latn-RS" });
    const { hostname } = new URL(BASE);
    const value = encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-a11y-app-nojs-0001" }));
    await c2.addCookies([{ name: "sk_consent", value, domain: hostname, path: "/" }]);
    const p = await c2.newPage();
    const reqs = [];
    p.on("request", (r) => { if (r.isNavigationRequest()) reqs.push(`${r.method()} ${r.url().replace(BASE, "")}`); });
    await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
    const form = await p.evaluate(() => { const f = document.querySelector("input[name=password]")?.closest("form"); return f && { method: f.getAttribute("method"), action: f.getAttribute("action"), names: [...f.elements].map((e) => e.name).filter(Boolean) }; });
    for (const [k, v] of Object.entries(fill)) await p.locator(`form:has(input[name=password]) [name=${k}]`).fill(v);
    await p.locator("form:has(input[name=password]) [type=submit]").first().click();
    await p.waitForLoadState("domcontentloaded").catch(() => {});
    await p.waitForTimeout(1500);
    const url = p.url().replace(BASE, "");
    const ev = await shot(p, `a11y-app/v-nojs${route.replace(/\//g, "-")}-390`, { fullPage: false });
    out.push({ route, form, url, navRequests: reqs, ev });
    await c2.close();
  }
  return out;
});

await section("rail1024", async () => {
  const ctx = await newContext(browser, { width: 1024, height: 768, tag: "a11y-app-rail" });
  const state = JSON.parse(readFileSync(`${DIR}/state/admin.json`, "utf8"));
  await ctx.addCookies(state.cookies);
  const p = await ctx.newPage();
  await p.goto(`${BASE}/admin/porudzbine`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.locator("main h1").first().waitFor({ timeout: 120000 });
  await p.waitForFunction(() => { const b = document.querySelector("[data-testid=admin-notification-bell]"); return !!b && Object.keys(b).some((k) => k.startsWith("__reactProps")); }, null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const links = await p.evaluate(() => {
    const nav = document.querySelector("nav[aria-label=Administracija]");
    const lum = (c) => { const m = c.match(/[\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return ((x + 0.05) / (y + 0.05)).toFixed(2); };
    const bgOf = (e) => { let n = e; while (n) { const c = getComputedStyle(n).backgroundColor; if (c && !c.endsWith(", 0)") && c !== "transparent") return c; n = n.parentElement; } return "rgb(255,255,255)"; };
    return [...(nav?.querySelectorAll("a") ?? [])].map((a) => {
      const r = a.getBoundingClientRect();
      const nums = [...a.querySelectorAll("*")].filter((e) => e.children.length === 0 && /^\d+\+?$/.test(e.textContent.trim()) && e.getClientRects().length);
      return {
        name: a.getAttribute("aria-label") || a.textContent.trim().replace(/\s+/g, " "), visibleText: [...a.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.getClientRects().length && getComputedStyle(e).position !== "absolute" && e.textContent.trim() && !e.closest(".sr-only")).map((e) => e.textContent.trim()).join(" "),
        title: a.getAttribute("title"), size: `${Math.round(r.width)}x${Math.round(r.height)}`,
        badges: nums.map((e) => { const cs = getComputedStyle(e); const bg = bgOf(e); return { text: e.textContent.trim(), color: cs.color, bg, ratio: ratio(cs.color, bg), fontSize: cs.fontSize, ariaHidden: !!e.closest("[aria-hidden=true]") }; }),
      };
    });
  });
  // keyboard: focus the Lager link, is there a visible tooltip/label?
  const lager = p.locator("nav[aria-label=Administracija] a[href='/admin/lager']");
  await lager.focus();
  await p.waitForTimeout(900);
  const tip = await p.evaluate(() => [...document.querySelectorAll("[role=tooltip],[data-radix-popper-content-wrapper]")].map((t) => t.textContent.trim().slice(0, 60)));
  const f = await focused(p);
  const ev = await shot(p, "a11y-app/v-rail-1024-lager-focus", { clip: { x: 0, y: Math.max(0, f.rect[1] - 200), width: 360, height: 300 } });
  await ctx.close();
  return { links, tip, focus: f, ev };
});


// Invalid/expired session cookies (lapsed refresh token, session revoked elsewhere): what does the user see?
await section("staleSession", async () => {
  const out = [];
  for (const route of ["/admin", "/nalog", "/majstor/brza-porudzbina"]) {
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "a11y-app-stale" });
    const { hostname } = new URL(BASE);
    await ctx.addCookies([
      { name: "__convexAuthJWT", value: "eyJhbGciOiJSUzI1NiJ9.eyJleHAiOjE3NTkyNTUzMjR9.x", domain: hostname, path: "/" },
      { name: "__convexAuthRefreshToken", value: "revoked-or-expired-token", domain: hostname, path: "/" },
    ]);
    const p = await ctx.newPage();
    const resp = await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
    await p.waitForTimeout(6000);
    const first = { status: resp?.status(), location: resp?.headers()["location"] ?? null, url: p.url().replace(BASE, ""), title: await p.title(), bodyText: (await p.evaluate(() => document.body?.innerText.length ?? 0)) };
    const ev = await shot(p, "a11y-app/v-stale-session" + route.split("/").join("-") + "-390", { fullPage: false });
    const r2 = await p.reload({ waitUntil: "domcontentloaded", timeout: 180000 });
    await p.waitForTimeout(3000);
    const afterReload = { status: r2?.status(), url: p.url().replace(BASE, ""), title: await p.title() };
    out.push({ route, first, ev, afterReload });
    await ctx.close();
  }
  return out;
});

await browser.close();
console.log("saved", OUT);
