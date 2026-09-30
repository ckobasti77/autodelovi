/**
 * Independent verification of vis-admin-17..20 (step 21 QA).
 *   node scripts/qa/audit/verify-vis-admin-17-20.mjs
 * Evidence: docs/qa/audit/verify/vis-admin/<key>-reproduce.*
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, loginAdmin, shot } from "./kit.mjs";

const DIR = "verify/vis-admin";
mkdirSync(`docs/qa/audit/${DIR}`, { recursive: true });
const out = {};
const save = (k) => writeFileSync(`docs/qa/audit/${DIR}/${k}-reproduce.json`, JSON.stringify(out[k], null, 2));

async function go(page, r) {
  for (let i = 0; i < 2; i++) {
    try {
      await page.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 60_000 });
      break;
    } catch {
      console.log("retry", r);
    }
  }
  await page.waitForLoadState("load").catch(() => {});
  await page
    .waitForFunction(() => !!document.querySelector("main h1") && !document.querySelector('main [aria-busy="true"]'), null, { timeout: 25_000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
}

const only = process.argv[2];
const browser = await launch();

// ---------- vis-admin-17: top bar vs main column at wide widths ----------
if (!only || only === "17") {
  out["vis-admin-17"] = {};
  for (const w of [1440, 1920, 2200, 2560]) {
    const ctx = await newContext(browser, { width: w, height: w === 2560 ? 1440 : 1080, tag: "v17" });
    const page = await ctx.newPage();
    const log = watch(page);
    await loginAdmin(page);
    for (const r of ["/admin/porudzbine", "/admin", "/admin/podesavanja"]) {
      await go(page, r);
      const m = await page.evaluate(() => {
        const rect = (el) => {
          if (!el) return null;
          const b = el.getBoundingClientRect();
          return { x: Math.round(b.left), r: Math.round(b.right), y: Math.round(b.top), w: Math.round(b.width) };
        };
        const header = document.querySelector("header.sticky");
        const crumb = header?.querySelector('nav[aria-label="Putanja"] ol');
        const crumbFirst = header?.querySelector('nav[aria-label="Putanja"] li');
        const searchBtn = [...(header?.querySelectorAll("button") ?? [])].find((b) => /Ctrl K/.test(b.textContent));
        const account = header?.querySelector('button[aria-label^="Nalog"]');
        const main = document.querySelector("main#sadrzaj");
        const h1 = main?.querySelector("h1");
        const table = main?.querySelector("table");
        const cs = main ? getComputedStyle(main) : null;
        const mainInner = main
          ? { x: Math.round(main.getBoundingClientRect().left + parseFloat(cs.paddingLeft)), r: Math.round(main.getBoundingClientRect().right - parseFloat(cs.paddingRight)) }
          : null;
        return {
          header: rect(header),
          crumbFirst: rect(crumbFirst),
          crumbText: crumb?.textContent,
          search: rect(searchBtn),
          account: rect(account),
          main: rect(main),
          mainInner,
          h1: rect(h1),
          h1Text: h1?.textContent,
          table: rect(table),
        };
      });
      m.leftOffset = m.h1 && m.crumbFirst ? m.h1.x - m.crumbFirst.x : null;
      m.rightOffset = m.account && m.mainInner ? m.account.r - m.mainInner.r : null;
      out["vis-admin-17"][`${w}${r}`] = m;
      console.log(w, r, JSON.stringify({ crumb: m.crumbFirst, h1: m.h1, main: m.main, inner: m.mainInner, account: m.account, left: m.leftOffset, right: m.rightOffset }));
      if (r === "/admin/porudzbine" && (w === 2560 || w === 1920)) {
        await shot(page, `${DIR}/vis-admin-17-reproduce-${w}`, { clip: { x: 0, y: 0, width: w, height: 360 } });
      }
    }
    out["vis-admin-17"][`${w}-log`] = { console: log.console.slice(0, 5), pageErrors: log.pageErrors.slice(0, 5) };
    await ctx.close();
  }
  save("vis-admin-17");
}

// ---------- vis-admin-18: 7-day KPI trend ----------
if (!only || only === "18") {
  out["vis-admin-18"] = {};
  for (const [w, h] of [[1440, 900], [390, 844], [1920, 1080], [1024, 768]]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: "v18" });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await go(page, "/admin");
    await page.waitForFunction(() => [...document.querySelectorAll("main a")].some((a) => /Poslednjih 7 dana/.test(a.textContent)), null, { timeout: 25_000 }).catch(() => {});
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const a = [...document.querySelectorAll("main a")].find((x) => /Poslednjih 7 dana/.test(x.textContent));
      if (!a) return null;
      const sub = a.querySelector("span.type-caption.text-ink-2");
      const trend = sub?.querySelector("span.inline-flex") ?? sub;
      const svg = trend?.querySelector("svg");
      const range = document.createRange();
      const textNode = [...(trend?.childNodes ?? [])].find((n) => n.nodeType === 3 && n.textContent.trim());
      let lines = [];
      if (textNode) {
        range.selectNodeContents(trend);
        lines = [...range.getClientRects()].map((r) => ({ x: Math.round(r.left), y: Math.round(r.top), b: Math.round(r.bottom), w: Math.round(r.width) }));
      }
      const sb = svg?.getBoundingClientRect();
      const tb = trend?.getBoundingClientRect();
      return {
        tileText: a.innerText,
        trendText: trend?.textContent,
        svg: sb ? { x: Math.round(sb.left), y: Math.round(sb.top), b: Math.round(sb.bottom), w: Math.round(sb.width), h: Math.round(sb.height) } : null,
        trendBox: tb ? { x: Math.round(tb.left), y: Math.round(tb.top), b: Math.round(tb.bottom), w: Math.round(tb.width), h: Math.round(tb.height) } : null,
        lineHeight: trend ? getComputedStyle(trend).lineHeight : null,
        fontSize: trend ? getComputedStyle(trend).fontSize : null,
        textLines: lines,
        tile: (() => {
          const b = a.getBoundingClientRect();
          return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) };
        })(),
      };
    });
    out["vis-admin-18"][w] = m;
    console.log(w, JSON.stringify(m));
    if (m?.tile) {
      await page.evaluate((y) => window.scrollTo(0, Math.max(0, y - 120)), m.tile.y);
      await page.waitForTimeout(400);
      const t = await page.evaluate(() => {
        const a = [...document.querySelectorAll("main a")].find((x) => /Poslednjih 7 dana/.test(x.textContent));
        const b = a.getBoundingClientRect();
        return { x: b.left, y: b.top, w: b.width, h: b.height };
      });
      const pad = 8;
      await shot(page, `${DIR}/vis-admin-18-reproduce-${w}`, {
        clip: { x: Math.max(0, t.x - pad), y: Math.max(0, t.y - pad), width: Math.min(w - Math.max(0, t.x - pad), t.w + pad * 2), height: t.h + pad * 2 },
      });
      await page.setViewportSize({ width: w, height: h });
    }
    await ctx.close();
  }
  save("vis-admin-18");
}

// ---------- vis-admin-19: settings tab label vs content ----------
if (!only || only === "19") {
  out["vis-admin-19"] = {};
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "v19" });
  const page = await ctx.newPage();
  await loginAdmin(page);
  await go(page, "/admin/podesavanja");
  const tab = page.getByRole("tab", { name: "Dostava i plaćanje" });
  await tab.click();
  await page.waitForTimeout(1200);
  const m = await page.evaluate(() => {
    const active = document.querySelector('[role="tab"][aria-selected="true"]');
    const panel = document.querySelector('[role="tabpanel"]:not([hidden])');
    const headings = [...(panel?.querySelectorAll("h2, h3, legend") ?? [])].map((hh) => hh.textContent.trim()).slice(0, 12);
    const tabs = [...document.querySelectorAll('[role="tab"]')].map((t) => t.textContent.trim());
    return { url: location.pathname + location.search, activeTab: active?.textContent.trim(), tabs, headings };
  });
  out["vis-admin-19"] = m;
  console.log(JSON.stringify(m));
  await shot(page, `${DIR}/vis-admin-19-reproduce-1440`, { clip: { x: 0, y: 0, width: 1440, height: 900 } });
  // Also 390
  const ctx2 = await newContext(browser, { width: 390, height: 844, tag: "v19m" });
  const p2 = await ctx2.newPage();
  await loginAdmin(p2);
  await go(p2, "/admin/podesavanja?tab=prodaja");
  out["vis-admin-19"].mobile = await p2.evaluate(() => ({
    activeTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent.trim(),
    headings: [...(document.querySelector('[role="tabpanel"]:not([hidden])')?.querySelectorAll("h2, h3, legend") ?? [])].map((hh) => hh.textContent.trim()).slice(0, 6),
  }));
  await shot(p2, `${DIR}/vis-admin-19-reproduce-390`);
  await ctx.close();
  await ctx2.close();
  save("vis-admin-19");
}

// ---------- vis-admin-20: two „Zatvori“ actions ----------
if (!only || only === "20") {
  out["vis-admin-20"] = {};
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: "v20" });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await go(page, "/admin/upiti/" + (process.env.INQ ?? "UP-2026-000054"));
    const before = await page.evaluate(() => ({
      h1: document.querySelector("main h1")?.textContent,
      buttons: [...document.querySelectorAll("main button")].map((b) => (b.getAttribute("aria-label") || b.textContent).trim()).filter(Boolean),
    }));
    const compose = page.getByTestId("admin-quote-compose");
    const composeLabel = (await compose.count()) ? (await compose.textContent())?.trim() : null;
    if (composeLabel) {
      await compose.click();
      await page.waitForTimeout(1200);
    }
    const after = await page.evaluate(() => {
      const btns = [...document.querySelectorAll("main button")];
      const closeLike = btns
        .filter((b) => /^Zatvori/.test(b.textContent.trim()))
        .map((b) => {
          const r = b.getBoundingClientRect();
          return { text: b.textContent.trim(), aria: b.getAttribute("aria-label"), x: Math.round(r.left), y: Math.round(r.top + window.scrollY) };
        });
      const sectionTitle = [...document.querySelectorAll("main section h2, main section h3")].map((x) => x.textContent.trim());
      return { closeLike, sectionTitle };
    });
    out["vis-admin-20"][w] = { before, composeLabel, after };
    console.log(w, JSON.stringify(out["vis-admin-20"][w]));
    if (w === 1440) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await shot(page, `${DIR}/vis-admin-20-reproduce-1440`);
      const comp = page.locator("main section").filter({ has: page.getByRole("button", { name: "Zatvori", exact: true }) }).first();
      if (await comp.count()) {
        await comp.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
        await shot(page, `${DIR}/vis-admin-20-reproduce-1440-composer`);
      }
    } else {
      await shot(page, `${DIR}/vis-admin-20-reproduce-390`);
    }
    await ctx.close();
  }
  save("vis-admin-20");
}

await browser.close();
