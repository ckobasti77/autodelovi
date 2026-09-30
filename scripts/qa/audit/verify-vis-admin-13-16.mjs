// Independent verification of vis-admin-13..16 (empty states, truncation, quote qty wrap, e-mail breaks).
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, loginAdmin, shot } from "./kit.mjs";

const DIR = "verify/vis-admin";
mkdirSync("docs/qa/audit/verify/vis-admin", { recursive: true });
const out = {};
const only = process.argv[2] ?? "all";
const browser = await launch("chromium");

async function adminPage(width, height, tag) {
  const ctx = await newContext(browser, { width, height, tag });
  const page = await ctx.newPage();
  const log = watch(page);
  for (let i = 0; i < 3; i++) {
    try {
      await loginAdmin(page);
      break;
    } catch (e) {
      console.log("login retry", i, String(e).slice(0, 120));
    }
  }
  return { ctx, page, log };
}

// ---------- 13: filtered-empty lists ----------
if (only === "all" || only === "13") {
  const { ctx, page } = await adminPage(1440, 900, "ver-va13");
  out["13"] = {};
  for (const [route, name] of [
    ["/admin/proizvodi", "products"],
    ["/admin/porudzbine", "orders"],
    ["/admin/upiti", "inquiries"],
  ]) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const search = page.locator("input[data-admin-search]").first();
    const hasSearch = (await search.count()) > 0;
    if (hasSearch) {
      await search.fill("zzqqxx999");
      await page.waitForTimeout(2500);
    }
    const info = await page.evaluate(() => {
      const tbody = document.querySelector("main table tbody");
      const emptyP = [...document.querySelectorAll("main table p, main p")].find((p) =>
        /^Nema /.test(p.textContent.trim()),
      );
      const cell = emptyP?.closest("td") ?? emptyP?.parentElement;
      const btnsInEmpty = cell ? [...cell.querySelectorAll("button, a")].map((b) => b.textContent.trim()) : null;
      const input = document.querySelector("input[data-admin-search]");
      const cancel = input ? getComputedStyle(input, "::-webkit-search-cancel-button").appearance : null;
      const filtersBtn = [...document.querySelectorAll("main button")].find((b) => /^Filteri/.test(b.textContent.trim()));
      return {
        url: location.pathname + location.search,
        emptyText: emptyP?.textContent.trim() ?? null,
        actionsInEmptyCell: btnsInEmpty,
        searchValue: input?.value ?? null,
        searchCancelAppearance: cancel,
        filtersButton: filtersBtn?.textContent.trim() ?? null,
        rows: tbody ? tbody.querySelectorAll("tr").length : null,
      };
    });
    out["13"][name] = { hasSearch, ...info };
    await shot(page, `${DIR}/vis-admin-13-reproduce-${name}`);
    // Keyboard-only exit: Escape in a type=search input clears it in Chromium.
    if (hasSearch) {
      await search.focus();
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1500);
      out["13"][name].afterEscape = await page.evaluate(() => ({
        value: document.querySelector("input[data-admin-search]")?.value,
        url: location.pathname + location.search,
      }));
    }
  }
  await ctx.close();
}

// ---------- 14: truncated cells without title ----------
async function truncScan(page, selectorHint) {
  return page.evaluate((hint) => {
    const els = [...document.querySelectorAll(`${hint} .truncate`)];
    const res = [];
    for (const e of els) {
      if (!e.offsetParent) continue;
      if (e.scrollWidth <= e.clientWidth + 1) continue;
      const titled = !!e.closest("[title]");
      const col = e.closest("td")
        ? (() => {
            const td = e.closest("td");
            const idx = [...td.parentElement.children].indexOf(td);
            return td.closest("table")?.querySelectorAll("thead th")[idx]?.textContent.trim() ?? idx;
          })()
        : null;
      res.push({ col, titled, text: e.textContent.trim().slice(0, 80), sw: e.scrollWidth, cw: e.clientWidth });
    }
    const summary = {};
    for (const r of res) {
      const k = `${r.col ?? "(no td)"}|titled=${r.titled}`;
      summary[k] = (summary[k] ?? 0) + 1;
    }
    return { total: res.length, summary, sample: res.slice(0, 6) };
  }, selectorHint);
}
if (only === "all" || only === "14") {
  out["14"] = {};
  for (const [w, h] of [
    [1440, 900],
    [1280, 800],
  ]) {
    const { ctx, page } = await adminPage(w, h, `ver-va14-${w}`);
    for (const [route, name] of [
      ["/admin/upiti", "upiti"],
      ["/admin/mejlovi", "mejlovi"],
      ["/admin", "dashboard"],
      ["/admin/proizvodi", "proizvodi"],
    ]) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2500);
      out["14"][`${name}-${w}`] = await truncScan(page, "main");
      if (w === 1440 && (name === "upiti" || name === "mejlovi")) {
        // hover the first truncated cell and capture the viewport
        const idx = await page.evaluate(() => {
          const els = [...document.querySelectorAll("main td .truncate")];
          const i = els.findIndex((e) => e.offsetParent && e.scrollWidth > e.clientWidth + 1);
          if (i >= 0) els[i].setAttribute("data-ver-trunc", "1");
          return i;
        });
        if (idx >= 0) {
          const loc = page.locator("[data-ver-trunc]").first();
          await loc.scrollIntoViewIfNeeded();
          await loc.hover();
          await page.waitForTimeout(1500);
          const box = await loc.boundingBox();
          out["14"][`${name}-hoverTooltipVisible`] = await page.evaluate(
            () => !!document.querySelector('[role="tooltip"]'),
          );
          await shot(page, `${DIR}/vis-admin-14-reproduce-${name}-hover`, {
            clip: { x: Math.max(0, box.x - 300), y: Math.max(0, box.y - 120), width: 1000, height: 300 },
          });
        }
      }
    }
    await ctx.close();
  }
}

// ---------- 15: quote quantity wrap ----------
if (only === "all" || only === "15") {
  out["15"] = {};
  for (const [w, h] of [
    [360, 780],
    [390, 844],
    [430, 932],
    [768, 1024],
  ]) {
    const { ctx, page } = await adminPage(w, h, `ver-va15-${w}`);
    await page.goto(`${BASE}/admin/upiti/UP-2026-000003`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      const tds = [...document.querySelectorAll("main td")].filter((td) => /^\d+\s×$/.test(td.textContent.trim()));
      return tds.map((td, i) => {
        td.setAttribute("data-ver-qty", String(i));
        const range = document.createRange();
        range.selectNodeContents(td);
        const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
        const cs = getComputedStyle(td);
        return {
          text: JSON.stringify(td.textContent),
          lines,
          width: Math.round(td.getBoundingClientRect().width),
          height: Math.round(td.getBoundingClientRect().height),
          whiteSpace: cs.whiteSpace,
          tableW: Math.round(td.closest("table").getBoundingClientRect().width),
        };
      });
    });
    out["15"][w] = info;
    if (info.length) {
      const tbl = page.locator("[data-ver-qty='0']").locator("xpath=ancestor::table[1]");
      await tbl.scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);
      if (w === 390 || w === 360) await shot(page, `${DIR}/vis-admin-15-reproduce-${w}`, { locator: tbl });
    }
    await ctx.close();
  }
}

// ---------- 16: e-mail breaks ----------
async function emailBreaks(page) {
  return page.evaluate(() => {
    const as = [...document.querySelectorAll('main a[href^="mailto:"]')].filter((a) => a.offsetParent);
    return as.map((a) => {
      const range = document.createRange();
      range.selectNodeContents(a);
      const rects = [...range.getClientRects()];
      const tops = [...new Set(rects.map((r) => Math.round(r.top)))];
      // reconstruct line fragments
      const text = a.textContent;
      const tn = a.firstChild;
      const frags = [];
      if (tn && tn.nodeType === 3 && tops.length > 1) {
        let cur = "";
        let lastTop = null;
        for (let i = 0; i < text.length; i++) {
          const r = document.createRange();
          r.setStart(tn, i);
          r.setEnd(tn, i + 1);
          const t = Math.round(r.getBoundingClientRect().top);
          if (lastTop !== null && Math.abs(t - lastTop) > 3) {
            frags.push(cur);
            cur = "";
          }
          cur += text[i];
          lastTop = t;
        }
        frags.push(cur);
      }
      const cs = getComputedStyle(a);
      const dd = a.closest("dd");
      return {
        email: text,
        lines: tops.length,
        frags,
        aWordBreak: cs.wordBreak,
        aOverflowWrap: cs.overflowWrap,
        ddOverflowWrap: dd ? getComputedStyle(dd).overflowWrap : null,
        ddWidth: dd ? Math.round(dd.getBoundingClientRect().width) : null,
      };
    });
  });
}
if (only === "all" || only === "16") {
  out["16"] = {};
  // customer detail via lookup
  {
    const { ctx, page } = await adminPage(1440, 900, "ver-va16-1440");
    await page.goto(`${BASE}/admin/kupci`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const lookup = page.getByPlaceholder("tačna e-mail adresa…");
    await lookup.fill("audit-majstor-5455287@primer.rs");
    await page.waitForTimeout(2500);
    const href = await page.evaluate(
      () => [...document.querySelectorAll('main a[href*="/admin/kupci/"]')].map((a) => a.getAttribute("href"))[0] ?? null,
    );
    out["16"].customerHref = href;
    // also list some customer hrefs for Dragan Jović
    if (href) {
      for (const [w, h] of [
        [1440, 900],
        [1280, 800],
        [1920, 1080],
        [390, 844],
      ]) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(`${BASE}${href}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(2500);
        out["16"][`customer-${w}`] = await emailBreaks(page);
        if (w === 1440) {
          const aside = page.locator('aside[aria-label="Podaci o kupcu"]');
          if (await aside.count()) await shot(page, `${DIR}/vis-admin-16-reproduce-customer-1440`, { locator: aside });
        }
      }
    }
    // order detail at 1024 / 1280 / 1440
    for (const [w, h] of [
      [1024, 768],
      [1280, 800],
      [1440, 900],
    ]) {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`${BASE}/admin/porudzbine/SK-2026-000092`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2500);
      out["16"][`order-${w}`] = await emailBreaks(page);
      if (w === 1024) {
        const a = page.locator('main a[href^="mailto:"]').first();
        if (await a.count()) {
          await a.scrollIntoViewIfNeeded();
          await page.waitForTimeout(600);
          const box = await a.boundingBox();
          await shot(page, `${DIR}/vis-admin-16-reproduce-order-1024`, {
            clip: { x: Math.max(0, box.x - 180), y: Math.max(0, box.y - 140), width: 520, height: 300 },
          });
        }
      }
    }
    // inquiry detail
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE}/admin/upiti/UP-2026-000003`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    out["16"]["inquiry-1440"] = await emailBreaks(page);
    await ctx.close();
  }
}

await browser.close();
writeFileSync(`docs/qa/audit/verify/vis-admin/vis-admin-${only}-reproduce.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
