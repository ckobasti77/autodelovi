// Independent skeptic verification of vis-commerce-01 (quick order sticky bar vs keyboard focus).
//   node scripts/qa/audit/verify-vis-commerce-01-skeptic.mjs [chromium|firefox|webkit]
// Natural keyboard flow: type codes, press Enter on „Proveri brojeve“ (the app moves focus to the
// results region), then Tab through the results. Each stop is measured 350 ms after the key press
// (enough for any focus scroll to settle). A stop is "fully hidden" when its rect lies entirely
// inside the sticky bar's rect AND the element at its centre belongs to the bar.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, shot } from "./kit.mjs";

const engine = process.argv[2] ?? "chromium";
const OUT = "docs/qa/audit/verify/vis-commerce";
mkdirSync(OUT, { recursive: true });
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8")).mechanic;
const LINES = ["5Q0 615 505 R 2", "036 121 959 P", "038 121 662 1", "1K0 615 868 F x2", "1K0 615 540 Q", "1K0 413 165 G", "1K0 698 406 F 4", "3C0 413 232", "5Q0 121 200 E", "03L 115 549 DA 3", "ZZ9999999 3", "1K0 121 753 QN", "04L 105 204 K"];
const res = { engine, base: BASE, at: new Date().toISOString() };
const outFile = `${OUT}/vis-commerce-01-skeptic-${engine}.json`;
const flush = () => writeFileSync(outFile, JSON.stringify(res, null, 2));
const consentCookie = () => { const { hostname } = new URL(BASE); return [{ name: 'sk_consent', value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: 'audit-verify-vc01-0001' })), domain: hostname, path: '/', httpOnly: false, secure: false, sameSite: 'Lax' }]; };
const browser = await launch(engine);
const ua = (t) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 SklopAudit-verify-vc01-${t}/${Date.now()}`;
const ctxOpts = (w, h, mobile, t) => ({
  viewport: { width: w, height: h },
  ...(engine === "firefox" ? {} : { isMobile: mobile, hasTouch: mobile }),
  locale: "sr-Latn-RS",
  timezoneId: "Europe/Belgrade",
  ...(engine === "chromium" ? { userAgent: ua(t) } : {}),
});

async function goto(page, url) {
  for (let i = 0; i < 3; i++) {
    try { return await page.goto(url, { waitUntil: "load", timeout: 120000 }); } catch (e) { if (i === 2) throw e; }
  }
}

// Sign in once.
let state;
{
  const ctx = await browser.newContext(ctxOpts(1440, 900, false, "login"));
  await ctx.addCookies(consentCookie());
  const page = await ctx.newPage();
  for (let i = 0; i < 3; i++) {
    try {
      await goto(page, `${BASE}/prijava?next=${encodeURIComponent("/majstor")}`);
      await page.getByTestId("auth-email").waitFor({ timeout: 60000 });
      await page.waitForTimeout(1500);
      await page.getByTestId("auth-email").fill(acc.email);
      await page.getByTestId("auth-password").fill(acc.password);
      await page.getByTestId("auth-submit").click();
      await page.waitForURL((u) => u.pathname.startsWith("/majstor"), { timeout: 90000 });
      break;
    } catch (e) { console.log("login retry", String(e).slice(0, 100)); }
  }
  state = await ctx.storageState();
  await ctx.close();
}

const sizes = engine === "chromium"
  ? [[1440, 900, false], [390, 844, true], [360, 780, true], [1920, 1080, false]]
  : [[1440, 900, false], [390, 844, engine !== "firefox"]];

for (const [w, h, mobile] of sizes) {
  const ctx = await browser.newContext({ ...ctxOpts(w, h, mobile, `q${w}`), storageState: state });
  await ctx.addCookies(consentCookie());
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await goto(page, `${BASE}/majstor/brza-porudzbina`);
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const r = (res[w] = { mobile });
  const input = page.getByTestId("mechanic-quick-order-input");
  await input.fill(LINES.join("\n"));
  // Keyboard: focus the check button and press Enter (as a keyboard user would).
  await page.getByTestId("mechanic-quick-order-check").focus();
  await page.keyboard.press("Enter");
  await page.getByTestId("mechanic-quick-order-row").first().waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="mechanic-quick-order-row"][data-status="pending"]'), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  r.afterCheck = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="mechanic-quick-order-add-all"]')?.parentElement?.parentElement;
    const b = bar?.getBoundingClientRect();
    const cs = bar && getComputedStyle(bar);
    const a = document.activeElement;
    return {
      active: a ? `${a.tagName.toLowerCase()}${a.getAttribute("tabindex") ? "[tabindex]" : ""} ${String(a.className).slice(0, 40)}` : null,
      scrollY: Math.round(scrollY),
      rows: document.querySelectorAll('[data-testid="mechanic-quick-order-row"]').length,
      statuses: [...document.querySelectorAll('[data-testid="mechanic-quick-order-row"]')].map((e) => e.dataset.status),
      bar: b && { top: Math.round(b.top), h: Math.round(b.height), pctOfViewport: Math.round((b.height / innerHeight) * 100), position: cs.position, shadow: cs.boxShadow, borderTop: `${cs.borderTopWidth} ${cs.borderTopStyle}`, bg: cs.backgroundColor },
      scrollPadding: { top: getComputedStyle(document.documentElement).scrollPaddingTop, bottom: getComputedStyle(document.documentElement).scrollPaddingBottom },
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
    };
  });
  await shot(page, `verify/vis-commerce/vis-commerce-01-skeptic-${engine}-${w}-after-check`);
  // Tab through the results and the bar.
  const stops = [];
  let marked = 0;
  for (let i = 0; i < 100; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(350);
    const info = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body || a.closest("footer")) return { end: true };
      const bar = document.querySelector('[data-testid="mechanic-quick-order-add-all"]')?.parentElement?.parentElement;
      const inBar = !!bar?.contains(a);
      const r = a.getBoundingClientRect();
      const b = bar?.getBoundingClientRect();
      const geomHidden = !!b && !inBar && r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5 && r.height > 0;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const t = cy >= 0 && cy < innerHeight ? document.elementFromPoint(cx, cy) : null;
      const centreOnBar = !!(bar && t && bar.contains(t) && !inBar);
      const overlapPx = b && !inBar ? Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top)) : 0;
      const label = (a.getAttribute("aria-label") || a.textContent || a.getAttribute("name") || a.tagName).trim().replace(/\s+/g, " ").slice(0, 50);
      const inRow = !!a.closest('[data-testid="mechanic-quick-order-row"]');
      return { tag: a.tagName.toLowerCase(), type: a.type || "", label, inRow, inBar, top: Math.round(r.top), bottom: Math.round(r.bottom), barTop: b && Math.round(b.top), geomHidden, centreOnBar, overlapPx: Math.round(overlapPx), h: Math.round(r.height), scrollY: Math.round(scrollY) };
    });
    if (info.end) break;
    stops.push(info);
    if (info.geomHidden && info.centreOnBar && marked < 1) {
      await page.evaluate(() => {
        const a = document.activeElement.getBoundingClientRect();
        const d = document.createElement("div");
        d.id = "qa-marker";
        Object.assign(d.style, { position: "fixed", left: a.left - 4 + "px", top: a.top - 4 + "px", width: a.width + 8 + "px", height: a.height + 8 + "px", outline: "3px dashed #00e5ff", zIndex: 2147483647, pointerEvents: "none" });
        document.body.appendChild(d);
      });
      await shot(page, `verify/vis-commerce/vis-commerce-01-skeptic-${engine}-${w}-focus-hidden`);
      await page.evaluate(() => document.getElementById("qa-marker")?.remove());
      // Same state without the marker, to see what a keyboard user actually sees.
      await shot(page, `verify/vis-commerce/vis-commerce-01-skeptic-${engine}-${w}-focus-hidden-raw`);
      marked++;
    }
  }
  const resultStops = stops.filter((s) => s.inRow);
  r.tabStopsTotal = stops.length;
  r.rowStops = resultStops.length;
  r.fullyHidden = stops.filter((s) => s.geomHidden && s.centreOnBar);
  r.fullyHiddenCount = r.fullyHidden.length;
  r.partlyHiddenCount = stops.filter((s) => !s.geomHidden && s.overlapPx > 0 && !s.inBar).length;
  r.stops = stops;
  r.errors = errors;
  console.log(engine, w, JSON.stringify({ afterCheck: r.afterCheck, tabStopsTotal: r.tabStopsTotal, rowStops: r.rowStops, fullyHiddenCount: r.fullyHiddenCount, partly: r.partlyHiddenCount, hidden: r.fullyHidden.map((s) => `${s.label}@${s.top}-${s.bottom}/bar${s.barTop}`) }).slice(0, 2500));
  flush();
  await ctx.close();
}

flush();
await browser.close();
console.log("done", outFile);
