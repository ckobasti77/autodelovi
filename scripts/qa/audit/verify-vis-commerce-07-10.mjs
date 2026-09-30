// Independent verification of vis-commerce-07..10 (step 21 audit). Read-only: no data writes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, scrollThrough, shot, axe, loginWith } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/vis-commerce";
mkdirSync(OUT, { recursive: true });
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const TOKEN = "GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw";
const only = process.argv[2] ?? "all";
const res = {};

const controls = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea")]
      .filter((e) => e.offsetParent)
      .map((e) => {
        const r = e.getBoundingClientRect();
        const cs = getComputedStyle(e);
        const lab =
          e.getAttribute("aria-label") ||
          (e.id && document.querySelector(`label[for="${e.id}"]`)?.textContent?.trim()) ||
          e.name ||
          e.id;
        return { tag: e.tagName.toLowerCase(), id: e.id, label: String(lab).slice(0, 50), font: cs.fontSize, h: Math.round(r.height) };
      }),
  );

const browser = await launch("chromium");
try {
  // ---------- 07: quick order + inquiry select ----------
  if (only === "all" || only === "07") {
    res["07"] = {};
    for (const w of [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 767, height: 1024 }]) {
      const ctx = await newContext(browser, { ...w, tag: "vv07" });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/upit`, { waitUntil: "networkidle" });
      await scrollThrough(page);
      const all = await controls(page);
      res["07"][`upit-${w.width}`] = all;
      if (w.width === 390) {
        const sel = page.getByLabel("Dodaj kategoriju");
        await sel.scrollIntoViewIfNeeded();
        await page.waitForTimeout(800);
        const box = await sel.boundingBox();
        await shot(page, `verify/vis-commerce/vis-commerce-07-reproduce-upit-390`, {
          clip: { x: 0, y: Math.max(0, box.y - 260), width: 390, height: 420 },
        });
      }
      await ctx.close();
    }
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "vv07m" });
    const page = await ctx.newPage();
    await loginWith(page, acc.mechanic.email, acc.mechanic.password, "/majstor");
    for (const route of ["/majstor", "/majstor/brza-porudzbina"]) {
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      await scrollThrough(page);
      res["07"][`${route}-390`] = await controls(page);
      if (route === "/majstor/brza-porudzbina") {
        const ta = page.locator("#qo-input");
        await ta.scrollIntoViewIfNeeded();
        await page.waitForTimeout(600);
        const box = await ta.boundingBox();
        await shot(page, `verify/vis-commerce/vis-commerce-07-reproduce-quick-390`, {
          clip: { x: 0, y: Math.max(0, box.y - 120), width: 390, height: Math.min(600, box.height + 260) },
        });
      }
    }
    await ctx.close();
  }

  // ---------- 08: markdown tables ----------
  if (only === "all" || only === "08") {
    res["08"] = {};
    for (const route of ["/dostava-i-placanje", "/politika-privatnosti", "/kolacici", "/reklamacije-i-povrat", "/uslovi-koriscenja"]) {
      for (const w of [{ width: 360, height: 780 }, { width: 390, height: 844 }]) {
        const ctx = await newContext(browser, { ...w, tag: "vv08" });
        const page = await ctx.newPage();
        await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
        await scrollThrough(page);
        const tables = await page.evaluate(() =>
          [...document.querySelectorAll("main table")].map((t) => {
            const wrap = t.parentElement;
            const wr = wrap.getBoundingClientRect();
            const heads = [...t.querySelectorAll("thead th")].map((th) => {
              const r = th.getBoundingClientRect();
              return { text: th.textContent.trim(), left: Math.round(r.left - wr.left), w: Math.round(r.width), visible: Math.max(0, Math.round(Math.min(r.right, wr.right) - Math.max(r.left, wr.left))) };
            });
            const rows = [...t.querySelectorAll("tbody tr")].map((tr) => Math.round(tr.getBoundingClientRect().height));
            const cs = getComputedStyle(wrap);
            return {
              tableW: Math.round(t.getBoundingClientRect().width),
              wrapW: Math.round(wr.width),
              wrapScrollW: wrap.scrollWidth,
              wrapClass: wrap.className,
              overflowX: cs.overflowX,
              maskImage: cs.maskImage || cs.webkitMaskImage,
              tabindex: wrap.getAttribute("tabindex"),
              role: wrap.getAttribute("role"),
              ariaLabel: wrap.getAttribute("aria-label"),
              focusableInside: t.querySelectorAll("a[href],button,input,[tabindex]").length,
              heads,
              rowHeights: rows,
              fontSize: getComputedStyle(t).fontSize,
            };
          }),
        );
        res["08"][`${route}-${w.width}`] = tables;
        if (tables.length && w.width === 360) {
          const t = page.locator("main table").first();
          await t.scrollIntoViewIfNeeded();
          await page.evaluate(() => window.scrollBy(0, -120));
          await page.waitForTimeout(900);
          await shot(page, `verify/vis-commerce/vis-commerce-08-reproduce${route.replaceAll("/", "-")}-360`);
          // Keyboard: can Tab reach the wrapper in Chromium (keyboard-focusable scrollers)?
          await page.evaluate(() => {
            const b = document.querySelector("main h1");
            b?.setAttribute("tabindex", "-1");
            b?.focus();
          });
          let reached = false;
          for (let i = 0; i < 40; i++) {
            await page.keyboard.press("Tab");
            const hit = await page.evaluate(() => {
              const a = document.activeElement;
              return a && a.querySelector && !!a.querySelector(":scope > table");
            });
            if (hit) {
              reached = true;
              break;
            }
          }
          res["08"][`${route}-360-chromiumTabReachesScroller`] = reached;
          if (route === "/dostava-i-placanje") {
            res["08"][`${route}-360-axe`] = (await axe(page)).filter((v) => /scroll/.test(v.id));
          }
        }
        await ctx.close();
      }
    }
  }

  // ---------- 09: account order status chip ----------
  if (only === "all" || only === "09") {
    res["09"] = {};
    for (const w of [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 479, height: 900 }, { width: 480, height: 900 }, { width: 1440, height: 900 }]) {
      const ctx = await newContext(browser, { ...w, tag: "vv09" });
      const page = await ctx.newPage();
      await loginWith(page, acc.customer.email, acc.customer.password, "/nalog");
      for (const route of ["/nalog", "/nalog/porudzbine"]) {
        await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1500);
        const chips = await page.evaluate(() =>
          [...document.querySelectorAll("main ul li a")]
            .filter((a) => a.className.includes("grid-cols"))
            .slice(0, 4)
            .map((a) => {
              const kids = [...a.children];
              const chip = kids[2];
              const r = chip.getBoundingClientRect();
              const inner = document.createRange();
              inner.selectNodeContents(chip);
              const tr = inner.getBoundingClientRect();
              return { text: chip.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), contentW: Math.round(tr.width), parentW: Math.round(a.getBoundingClientRect().width), justify: getComputedStyle(chip).justifySelf };
            }),
        );
        res["09"][`${route}-${w.width}`] = chips;
        if (w.width === 360) {
          const first = page.locator("main ul li a").first();
          if (await first.count()) {
            await first.scrollIntoViewIfNeeded();
            await page.waitForTimeout(500);
            const box = await first.boundingBox();
            await shot(page, `verify/vis-commerce/vis-commerce-09-reproduce${route.replaceAll("/", "-")}-360`, {
              clip: { x: 0, y: Math.max(0, box.y - 80), width: 360, height: 320 },
            });
          }
        }
      }
      await ctx.close();
    }
  }

  // ---------- 10: OEM wrapping ----------
  if (only === "all" || only === "10") {
    res["10"] = {};
    for (const w of [{ width: 320, height: 700 }, { width: 360, height: 780 }, { width: 390, height: 844 }, { width: 430, height: 932 }]) {
      const ctx = await newContext(browser, { ...w, tag: "vv10" });
      const page = await ctx.newPage();
      for (const [name, route] of [
        ["status", `/porudzbina/${TOKEN}`],
        ["predracun", `/porudzbina/${TOKEN}/predracun`],
        ["hvala", `/porudzbina/hvala/${TOKEN}`],
      ]) {
        await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
        await page.waitForTimeout(1200);
        await scrollThrough(page);
        const codes = await page.evaluate(() => {
          const out = [];
          const walker = document.createTreeWalker(document.querySelector("main") ?? document.body, NodeFilter.SHOW_TEXT);
          let n;
          while ((n = walker.nextNode())) {
            const s = n.textContent;
            const m = s.match(/5Q0 615 505 R/);
            if (!m) continue;
            const r = document.createRange();
            r.setStart(n, m.index);
            r.setEnd(n, m.index + m[0].length);
            const rects = [...r.getClientRects()].filter((x) => x.width > 0);
            const tops = [...new Set(rects.map((x) => Math.round(x.top)))];
            out.push({ el: n.parentElement.tagName.toLowerCase() + "." + String(n.parentElement.className).slice(0, 40), lines: tops.length, ws: getComputedStyle(n.parentElement).whiteSpace });
          }
          return out;
        });
        res["10"][`${name}-${w.width}`] = codes;
        if (w.width === 360) {
          const loc = page.getByText("5Q0 615 505 R").first();
          if (await loc.count()) {
            await loc.scrollIntoViewIfNeeded();
            await page.waitForTimeout(700);
            const box = await loc.boundingBox();
            await shot(page, `verify/vis-commerce/vis-commerce-10-reproduce-${name}-360`, {
              clip: { x: 0, y: Math.max(0, box.y - 140), width: 360, height: 300 },
            });
          }
        }
      }
      await ctx.close();
    }
  }
} finally {
  await browser.close();
  const file = `${OUT}/verify-07-10-${only}.json`;
  writeFileSync(file, JSON.stringify(res, null, 2));
  console.log(JSON.stringify(res, null, 1).slice(0, 20000));
}
