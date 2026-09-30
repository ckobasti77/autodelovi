/**
 * vis-store (second reviewer): targeted verification of candidate findings.
 * Usage: node scripts/qa/audit/vis-store-verify.mjs [check,...]
 * Checks: wrap, stage, cardclip, tinybtn, zero, sheet, focus, buybar
 */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, scrollThrough } from "./kit.mjs";

const want = (process.argv[2] ?? "wrap,stage,cardclip,tinybtn,zero,sheet,focus,buybar").split(",");
const out = {};
const browser = await launch();
const open = async (w, h, url, dpr = 1, extra = {}) => {
  const ctx = await newContext(browser, {
    width: w,
    height: h,
    deviceScaleFactor: dpr,
    tag: `vis-store-v-${w}-${Math.random().toString(36).slice(2, 6)}`,
    ...extra,
  });
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(1500);
  return { ctx, page };
};

// A: a line starting with the dimension sign or the unit in product names (DESIGN-SYSTEM 4.4 no-break spaces)
if (want.includes("wrap")) {
  out.wrap = {};
  const jobs = [
    [1440, "/delovi/kocioni-diskovi"],
    [1280, "/delovi/kocioni-diskovi"],
    [1024, "/delovi/kocioni-diskovi"],
    [390, "/delovi/kocioni-diskovi"],
    [360, "/delovi/kocioni-diskovi"],
    [1440, "/pretraga?q=disk"],
    [1920, "/pretraga?q=disk"],
  ];
  for (const [w, url] of jobs) {
    const { ctx, page } = await open(w, 900, url);
    await scrollThrough(page, { stepMs: 80 });
    const res = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll("main h1, main h3")) {
        const text = el.textContent;
        if (!/×|mm/.test(text)) continue;
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let lastTop = null;
        let n;
        while ((n = walker.nextNode())) {
          for (let i = 0; i < n.data.length; i++) {
            if (/\s/.test(n.data[i])) continue;
            const r = document.createRange();
            r.setStart(n, i);
            r.setEnd(n, i + 1);
            const rect = r.getBoundingClientRect();
            if (rect.height === 0) continue;
            if (lastTop !== null && rect.top > lastTop + 4) {
              const rest = n.data.slice(i, i + 8);
              if (/^(×|mm)/.test(rest)) bad.push({ text: text.trim(), lineStartsWith: rest, top: Math.round(rect.top + scrollY) });
            }
            lastTop = rect.top;
          }
        }
      }
      return bad;
    });
    out.wrap[`${url}@${w}`] = res;
    console.log("wrap", url, w, JSON.stringify(res));
    if (res.length && (w === 1440 || w === 360)) {
      await page.evaluate((y) => window.scrollTo(0, y - 300), res[0].top);
      await page.waitForTimeout(800);
      await shot(page, `vis-store/v2/wrap-${w}-${url.includes("pretraga") ? "search" : "cat"}`);
    }
    await ctx.close();
  }
}

// B: hero stage index labels truncated with an ellipsis
if (want.includes("stage")) {
  out.stage = {};
  for (const w of [1024, 1280, 1366, 1440, 1920]) {
    const { ctx, page } = await open(w, 800, "/", 2);
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const res = [];
      for (const el of document.querySelectorAll("main *")) {
        if (el.children.length) continue;
        const cs = getComputedStyle(el);
        if (cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1)
          res.push({ text: el.textContent.trim(), sw: el.scrollWidth, cw: el.clientWidth, y: Math.round(el.getBoundingClientRect().top) });
      }
      return res;
    });
    out.stage[w] = r;
    console.log("stage", w, JSON.stringify(r));
    if (r.length) await shot(page, `vis-store/v2/stage-${w}`, { clip: { x: 0, y: Math.max(0, r[0].y - 40), width: w, height: 100 } });
    await ctx.close();
  }
}

// C: product card inner overflow at 360
if (want.includes("cardclip")) {
  const { ctx, page } = await open(360, 780, "/delovi/kocioni-diskovi", 2);
  const r = await page.evaluate(() => {
    const card = document.querySelector('[data-testid="product-card"]');
    const cr = card.getBoundingClientRect();
    const offenders = [...card.querySelectorAll("*")]
      .filter((e) => e.getBoundingClientRect().right > cr.right - 1 && e.getBoundingClientRect().width > 0)
      .map((e) => ({
        tag: e.tagName.toLowerCase(),
        cls: String(e.className).slice(0, 90),
        right: Math.round(e.getBoundingClientRect().right),
        w: Math.round(e.getBoundingClientRect().width),
        txt: e.textContent.trim().slice(0, 30),
      }));
    return { card: { left: Math.round(cr.left), right: Math.round(cr.right), sw: card.scrollWidth, cw: card.clientWidth }, offenders: offenders.slice(0, 12) };
  });
  out.cardclip = r;
  console.log("cardclip", JSON.stringify(r, null, 1));
  const card = page.locator('[data-testid="product-card"]').first();
  await card.scrollIntoViewIfNeeded();
  await shot(page, "vis-store/v2/card-360-dpr2", { locator: card });
  await ctx.close();
}

// D: sub-24 px buttons on the category page (desktop)
if (want.includes("tinybtn")) {
  const { ctx, page } = await open(1440, 900, "/delovi/kocioni-diskovi", 2);
  const r = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((b) => {
        const x = b.getBoundingClientRect();
        return x.width > 0 && x.width < 24 && x.height < 24;
      })
      .map((b) => {
        const x = b.getBoundingClientRect();
        return {
          name: b.getAttribute("aria-label") || b.title || b.getAttribute("aria-labelledby") || b.textContent.trim(),
          html: b.outerHTML.slice(0, 220),
          x: Math.round(x.left),
          y: Math.round(x.top + scrollY),
          w: Math.round(x.width),
          h: Math.round(x.height),
        };
      }),
  );
  out.tinybtn = r;
  console.log("tinybtn", JSON.stringify(r.slice(0, 3), null, 1), r.length);
  if (r.length) {
    await page.evaluate((y) => window.scrollTo(0, y - 200), r[0].y);
    await page.waitForTimeout(500);
    await shot(page, "vis-store/v2/tinybtn-1440", { clip: { x: 0, y: 0, width: 720, height: 900 } });
  }
  await ctx.close();
}

// E: a real zero-results page
if (want.includes("zero")) {
  for (const w of [390, 1440]) {
    const { ctx, page } = await open(w, w < 800 ? 844 : 900, "/pretraga?q=qqzzvvkk", 1);
    await scrollThrough(page, { stepMs: 80 });
    const r = await page.evaluate(() => ({ h1: document.querySelector("main h1")?.textContent, text: document.querySelector("main")?.innerText.slice(0, 700) }));
    out[`zero${w}`] = r;
    console.log("zero", w, JSON.stringify(r));
    await shot(page, `vis-store/v2/zero-${w}`);
    await ctx.close();
  }
}

// F: mobile filter sheet open
if (want.includes("sheet")) {
  const { ctx, page } = await open(390, 844, "/delovi/kocioni-diskovi", 2);
  await page.getByRole("button", { name: /Filteri/ }).first().click();
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return null;
    const b = d.getBoundingClientRect();
    const btns = [...d.querySelectorAll("button")].map((x) => {
      const q = x.getBoundingClientRect();
      return `${x.textContent.trim().slice(0, 30) || x.getAttribute("aria-label")} ${Math.round(q.width)}x${Math.round(q.height)} @${Math.round(q.top)}`;
    });
    return { top: Math.round(b.top), h: Math.round(b.height), vh: innerHeight, btns: btns.slice(0, 24) };
  });
  out.sheet = r;
  console.log("sheet", JSON.stringify(r, null, 1));
  await shot(page, "vis-store/v2/sheet-390-dpr2");
  await ctx.close();
}

// G: focus-visible and hover on product cards
if (want.includes("focus")) {
  const { ctx, page } = await open(1440, 900, "/delovi/kocioni-diskovi", 2);
  const link = page.locator("[data-card-link]").first();
  await link.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(400);
  const card = page.locator('[data-testid="product-card"]').first();
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  await shot(page, "vis-store/v2/focus-card-1440", { clip: { x: box.x - 12, y: box.y - 12, width: box.width * 2 + 48, height: box.height + 24 } });
  await page.locator("[data-card-link]").nth(1).hover();
  await page.waitForTimeout(800);
  await shot(page, "vis-store/v2/hover-card2-1440", { clip: { x: box.x - 12, y: box.y - 12, width: box.width * 2 + 48, height: box.height + 24 } });
  await ctx.close();
}

// H: sticky buy bar on phones after a real wheel scroll
if (want.includes("buybar")) {
  const { ctx, page } = await open(390, 844, "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", 1);
  for (let i = 0; i < 12; i++) {
    await page.mouse.wheel(0, 150);
    await page.waitForTimeout(120);
  }
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const bb = document.getElementById("buy-box")?.getBoundingClientRect();
    const bars = [...document.querySelectorAll("div.fixed")]
      .filter((e) => /Dodaj u korpu/.test(e.textContent))
      .map((e) => ({ vis: getComputedStyle(e).visibility, top: Math.round(e.getBoundingClientRect().top), tr: getComputedStyle(e).transform }));
    return { scrollY, buyBoxBottom: bb && Math.round(bb.bottom), bars };
  });
  out.buybar = r;
  console.log("buybar", JSON.stringify(r));
  await shot(page, "vis-store/v2/buybar-390");
  await ctx.close();
}

writeFileSync(`docs/qa/audit/vis-store/v2-verify-${want.join("-")}.json`, JSON.stringify(out, null, 1));
await browser.close();
