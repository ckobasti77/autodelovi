// Independent verification of vis-store-07..10 (step 21 audit). Usage: node scripts/qa/audit/verify-vis-store-07-10.mjs [07|08|09|10 ...]
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, scrollThrough, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/vis-store";
mkdirSync(OUT, { recursive: true });
const which = process.argv.slice(2);
const want = (k) => !which.length || which.includes(k);

/** In-page: find text lines that start with "×" (or a line ending right before "×") inside selector. */
async function wrapScan(page, selector) {
  return page.evaluate((sel) => {
    const res = [];
    for (const el of document.querySelectorAll(sel)) {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        const t = n.nodeValue;
        const idx = t.indexOf("×");
        if (idx < 0) continue;
        // top of the char before the space preceding × vs top of ×
        const r = document.createRange();
        const tops = [];
        for (let i = 0; i < t.length; i++) {
          r.setStart(n, i);
          r.setEnd(n, i + 1);
          const rects = r.getClientRects();
          tops.push(rects.length ? Math.round(rects[0].top) : null);
        }
        // find first non-space char after the break
        let lineStarts = [];
        let prevTop = null;
        for (let i = 0; i < t.length; i++) {
          if (tops[i] == null) continue;
          if (/\s/.test(t[i])) continue;
          if (prevTop != null && tops[i] > prevTop + 2) lineStarts.push(i);
          prevTop = tops[i];
        }
        const starts = lineStarts.map((i) => t.slice(i, i + 12));
        const beforeX = t.charCodeAt(idx - 1);
        const afterX = t.charCodeAt(idx + 1);
        res.push({
          tag: el.tagName.toLowerCase(),
          text: t,
          spaceBeforeX: beforeX.toString(16),
          spaceAfterX: afterX.toString(16),
          lineStarts: starts,
          breaksAtX: starts.some((s) => s.startsWith("×")),
          breaksAfterX: lineStarts.some((i) => /^\d/.test(t[i]) && t.slice(0, i).trimEnd().endsWith("×")),
        });
      }
    }
    return res;
  }, selector);
}

const browser = await launch("chromium");
const report = {};
try {
  if (want("07")) {
    const r07 = [];
    const cases = [
      ["/delovi/kocioni-diskovi", 1440, 900],
      ["/delovi/kocioni-diskovi", 390, 844],
      ["/delovi/kocioni-diskovi", 360, 780],
      ["/delovi/kocioni-diskovi", 1280, 800],
      ["/delovi/kocioni-diskovi", 768, 1024],
      ["/pretraga?q=disk", 1440, 900],
      ["/pretraga?q=disk", 1920, 1080],
      ["/pretraga?q=disk", 390, 844],
      ["/delovi/kocioni-diskovi/volkswagen/golf", 390, 844],
      ["/delovi/kocioni-diskovi/volkswagen/golf", 1440, 900],
      ["/deo/kocioni-disk-prednji-276-24-mm-demo-0004", 360, 780],
      ["/deo/kocioni-disk-prednji-276-24-mm-demo-0004", 1440, 900],
    ];
    for (const [route, width, height] of cases) {
      const ctx = await newContext(browser, { width, height, tag: "v-vs07" });
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      await scrollThrough(page, { stepMs: 90 });
      await page.waitForTimeout(600);
      const hits = await wrapScan(page, "main h1, main h2, main h3, main h4, main a, main p, main li");
      const bad = hits.filter((h) => h.breaksAtX || h.breaksAfterX);
      r07.push({ route, width, total: hits.length, broken: bad.length, examples: bad.slice(0, 4), sampleOk: hits.slice(0, 2) });
      if (route === "/delovi/kocioni-diskovi" && bad.length) {
        // screenshot the first offending card
        const loc = page.locator("main a", { hasText: bad[0].text.trim().slice(0, 30) }).first();
        const card = loc.locator("xpath=ancestor::*[self::article or self::li][1]");
        try {
          await card.scrollIntoViewIfNeeded();
          await page.waitForTimeout(700);
          await shot(page, `verify/vis-store/vis-store-07-reproduce-card-${width}`, { locator: card });
        } catch (e) {
          r07.at(-1).shotErr = String(e).slice(0, 200);
        }
      }
      await ctx.close();
    }
    report["07"] = r07;
  }

  if (want("08")) {
    const r08 = [];
    for (const [width, height] of [
      [390, 844],
      [360, 780],
      [768, 1024],
      [1440, 900],
    ]) {
      const ctx = await newContext(browser, { width, height, tag: "v-vs08" });
      const page = await ctx.newPage();
      await page.goto(BASE + "/", { waitUntil: "networkidle" });
      await scrollThrough(page, { stepMs: 120 });
      await page.waitForTimeout(800);
      const m = await page.evaluate(() => {
        const secs = [...document.querySelectorAll("main > *, main section")].filter(
          (s) => s.parentElement?.tagName === "MAIN" || s.tagName === "SECTION",
        );
        const top = [...document.querySelector("main").children].map((s) => {
          const r = s.getBoundingClientRect();
          const h = s.querySelector("h1,h2");
          return {
            tag: s.tagName.toLowerCase(),
            heading: h?.textContent?.trim().slice(0, 50) ?? null,
            h: Math.round(r.height),
            links: s.querySelectorAll("a").length,
          };
        });
        const idx = [...document.querySelectorAll("main section, main > div")].find((s) =>
          /Delovi po sistemima/i.test(s.querySelector("h2")?.textContent ?? ""),
        );
        let sys = null;
        if (idx) {
          const r = idx.getBoundingClientRect();
          sys = {
            h: Math.round(r.height),
            top: Math.round(r.top + scrollY),
            links: idx.querySelectorAll("a").length,
            groups: idx.querySelectorAll("h3").length,
            details: idx.querySelectorAll("details").length,
            columns: getComputedStyle(idx.querySelector("ul,ol,div") ?? idx).gridTemplateColumns,
          };
        }
        return { total: document.documentElement.scrollHeight, top, sys };
      });
      m.width = width;
      m.screens = +(m.total / height).toFixed(1);
      if (m.sys) m.sysScreens = +(m.sys.h / height).toFixed(2);
      r08.push(m);
      if (width === 390 && m.sys) {
        await page.evaluate((y) => window.scrollTo(0, y), m.sys.top - 60);
        await page.waitForTimeout(900);
        await shot(page, "verify/vis-store/vis-store-08-reproduce-390-a");
        await page.evaluate((y) => window.scrollTo(0, y + 844), m.sys.top - 60);
        await page.waitForTimeout(900);
        await shot(page, "verify/vis-store/vis-store-08-reproduce-390-b");
      }
      await ctx.close();
    }
    report["08"] = r08;
  }

  if (want("09")) {
    const r09 = [];
    const cases = [
      ["/delovi/kocioni-diskovi/volkswagen/golf", 360, 780],
      ["/delovi/kocioni-diskovi/volkswagen/golf", 390, 844],
      ["/delovi/kocioni-diskovi/volkswagen", 360, 780],
      ["/delovi/kocioni-diskovi/volkswagen", 390, 844],
      ["/delovi/kocioni-diskovi", 360, 780],
      ["/delovi/kocioni-diskovi", 390, 844],
      ["/delovi/kocione-plocice/volkswagen/golf", 360, 780],
      ["/delovi/kocione-plocice/volkswagen/golf", 390, 844],
    ];
    for (const [route, width, height] of cases) {
      const ctx = await newContext(browser, { width, height, tag: "v-vs09" });
      const page = await ctx.newPage();
      const resp = await page.goto(BASE + route, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const m = await page.evaluate(() => {
        const h1 = document.querySelector("main h1");
        const hdr = h1?.closest("header");
        const ps = hdr ? [...hdr.querySelectorAll("p")] : [];
        const lead = ps[0];
        const lh = lead ? parseFloat(getComputedStyle(lead).lineHeight) : 0;
        const leadRect = lead?.getBoundingClientRect();
        const card = document.querySelector("main article, main [data-testid*='product-card']");
        const priceEl = card?.querySelector("[data-reveal='off'] , [class*='numeral']");
        const prices = card ? [...card.querySelectorAll("*")].filter((e) => /RSD/.test(e.textContent) && e.children.length === 0) : [];
        const btn = card?.querySelector("button");
        return {
          h1: h1?.textContent?.trim(),
          leadText: lead?.textContent?.trim().slice(0, 300),
          leadLines: lead && lh ? Math.round(leadRect.height / lh) : null,
          leadBottom: leadRect ? Math.round(leadRect.bottom) : null,
          hasDetails: !!hdr?.querySelector("details"),
          cardTop: card ? Math.round(card.getBoundingClientRect().top) : null,
          priceBottom: prices.length ? Math.round(Math.max(...prices.map((p) => p.getBoundingClientRect().bottom))) : null,
          btnBottom: btn ? Math.round(btn.getBoundingClientRect().bottom) : null,
          vh: innerHeight,
          robots: document.querySelector('meta[name="robots"]')?.content ?? null,
        };
      });
      m.route = route;
      m.status = resp?.status();
      r09.push(m);
      const slug = route.replaceAll("/", "_").replace(/^_/, "");
      await shot(page, `verify/vis-store/vis-store-09-reproduce-${slug}-${width}`);
      await ctx.close();
    }
    report["09"] = r09;
  }

  if (want("10")) {
    const r10 = [];
    const cases = [
      ["/deo/kocioni-disk-prednji-276-24-mm-demo-0004", 360, 780, 2],
      ["/deo/kocioni-disk-prednji-276-24-mm-demo-0004", 390, 844, 2],
      ["/deo/kociona-celjust-zadnja-desna-sa-motorom-rucne-demo-0018", 360, 780, 2],
      ["/deo/kocioni-disk-prednji-276-24-mm-demo-0004", 1440, 900, 1],
    ];
    for (const [route, width, height, dpr] of cases) {
      const ctx = await newContext(browser, { width, height, tag: "v-vs10", deviceScaleFactor: dpr });
      const page = await ctx.newPage();
      await page.goto(BASE + route, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const m = await page.evaluate(() => {
        const cap = [...document.querySelectorAll("main p")].find((p) => /Ilustracija kategorije/.test(p.textContent));
        if (!cap) return null;
        const frame = cap.parentElement;
        const cr = cap.getBoundingClientRect();
        const fr = frame.getBoundingClientRect();
        const img = frame.querySelector("img");
        const ir = img?.getBoundingClientRect();
        const cs = getComputedStyle(cap);
        const lh = parseFloat(cs.lineHeight);
        return {
          text: cap.textContent,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          color: cs.color,
          bg: cs.backgroundColor,
          lines: Math.round((cr.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) / lh),
          insetLeft: Math.round(cr.left - fr.left),
          insetRight: Math.round(fr.right - cr.right),
          insetBottom: Math.round(fr.bottom - cr.bottom),
          capH: Math.round(cr.height),
          frameW: Math.round(fr.width),
          frameH: Math.round(fr.height),
          capTopInFrame: Math.round(cr.top - fr.top),
          imgFit: img ? getComputedStyle(img).objectFit : null,
          imgNatural: img ? [img.naturalWidth, img.naturalHeight] : null,
          imgRect: ir ? [Math.round(ir.width), Math.round(ir.height)] : null,
        };
      });
      r10.push({ route, width, dpr, m });
      if (m) {
        const frame = page.locator("main p", { hasText: "Ilustracija kategorije" }).first().locator("xpath=..");
        await shot(page, `verify/vis-store/vis-store-10-reproduce-${width}-${route.includes("0018") ? "0018" : "0004"}`, { locator: frame });
      }
      await ctx.close();
    }
    report["10"] = r10;
  }
} finally {
  await browser.close();
}
const file = `${OUT}/vis-store-07-10-reproduce-${which.join("-") || "all"}.json`;
writeFileSync(file, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2).slice(0, 20000));
