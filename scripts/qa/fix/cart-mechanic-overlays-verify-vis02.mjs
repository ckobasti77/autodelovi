// Step 22 re-verification of VIS-02 (copy of scripts/qa/audit/verify-vis-commerce-01.mjs; output under docs/qa/fix/cart-mechanic-overlays/verify).
//   node scripts/qa/audit/verify-vis-commerce-01.mjs [chromium|firefox] [widths...]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "../audit/kit.mjs";

const engine = ["chromium", "firefox", "webkit"].includes(process.argv[2]) ? process.argv[2] : "chromium";
const args = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const SIZES = {
  360: [360, 780, true],
  390: [390, 844, true],
  768: [768, 1024, true],
  1024: [1024, 768, false],
  1280: [1280, 800, false],
  1440: [1440, 900, false],
  1920: [1920, 1080, false],
  2560: [2560, 1440, false],
};
const widths = args.length ? args : [1440, 390];
const OUTDIR = "docs/qa/fix/cart-mechanic-overlays/verify";
mkdirSync(OUTDIR, { recursive: true });
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8")).mechanic;

// Same 13-line paste as the original reviewer (9 exact, 3 ambiguous, 1 not found expected).
const LINES = ["5Q0 615 505 R 2", "036 121 959 P", "038 121 662 1", "1K0 615 868 F x2", "1K0 615 540 Q", "1K0 413 165 G", "1K0 698 406 F 4", "3C0 413 232", "5Q0 121 200 E", "03L 115 549 DA 3", "ZZ9999999 3", "1K0 121 753 QN", "04L 105 204 K"];

const outFile = `${OUTDIR}/vis02-reproduce-${engine}.json`;
let res = {};
try { res = JSON.parse(readFileSync(outFile, "utf8")); } catch {}
const flush = () => writeFileSync(outFile, JSON.stringify(res, null, 2));

const browser = await launch(engine);

async function login(page) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(`${BASE}/prijava?next=${encodeURIComponent("/majstor")}`, { waitUntil: "load", timeout: 120000 });
      await page.getByTestId("auth-email").waitFor({ timeout: 60000 });
      await page.waitForTimeout(1200);
      await page.getByTestId("auth-email").fill(acc.email);
      await page.getByTestId("auth-password").fill(acc.password);
      await page.getByTestId("auth-submit").click();
      await page.waitForURL((u) => u.pathname.startsWith("/majstor"), { timeout: 90000 });
      return;
    } catch (e) {
      console.log("login retry", String(e).slice(0, 100));
    }
  }
  throw new Error("login failed");
}

const BAR_JS = `document.querySelector('[data-testid="mechanic-quick-order-add-all"]')?.closest('.sticky')`;

for (const w of widths) {
  const [width, height, mobile] = SIZES[w];
  const ctx = await newContext(browser, { width, height, mobile, tag: `verify-vc01-${engine}-${w}`, engine });
  const page = await ctx.newPage();
  const log = watch(page);
  await login(page);
  await page.goto(`${BASE}/majstor/brza-porudzbina`, { waitUntil: "load", timeout: 120000 });
  await page.getByTestId("mechanic-quick-order-input").waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.getByTestId("mechanic-quick-order-input").fill(LINES.join("\n"));
  await page.getByTestId("mechanic-quick-order-check").click();
  await page.getByTestId("mechanic-quick-order-row").first().waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="mechanic-quick-order-row"][data-status="pending"]'), null, { timeout: 60000 });
  await page.getByTestId("mechanic-quick-order-add-all").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  const r = (res[w] = { engine, viewport: `${width}x${height}`, mobile });

  // State right after the check (no user scroll).
  r.atLoad = await page.evaluate((barJs) => {
    const bar = eval(barJs);
    const b = bar.getBoundingClientRect();
    const cs = getComputedStyle(bar);
    const rows = [...document.querySelectorAll('[data-testid="mechanic-quick-order-row"]')];
    const behind = rows
      .map((row, i) => {
        const rr = row.getBoundingClientRect();
        const overlap = Math.max(0, Math.min(rr.bottom, b.bottom) - Math.max(rr.top, b.top));
        return { i: i + 1, status: row.dataset.status, top: Math.round(rr.top), bottom: Math.round(rr.bottom), overlap: Math.round(overlap), full: rr.top >= b.top && rr.bottom <= b.bottom + 1 };
      })
      .filter((x) => x.overlap > 0);
    return {
      scrollY: Math.round(scrollY),
      vh: innerHeight,
      bar: { top: Math.round(b.top), h: Math.round(b.height), pctOfVh: Math.round((b.height / innerHeight) * 100), bg: cs.backgroundColor, shadow: cs.boxShadow, borderTop: `${cs.borderTopWidth} ${cs.borderTopColor}`, cls: String(bar.className) },
      rows: rows.length,
      statuses: rows.map((x) => x.dataset.status).join(","),
      rowsBehindBar: behind,
      htmlScrollPad: { top: getComputedStyle(document.documentElement).scrollPaddingTop, bottom: getComputedStyle(document.documentElement).scrollPaddingBottom },
    };
  }, BAR_JS);
  await shot(page, `../fix/cart-mechanic-overlays/verify/vis02-reproduce-${engine}-${w}-atload`);

  // Keyboard walk from the check button.
  await page.getByTestId("mechanic-quick-order-check").focus();
  const stops = [];
  let shotTaken = false;
  for (let i = 0; i < 120; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(120);
    const info = await page.evaluate((barJs) => {
      const a = document.activeElement;
      if (!a || a === document.body || a.closest("footer")) return { end: true };
      const bar = eval(barJs);
      const r = a.getBoundingClientRect();
      const inBar = bar?.contains(a);
      const pts = [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2], [r.left + r.width / 2, r.top + r.height / 2]];
      let byBar = 0, off = 0;
      for (const [x, y] of pts) {
        if (y < 0 || y > innerHeight - 1 || x < 0 || x > innerWidth - 1) { off++; continue; }
        const t = document.elementFromPoint(x, y);
        if (bar && !inBar && t && bar.contains(t)) byBar++;
      }
      const b = bar?.getBoundingClientRect();
      const row = a.closest('[data-testid="mechanic-quick-order-row"]');
      const rowIdx = row ? [...document.querySelectorAll('[data-testid="mechanic-quick-order-row"]')].indexOf(row) + 1 : null;
      const label = (a.getAttribute("aria-label") || a.textContent || a.getAttribute("name") || a.tagName).trim().replace(/\s+/g, " ").slice(0, 50);
      return { tag: a.tagName.toLowerCase(), type: a.type || "", label, row: rowIdx, inBar, top: Math.round(r.top), bottom: Math.round(r.bottom), barTop: b && Math.round(b.top), byBar, off, scrollY: Math.round(scrollY) };
    }, BAR_JS);
    if (info.end) break;
    stops.push(info);
    if (info.byBar === 5 && !shotTaken) {
      // Raw viewport as the user sees it, then the same frame with a marker where focus is.
      await shot(page, `../fix/cart-mechanic-overlays/verify/vis02-reproduce-${engine}-${w}-focus-hidden-raw`);
      await page.evaluate(() => {
        const a = document.activeElement.getBoundingClientRect();
        const d = document.createElement("div");
        d.id = "qa-marker";
        Object.assign(d.style, { position: "fixed", left: a.left - 4 + "px", top: a.top - 4 + "px", width: a.width + 8 + "px", height: a.height + 8 + "px", outline: "3px dashed #00e5ff", zIndex: 2147483647, pointerEvents: "none" });
        document.body.appendChild(d);
      });
      await shot(page, `../fix/cart-mechanic-overlays/verify/vis02-reproduce-${engine}-${w}-focus-hidden-marked`);
      await page.evaluate(() => document.getElementById("qa-marker")?.remove());
      r.firstHidden = info;
      shotTaken = true;
    }
  }
  r.tabStops = stops.length;
  r.stopsOutsideBar = stops.filter((s) => !s.inBar).length;
  r.fullyHidden = stops.filter((s) => s.byBar === 5).length;
  r.partlyHidden = stops.filter((s) => s.byBar > 0 && s.byBar < 5).length;
  r.fullyHiddenList = stops.filter((s) => s.byBar === 5).map((s) => `r${s.row} ${s.tag}${s.type ? ":" + s.type : ""} "${s.label}" top${s.top} barTop${s.barTop}`);

  // Wheel reachability: scroll to the end, is the last row clear of the bar?
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(800);
  r.atEnd = await page.evaluate((barJs) => {
    const bar = eval(barJs).getBoundingClientRect();
    const rows = [...document.querySelectorAll('[data-testid="mechanic-quick-order-row"]')];
    const last = rows.at(-1).getBoundingClientRect();
    return { lastRowBottom: Math.round(last.bottom), barTop: Math.round(bar.top), clear: last.bottom <= bar.top + 1 };
  }, BAR_JS);
  r.log = { console: log.console.slice(0, 5), pageErrors: log.pageErrors.slice(0, 5), bad: log.badResponses.slice(0, 5) };
  console.log(w, JSON.stringify({ ...r, fullyHiddenList: r.fullyHiddenList.slice(0, 8), log: undefined }).slice(0, 2500));
  flush();
  await ctx.close();
}

flush();
await browser.close();
console.log("done", outFile);
