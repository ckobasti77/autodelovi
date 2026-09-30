// Independent verification of vis-commerce-03..06 (step 21 verify pass).
//   node scripts/qa/audit/verify-vis-commerce-0306.mjs [predracun] [cart] [mech]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, loginWith } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/vis-commerce";
mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2);
const run = (k) => !want.length || want.includes(k);
const res = {};
const outFile = `${OUT}/verify-0306.json`;
const flush = () => writeFileSync(outFile, JSON.stringify(res, null, 2));
const browser = await launch();
const settle = (page, ms = 1200) => page.waitForLoadState("networkidle").catch(() => {}).then(() => page.waitForTimeout(ms));

const TOKEN = "GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw";

if (run("predracun")) {
  res.predracun = {};
  for (const [w, h] of [[360, 780], [390, 844], [430, 932], [768, 1024], [1440, 900]]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: `vvc-pr${w}` });
    const page = await ctx.newPage();
    const log = watch(page);
    await page.goto(`${BASE}/porudzbina/${TOKEN}/predracun`);
    await settle(page, 1500);
    const r = await page.evaluate(() => {
      const t = document.querySelector("table");
      if (!t) return null;
      const heads = [...t.querySelectorAll("thead th")].map((th) => ({ t: th.textContent.trim(), w: Math.round(th.getBoundingClientRect().width), h: Math.round(th.getBoundingClientRect().height) }));
      const rows = [...t.querySelectorAll("tbody tr")].map((tr) => {
        const td = tr.querySelector("td");
        const cs = getComputedStyle(td);
        const lh = parseFloat(cs.lineHeight) || 20;
        const code = td.querySelector("span");
        let codeLines = null;
        if (code) {
          const range = document.createRange();
          range.selectNodeContents(code);
          const tops = new Set([...range.getClientRects()].map((q) => Math.round(q.top)));
          codeLines = tops.size;
        }
        return { text: td.textContent.trim().replace(/\s+/g, " ").slice(0, 90), cellH: Math.round(td.getBoundingClientRect().height), cellW: Math.round(td.getBoundingClientRect().width), approxLines: Math.round((td.getBoundingClientRect().height - 16) / lh), codeLines };
      });
      const tr = t.getBoundingClientRect();
      return { tableW: Math.round(tr.width), tableTop: Math.round(tr.top + scrollY), vw: document.documentElement.clientWidth, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, heads, rows };
    });
    res.predracun[w] = { ...r, errors: log.console.concat(log.pageErrors) };
    if (r && w <= 430) {
      await page.evaluate((y) => window.scrollTo(0, y - 70), r.tableTop);
      await page.waitForTimeout(500);
      await shot(page, `verify/vis-commerce/vis-commerce-03-reproduce-${w}`);
    }
    if (r && w === 1440) {
      await page.evaluate((y) => window.scrollTo(0, y - 200), r.tableTop);
      await page.waitForTimeout(400);
      await shot(page, `verify/vis-commerce/vis-commerce-03-reproduce-1440`);
    }
    // print emulation at 360 to see if print is fine
    if (w === 360) {
      await page.emulateMedia({ media: "print" });
      res.predracun.print360 = await page.evaluate(() => [...document.querySelectorAll("table thead th")].map((th) => Math.round(th.getBoundingClientRect().width)));
      await page.emulateMedia({ media: "screen" });
    }
    console.log("predracun", w, JSON.stringify(res.predracun[w]).slice(0, 900));
    flush();
    await ctx.close();
  }
}

async function buildCart(page) {
  await page.goto(`${BASE}/delovi/kocioni-diskovi`);
  await settle(page, 1500);
  const hrefs = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="/deo/"]')].map((a) => a.getAttribute("href")))].slice(0, 12));
  const added = [];
  for (const href of ["/deo/kocioni-disk-prednji-276-24-mm-demo-0004", ...hrefs]) {
    if (added.length >= 3) break;
    if (added.includes(href)) continue;
    await page.goto(`${BASE}${href}`);
    await settle(page, 1200);
    const btn = page.getByTestId("product-add-to-cart").first();
    if (!(await btn.count())) continue;
    const label = (await btn.textContent())?.trim() ?? "";
    if (!/Dodaj u korpu/.test(label) || (await btn.isDisabled())) continue;
    if (added.length === 0) {
      const inc = page.locator('button[aria-label="Povećaj količinu"]').first();
      if (await inc.count()) await inc.click();
    }
    await btn.click();
    await page.waitForTimeout(1800);
    // close drawer if it opened
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    added.push(href);
  }
  return added;
}

if (run("cart")) {
  res.cart = {};
  const ctx0 = await newContext(browser, { width: 390, height: 844, tag: "vvc-cartbuild" });
  const p0 = await ctx0.newPage();
  res.cart.added = await buildCart(p0);
  const state = await ctx0.storageState();
  writeFileSync(`${OUT}/_cart-state.json`, JSON.stringify(state));
  await ctx0.close();
  console.log("added", res.cart.added);

  for (const [w, h] of [[360, 780], [390, 844], [430, 932], [768, 1024], [1440, 900]]) {
    const mobile = w < 1024;
    const ctx = await browser.newContext({ storageState: state, viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, locale: "sr-Latn-RS", timezoneId: "Europe/Belgrade", userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36 SklopAudit-vvc-c${w}/${Date.now()}` });
    const page = await ctx.newPage();
    const log = watch(page);
    await page.goto(`${BASE}/korpa`);
    await page.getByTestId("cart-line").first().waitFor({ timeout: 30000 });
    await settle(page, 1500);
    const r = (res.cart[w] = {});
    r.page = await page.evaluate(() => {
      const cta = document.querySelector('[data-testid="cart-checkout"]');
      const fixed = [...document.querySelectorAll("body *")].filter((e) => ["fixed", "sticky"].includes(getComputedStyle(e).position) && e.getBoundingClientRect().height > 0).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 60)} top=${Math.round(e.getBoundingClientRect().top)} h=${Math.round(e.getBoundingClientRect().height)}`);
      const lines = [...document.querySelectorAll('[data-testid="cart-line"]')].map((l) => Math.round(l.getBoundingClientRect().height));
      const steppers = [...document.querySelectorAll('button[aria-label="Smanji količinu"],button[aria-label="Povećaj količinu"],input[aria-label="Količina"]')].map((b) => `${b.getAttribute("aria-label")} ${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
      const trash = [...document.querySelectorAll('button[aria-label^="Ukloni"]')].map((b) => `${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
      const total = [...document.querySelectorAll("aside dt, aside dd")].map((e) => e.textContent.trim()).slice(0, 12);
      const aside = document.querySelector('aside[aria-label="Ukupno"]');
      return { vh: innerHeight, ctaTop: cta && Math.round(cta.getBoundingClientRect().top), ctaBottom: cta && Math.round(cta.getBoundingClientRect().bottom), asideTop: aside && Math.round(aside.getBoundingClientRect().top), lineHeights: lines, fixedOrSticky: fixed, steppers: [...new Set(steppers)], trash: [...new Set(trash)], total, docH: document.documentElement.scrollHeight };
    });
    if (w <= 430 || w === 1440) await shot(page, `verify/vis-commerce/vis-commerce-04-reproduce-${w}-korpa`);
    // Drawer from header
    if (w === 390 || w === 1440) {
      await page.getByTestId("cart-button").first().click();
      await page.waitForTimeout(1500);
      r.drawer = await page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        if (!dlg) return null;
        const cta = [...dlg.querySelectorAll("a,button")].find((e) => /Nastavi na porudžbinu/.test(e.textContent));
        const steppers = [...dlg.querySelectorAll('button[aria-label="Smanji količinu"],button[aria-label="Povećaj količinu"]')].map((b) => `${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
        return { ctaTop: cta && Math.round(cta.getBoundingClientRect().top), ctaBottom: cta && Math.round(cta.getBoundingClientRect().bottom), vh: innerHeight, steppers: [...new Set(steppers)] };
      });
      await shot(page, `verify/vis-commerce/vis-commerce-04-reproduce-${w}-drawer`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
    }
    // Checkout summary
    await page.goto(`${BASE}/porudzbina`);
    await settle(page, 2000);
    const det = page.locator("details").filter({ has: page.locator("summary", { hasText: "Ukupno" }) }).first();
    r.checkout = await page.evaluate(() => {
      const s = [...document.querySelectorAll("summary")].find((e) => /Ukupno/.test(e.textContent));
      if (!s) return { summary: null };
      const rr = s.getBoundingClientRect();
      const cs = getComputedStyle(s);
      const before = getComputedStyle(s, "::before").content;
      const after = getComputedStyle(s, "::after").content;
      const marker = getComputedStyle(s, "::marker").content;
      const visible = rr.width > 0 && rr.height > 0;
      return { visible, text: s.textContent.trim().replace(/\s+/g, " "), svgs: s.querySelectorAll("svg").length, display: cs.display, listStyle: cs.listStyleType, before, after, marker, top: Math.round(rr.top), h: Math.round(rr.height), ariaExpanded: s.getAttribute("aria-expanded") };
    });
    if (w <= 430 || w === 768) {
      const box = await det.boundingBox().catch(() => null);
      if (box) await shot(page, `verify/vis-commerce/vis-commerce-06-reproduce-${w}-collapsed`, { clip: { x: 0, y: Math.max(0, box.y - 90), width: w, height: Math.min(h, box.height + 140) } });
      if (await det.count()) {
        await det.locator("summary").click();
        await page.waitForTimeout(700);
        r.checkoutOpen = await page.evaluate(() => {
          const d = [...document.querySelectorAll("details")].find((e) => /Ukupno/.test(e.querySelector("summary")?.textContent ?? ""));
          const all = [...d.querySelectorAll("*")].filter((e) => e.childElementCount === 0 && /^Ukupno$/.test(e.textContent.trim()) && e.getBoundingClientRect().height > 0);
          return { open: d.open, ukupnoLabels: all.length, detailsH: Math.round(d.getBoundingClientRect().height) };
        });
        const b2 = await det.boundingBox();
        await shot(page, `verify/vis-commerce/vis-commerce-06-reproduce-${w}-open`, { clip: { x: 0, y: Math.max(0, b2.y - 10), width: w, height: Math.min(h, b2.height + 20) } });
      }
    }
    r.log = { console: log.console, pageErrors: log.pageErrors };
    console.log("cart", w, JSON.stringify(r).slice(0, 1800));
    flush();
    await ctx.close();
  }
}

if (run("mech")) {
  res.mech = {};
  const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8")).mechanic;
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const mobile = w < 1024;
    const ctx = await newContext(browser, { width: w, height: h, mobile, tag: `vvc-m${w}` });
    const page = await ctx.newPage();
    let ok = false;
    for (let i = 0; i < 2 && !ok; i++) {
      try { await loginWith(page, acc.email, acc.password, "/majstor"); ok = true; } catch (e) { console.log("login retry", String(e).slice(0, 100)); }
    }
    if (!ok) { res.mech[w] = "login failed"; continue; }
    await page.goto(`${BASE}/majstor/brza-porudzbina`);
    await settle(page, 1500);
    await page.getByTestId("mechanic-quick-order-input").fill(["5Q0 615 505 R 2", "1K0 615 868 F", "1K0 615 540 Q"].join("\n"));
    await page.getByTestId("mechanic-quick-order-check").click();
    await page.getByTestId("mechanic-quick-order-row").first().waitFor({ timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector('[data-testid="mechanic-quick-order-row"][data-status="pending"]'), null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1200);
    res.mech[w] = { quick: await page.evaluate(() => {
      const st = [...document.querySelectorAll('[data-testid="mechanic-quick-order-row"] button[aria-label="Smanji količinu"], [data-testid="mechanic-quick-order-row"] button[aria-label="Povećaj količinu"]')];
      const rm = [...document.querySelectorAll('[data-testid="mechanic-quick-order-row"] button[aria-label^="Ukloni red"]')];
      const gap = st.length && rm.length ? Math.round(rm[0].getBoundingClientRect().left - st[1].getBoundingClientRect().right) : null;
      return { steppers: [...new Set(st.map((b) => `${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`))], remove: [...new Set(rm.map((b) => `${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`))], gapStepperToRemove: gap };
    }) };
    const row = page.getByTestId("mechanic-quick-order-row").first();
    await row.scrollIntoViewIfNeeded();
    await shot(page, `verify/vis-commerce/vis-commerce-05-reproduce-${w}-quick`, { locator: row });
    await page.goto(`${BASE}/majstor/omiljeno`);
    await settle(page, 1500);
    res.mech[w].fav = await page.evaluate(() => {
      const st = [...document.querySelectorAll('button[aria-label="Smanji količinu"], button[aria-label="Povećaj količinu"]')];
      return { count: st.length, sizes: [...new Set(st.map((b) => `${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`))] };
    });
    console.log("mech", w, JSON.stringify(res.mech[w]));
    flush();
    await ctx.close();
  }
}

flush();
await browser.close();
