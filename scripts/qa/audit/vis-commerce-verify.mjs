// vis-commerce (2nd reviewer): targeted re-verification of candidate findings.
//   node scripts/qa/audit/vis-commerce-verify.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";
import { OUT, login, harden, settle } from "./vis-commerce-lib.mjs";

const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8")).mechanic;
const res = {};
const browser = await launch();
let state;
{
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "viscom2-login" });
  const page = harden(await ctx.newPage());
  await login(page, BASE, acc.email, acc.password, "/majstor");
  state = await ctx.storageState();
  await ctx.close();
}
const ctxFor = (w, h, mobile) =>
  browser.newContext({
    storageState: state, viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile,
    locale: "sr-Latn-RS", timezoneId: "Europe/Belgrade",
    userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 SklopAudit-viscom2-${w}/${Date.now()}`,
  });

// A. 360 overflow on the mechanic portal
{
  const ctx = await ctxFor(360, 780, true);
  const page = harden(await ctx.newPage());
  const log = watch(page);
  res.overflow360 = {};
  for (const url of ["/majstor", "/majstor/cenovnik", "/nalog", "/korpa", "/"]) {
    await page.goto(`${BASE}${url}`);
    await settle(page, 1500);
    res.overflow360[url] = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const over = document.documentElement.scrollWidth - vw;
      const offenders = [...document.querySelectorAll("body *")]
        .filter((e) => e.getBoundingClientRect().right > vw + 1)
        .slice(0, 12)
        .map((e) => {
          const r = e.getBoundingClientRect();
          return `${e.tagName.toLowerCase()}[${e.getAttribute("data-testid") || e.getAttribute("aria-label") || String(e.className).slice(0, 60)}] L${Math.round(r.left)} R${Math.round(r.right)} "${(e.textContent || "").trim().slice(0, 30)}"`;
        });
      return { vw, over, offenders };
    });
    if (url === "/majstor") {
      await shot(page, "vis-commerce/v2/360-majstor-top");
      await page.evaluate(() => window.scrollTo(400, 0));
      await page.waitForTimeout(400);
      await shot(page, "vis-commerce/v2/360-majstor-scrolled-right");
      res.overflow360.scrollXAfter = await page.evaluate(() => window.scrollX);
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  }
  res.overflow360.log = log;
  await ctx.close();
}

// B. /majstor/porudzbine at 2560 (previous run: 500 + React #441)
{
  res.porudzbine = [];
  for (const [w, h] of [[2560, 1440], [1440, 900], [2560, 1440]]) {
    const ctx = await ctxFor(w, h, false);
    const page = harden(await ctx.newPage());
    const log = watch(page);
    const r = await page.goto(`${BASE}/majstor/porudzbine`);
    await settle(page, 2500);
    res.porudzbine.push({ w, status: r?.status(), h1: await page.locator("h1").first().textContent().catch(() => null), log });
    await ctx.close();
  }
}

// C. quick order 1440 — keyboard focus vs sticky bar
{
  const ctx = await ctxFor(1440, 900, false);
  const page = harden(await ctx.newPage());
  await page.goto(`${BASE}/majstor/brza-porudzbina`);
  await settle(page, 1500);
  const LINES = ["5Q0 615 505 R 2", "036 121 959 P", "038 121 662 1", "1K0 615 868 F x2", "1K0 615 540 Q", "1K0 413 165 G", "1K0 698 406 F 4", "3C0 413 232", "5Q0 121 200 E", "03L 115 549 DA 3", "ZZ9999999 3", "1K0 121 753 QN", "04L 105 204 K"];
  await page.getByTestId("mechanic-quick-order-input").fill(LINES.join("\n"));
  await page.getByTestId("mechanic-quick-order-check").click();
  await page.getByTestId("mechanic-quick-order-row").first().waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="mechanic-quick-order-row"][data-status="pending"]'), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  res.quick = { cssScrollPad: await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingBottom) };
  await page.getByTestId("mechanic-quick-order-check").focus();
  const covered = [];
  let shotDone = false;
  for (let i = 0; i < 70; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(120);
    const info = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body || a.closest("footer")) return { end: true };
      const r = a.getBoundingClientRect();
      const bar = document.querySelector('[data-testid="mechanic-quick-order-add-all"]')?.closest("div.sticky");
      const b = bar?.getBoundingClientRect();
      const inBar = bar?.contains(a);
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const topEl = document.elementFromPoint(cx, Math.min(cy, window.innerHeight - 1));
      const hiddenByBar = !inBar && bar && topEl && bar.contains(topEl);
      return { label: (a.getAttribute("aria-label") || a.textContent || a.tagName).trim().slice(0, 40), top: Math.round(r.top), bottom: Math.round(r.bottom), barTop: b ? Math.round(b.top) : null, hiddenByBar };
    });
    if (info.end) break;
    if (info.hiddenByBar) {
      covered.push(info);
      if (!shotDone) {
        await page.evaluate(() => {
          const a = document.activeElement.getBoundingClientRect();
          const d = document.createElement("div");
          d.id = "qa-marker";
          Object.assign(d.style, { position: "fixed", left: a.left - 4 + "px", top: a.top - 4 + "px", width: a.width + 8 + "px", height: a.height + 8 + "px", outline: "3px dashed #0ff", zIndex: 99999, pointerEvents: "none" });
          document.body.appendChild(d);
        });
        await shot(page, "vis-commerce/v2/1440-quick-focus-under-bar");
        await page.evaluate(() => document.getElementById("qa-marker")?.remove());
        shotDone = true;
      }
    }
  }
  res.quick.focusHiddenByBar = covered;
  // wheel reachability: scroll to end, is the last row fully above the bar?
  await page.mouse.move(900, 500);
  for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 400);
  await page.waitForTimeout(800);
  res.quick.endGeo = await page.evaluate(() => {
    const bar = document.querySelector('[data-testid="mechanic-quick-order-add-all"]')?.closest("div.sticky")?.getBoundingClientRect();
    const rows = [...document.querySelectorAll('[data-testid="mechanic-quick-order-row"]')];
    const last = rows.at(-1).getBoundingClientRect();
    return { barTop: bar?.top, lastRowBottom: last.bottom, vh: innerHeight, scrollY };
  });
  await ctx.close();
}
writeFileSync(`${OUT}/v2-verify.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 1).slice(0, 6000));
await browser.close();
