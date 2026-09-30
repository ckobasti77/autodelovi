// vis-commerce (3rd reviewer): targeted re-verification.
//   node scripts/qa/audit/vis-commerce-verify3.mjs [quick] [cart] [upit]
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";
import { OUT, login, harden, settle, cartState } from "./vis-commerce-lib.mjs";

const want = process.argv.slice(2);
const run = (k) => !want.length || want.includes(k);
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8")).mechanic;
const res = {};
const outFile = `${OUT}/v3-verify.json`;
const flush = () => writeFileSync(outFile, JSON.stringify(res, null, 2));
const browser = await launch();
const ua = (t) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 SklopAudit-viscom3-${t}/${Date.now()}`;

const LINES = ["5Q0 615 505 R 2", "036 121 959 P", "038 121 662 1", "1K0 615 868 F x2", "1K0 615 540 Q", "1K0 413 165 G", "1K0 698 406 F 4", "3C0 413 232", "5Q0 121 200 E", "03L 115 549 DA 3", "ZZ9999999 3", "1K0 121 753 QN", "04L 105 204 K"];

if (run("quick")) {
  let state;
  {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "viscom3-login" });
    const page = harden(await ctx.newPage());
    for (let i = 0; i < 3; i++) {
      try { await login(page, BASE, acc.email, acc.password, "/majstor"); break; } catch (e) { console.log("login retry", String(e).slice(0, 80)); }
    }
    state = await ctx.storageState();
    await ctx.close();
  }
  res.quick = {};
  for (const [w, h, mobile] of [[1440, 900, false], [390, 844, true]]) {
    const ctx = await browser.newContext({ storageState: state, viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, locale: "sr-Latn-RS", timezoneId: "Europe/Belgrade", userAgent: ua(`q${w}`) });
    const page = harden(await ctx.newPage());
    const log = watch(page);
    await page.goto(`${BASE}/majstor/brza-porudzbina`);
    await settle(page, 1500);
    const r = (res.quick[w] = {});
    r.inputFont = await page.getByTestId("mechanic-quick-order-input").evaluate((e) => getComputedStyle(e).fontSize);
    await page.getByTestId("mechanic-quick-order-input").fill(LINES.join("\n"));
    await page.getByTestId("mechanic-quick-order-check").click();
    await page.getByTestId("mechanic-quick-order-row").first().waitFor({ timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('[data-testid="mechanic-quick-order-row"][data-status="pending"]'), null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    r.bar = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="mechanic-quick-order-add-all"]')?.closest(".sticky, [class*=sticky]");
      if (!bar) return null;
      const cs = getComputedStyle(bar);
      const b = bar.getBoundingClientRect();
      return { cls: String(bar.className).slice(0, 200), bg: cs.backgroundColor, shadow: cs.boxShadow, borderTop: cs.borderTopWidth + " " + cs.borderTopColor, top: Math.round(b.top), h: Math.round(b.height), left: Math.round(b.left), width: Math.round(b.width), scrollPadB: getComputedStyle(document.documentElement).scrollPaddingBottom };
    });
    // Keyboard: Tab through everything in the results column; record focus stops fully hidden by the bar.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByTestId("mechanic-quick-order-check").focus();
    const stops = [];
    let marked = false;
    for (let i = 0; i < 90; i++) {
      await page.keyboard.press("Tab");
      await page.waitForTimeout(90);
      const info = await page.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return { end: true };
        if (a.closest("footer")) return { end: true };
        const bar = document.querySelector('[data-testid="mechanic-quick-order-add-all"]')?.closest(".sticky, [class*=sticky]");
        const header = document.querySelector("header");
        const r = a.getBoundingClientRect();
        const inBar = bar?.contains(a);
        const pts = [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2], [r.left + r.width / 2, r.top + r.height / 2]];
        let coveredByBar = 0, coveredByHeader = 0, offscreen = 0;
        for (const [x, y] of pts) {
          if (y < 0 || y > innerHeight - 1 || x < 0 || x > innerWidth - 1) { offscreen++; continue; }
          const t = document.elementFromPoint(x, y);
          if (bar && !inBar && t && bar.contains(t)) coveredByBar++;
          else if (header && t && header.contains(t) && !header.contains(a)) coveredByHeader++;
        }
        const label = (a.getAttribute("aria-label") || a.textContent || a.getAttribute("name") || a.tagName).trim().replace(/\s+/g, " ").slice(0, 50);
        return { tag: a.tagName.toLowerCase(), type: a.type || "", label, top: Math.round(r.top), bottom: Math.round(r.bottom), coveredByBar, coveredByHeader, offscreen };
      });
      if (info.end) break;
      stops.push(info);
      if (info.coveredByBar === 5 && !marked) {
        await page.evaluate(() => {
          const a = document.activeElement.getBoundingClientRect();
          const d = document.createElement("div");
          d.id = "qa-marker";
          Object.assign(d.style, { position: "fixed", left: a.left - 4 + "px", top: a.top - 4 + "px", width: a.width + 8 + "px", height: a.height + 8 + "px", outline: "3px dashed #00e5ff", zIndex: 2147483647, pointerEvents: "none" });
          document.body.appendChild(d);
        });
        await shot(page, `vis-commerce/v3/${w}-quick-focus-fully-hidden`);
        await page.evaluate(() => document.getElementById("qa-marker")?.remove());
        marked = true;
      }
    }
    r.tabStops = stops.length;
    r.fullyHidden = stops.filter((s) => s.coveredByBar === 5);
    r.partlyHidden = stops.filter((s) => s.coveredByBar > 0 && s.coveredByBar < 5).length;
    r.hiddenByHeader = stops.filter((s) => s.coveredByHeader >= 3);
    // Wheel / touch reachability of the last row.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    if (mobile) {
      const cdp = await ctx.newCDPSession(page);
      for (let i = 0; i < 20; i++) {
        await cdp.send("Input.synthesizeScrollGesture", { x: 200, y: 600, yDistance: -500, gestureSourceType: "touch", speed: 3000 }).catch((e) => (r.touchErr = String(e).slice(0, 120)));
      }
    } else {
      await page.mouse.move(900, 500);
      for (let i = 0; i < 40; i++) await page.mouse.wheel(0, 400);
    }
    await page.waitForTimeout(900);
    r.end = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="mechanic-quick-order-add-all"]')?.closest(".sticky, [class*=sticky]")?.getBoundingClientRect();
      const rows = [...document.querySelectorAll('[data-testid="mechanic-quick-order-row"]')];
      const last = rows.at(-1)?.getBoundingClientRect();
      return { rows: rows.length, barTop: bar && Math.round(bar.top), lastRowBottom: last && Math.round(last.bottom), vh: innerHeight, scrollY: Math.round(scrollY), maxScroll: document.documentElement.scrollHeight - innerHeight };
    });
    await shot(page, `vis-commerce/v3/${w}-quick-end`);
    // Initial-state image at the top of the results.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    await shot(page, `vis-commerce/v3/${w}-quick-top`);
    r.log = log;
    console.log("quick", w, JSON.stringify({ ...r, log: undefined }).slice(0, 1500));
    flush();
    await ctx.close();
  }
  // 360 header for the mechanic role
  {
    const ctx = await browser.newContext({ storageState: state, viewport: { width: 360, height: 780 }, isMobile: true, hasTouch: true, locale: "sr-Latn-RS", timezoneId: "Europe/Belgrade", userAgent: ua("h360") });
    const page = harden(await ctx.newPage());
    await page.goto(`${BASE}/delovi`);
    await settle(page, 1500);
    res.header360 = await page.evaluate(() => {
      const h = document.querySelector("header");
      const vw = document.documentElement.clientWidth;
      const btns = [...h.querySelectorAll("a,button")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => {
        const r = e.getBoundingClientRect();
        return `${(e.getAttribute("aria-label") || e.textContent).trim().slice(0, 30)} L${Math.round(r.left)} R${Math.round(r.right)} W${Math.round(r.width)}`;
      });
      return { vw, scrollW: document.documentElement.scrollWidth, overflowX: getComputedStyle(document.documentElement).overflowX + "/" + getComputedStyle(document.body).overflowX, btns };
    });
    await shot(page, "vis-commerce/v3/360-mechanic-header", { clip: { x: 0, y: 0, width: 360, height: 64 } });
    console.log("header360", JSON.stringify(res.header360));
    flush();
    await ctx.close();
  }
}

if (run("cart")) {
  res.cart = {};
  for (const [w, h] of [[390, 844], [360, 780]]) {
    const ctx = await browser.newContext({ storageState: cartState(), viewport: { width: w, height: h }, isMobile: true, hasTouch: true, locale: "sr-Latn-RS", timezoneId: "Europe/Belgrade", userAgent: ua(`c${w}`) });
    const page = harden(await ctx.newPage());
    const log = watch(page);
    await page.goto(`${BASE}/korpa`);
    await page.getByTestId("cart-line").first().waitFor({ timeout: 30000 });
    await settle(page, 1500);
    const r = (res.cart[w] = {});
    r.cart = await page.evaluate(() => {
      const cta = [...document.querySelectorAll("a,button")].find((e) => /Nastavi na porudžbinu/.test(e.textContent));
      const fixed = [...document.querySelectorAll("body *")].filter((e) => ["fixed", "sticky"].includes(getComputedStyle(e).position) && e.getBoundingClientRect().height > 0).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 50)}`);
      const lines = document.querySelectorAll('[data-testid="cart-line"]').length;
      const step = [...document.querySelectorAll('button[aria-label="Smanji količinu"],button[aria-label="Povećaj količinu"]')].map((b) => Math.round(b.getBoundingClientRect().height));
      return { lines, ctaTop: cta && Math.round(cta.getBoundingClientRect().top), vh: innerHeight, fixedOrSticky: fixed, stepperH: [...new Set(step)] };
    });
    // checkout mobile summary trigger
    await page.goto(`${BASE}/porudzbina`);
    await settle(page, 2000);
    r.summary = await page.evaluate(() => {
      const cands = [...document.querySelectorAll("button,summary")].filter((e) => /Ukupno/.test(e.textContent));
      return cands.map((e) => {
        const r = e.getBoundingClientRect();
        return { tag: e.tagName.toLowerCase(), text: e.textContent.trim().replace(/\s+/g, " ").slice(0, 60), expanded: e.getAttribute("aria-expanded"), controls: e.getAttribute("aria-controls"), svgs: e.querySelectorAll("svg").length, visibleSvgs: [...e.querySelectorAll("svg")].filter((s) => s.getBoundingClientRect().width > 0).length, h: Math.round(r.height), top: Math.round(r.top) };
      });
    });
    await shot(page, `vis-commerce/v3/${w}-co-summary-collapsed`, { clip: { x: 0, y: 180, width: w, height: 160 } });
    r.log = log;
    console.log("cart", w, JSON.stringify(r).slice(0, 1500));
    flush();
    await ctx.close();
  }
}

if (run("upit")) {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "viscom3-upit" });
  const page = harden(await ctx.newPage());
  await page.goto(`${BASE}/upit`);
  await settle(page, 2000);
  res.upit = await page.evaluate(() =>
    [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]),select,textarea")]
      .filter((e) => e.getBoundingClientRect().width > 2)
      .map((e) => `${e.tagName.toLowerCase()}#${e.id || e.name || "?"} font=${getComputedStyle(e).fontSize} h=${Math.round(e.getBoundingClientRect().height)} label=${(e.labels?.[0]?.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 30)}`),
  );
  const sel = page.locator("select").filter({ hasText: "Dodaj kategoriju" }).first();
  if (await sel.count()) {
    await sel.scrollIntoViewIfNeeded();
    const bb = await sel.boundingBox();
    await shot(page, "vis-commerce/v3/390-upit-category-select", { clip: { x: 0, y: Math.max(0, bb.y - 120), width: 390, height: 220 } });
  }
  console.log("upit", JSON.stringify(res.upit));
  flush();
  await ctx.close();
}

flush();
await browser.close();
console.log("done");
