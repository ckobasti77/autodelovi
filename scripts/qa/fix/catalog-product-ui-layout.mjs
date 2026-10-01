// A11Y-10 (card reflow at 320 + text spacing), VIS-05 (card width beside the rail, clamped names,
// chip vs render), VIS-08 (sticky desktop rail), FLOW-11 (sticky mobile filter row).
import { writeFileSync } from "node:fs";
import { launch, newContext, shot, scrollThrough, revealCheck } from "../audit/kit.mjs";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3001";
const ONLY = process.env.ONLY?.split(",");
const SPACING = `*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}`;
const out = {};
const browser = await launch("chromium");
const open = async (w, h, url, tag) => {
  const ctx = await newContext(browser, { width: w, height: h, tag: `cpu-${tag}-${w}` });
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: "load", timeout: 120000 });
  await page.waitForTimeout(2000);
  return { ctx, page };
};
const cardAudit = (page) =>
  page.evaluate(() => {
    const cards = [...document.querySelectorAll('[data-testid="product-card"]')];
    const clipped = [];
    const clamped = [];
    for (const c of cards) {
      const cr = c.getBoundingClientRect();
      for (const e of c.querySelectorAll("a, p, button, span")) {
        const r = e.getBoundingClientRect();
        if (r.width === 0 || e.closest(".sr-only")) continue;
        const cs = getComputedStyle(e);
        const hiddenOverflow = cs.overflow !== "visible" && e.scrollWidth > e.clientWidth + 1;
        if (r.right > cr.right + 0.5 || hiddenOverflow) clipped.push(`${e.tagName}:${e.textContent.trim().slice(0, 40)}`);
        if (cs.webkitLineClamp && cs.webkitLineClamp !== "none" && e.scrollHeight > e.clientHeight + 2) clamped.push(e.textContent.trim());
      }
    }
    // Quality chip vs the image content box (object-contain renders inside the padding box).
    let chipOverlap = 0;
    for (const c of cards) {
      const chip = [...c.querySelectorAll("span.absolute")].find((s) => getComputedStyle(s).display !== "none");
      const img = c.querySelector("img");
      if (!chip || !img) continue;
      const ir = img.getBoundingClientRect();
      const contentTop = ir.top + parseFloat(getComputedStyle(img).paddingTop);
      if (chip.getBoundingClientRect().bottom > contentTop + 0.5) chipOverlap++;
    }
    // The whole card is one link: a point on the thumbnail hits the name link's ::after.
    let thumbLinked = 0;
    for (const c of cards) {
      const img = c.querySelector("img");
      if (!img) continue;
      const r = img.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height / 2;
      if (y < 0 || y > innerHeight) { thumbLinked++; continue; }
      if (document.elementFromPoint(x, y)?.closest("a[data-card-link]")) thumbLinked++;
    }
    const ul = cards[0]?.closest("ul");
    return {
      cards: cards.length,
      cardWidth: cards[0] && Math.round(cards[0].getBoundingClientRect().width),
      cols: ul ? getComputedStyle(ul).gridTemplateColumns.split(" ").length : null,
      minCardWidth: Math.round(Math.min(...cards.map((c) => c.getBoundingClientRect().width))),
      clipped: clipped.slice(0, 8),
      clamped,
      chipOverlap,
      thumbLinked,
      overX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

try {
  if (!ONLY || ONLY.includes("a11y10"))
    for (const url of ["/ponuda/kocione-plocice-golf", "/delovi/kocioni-diskovi", "/pretraga?q=disk"]) {
      const { ctx, page } = await open(320, 800, url, "a11y10");
      await scrollThrough(page, { stepMs: 60 });
      const normal = await cardAudit(page);
      const card = page.locator('[data-testid="product-card"]').first();
      await card.scrollIntoViewIfNeeded();
      if (url.startsWith("/ponuda")) await shot(page, "../fix/catalog-product-ui/a11y10-card-320", { locator: card });
      await page.addStyleTag({ content: SPACING });
      await page.waitForTimeout(500);
      const spacing = await cardAudit(page);
      if (url.startsWith("/ponuda")) await shot(page, "../fix/catalog-product-ui/a11y10-card-320-spacing", { locator: card });
      out[`a11y10 ${url}`] = { normal, spacing };
      await ctx.close();
    }
  if (!ONLY || ONLY.includes("vis05"))
    for (const [w, h] of [[1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440]]) {
      const { ctx, page } = await open(w, h, "/delovi/kocioni-diskovi", "vis05");
      await scrollThrough(page, { stepMs: 60 });
      out[`vis05 ${w}`] = await cardAudit(page);
      if (w === 1920) {
        await page.locator('[data-testid="product-card"]').first().scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await shot(page, "../fix/catalog-product-ui/vis05-1920");
      }
      await ctx.close();
    }
  if (!ONLY || ONLY.includes("vis08"))
    for (const [w, h, url] of [[1440, 900, "/delovi/kocioni-diskovi"], [1280, 800, "/delovi/kocioni-diskovi/volkswagen/golf"]]) {
      const { ctx, page } = await open(w, h, url, "vis08");
      const probe = () =>
        page.evaluate(() => {
          const a = document.querySelector('aside[aria-label="Filteri"]');
          const r = a.getBoundingClientRect();
          return {
            scrollY,
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            vh: innerHeight,
            position: getComputedStyle(a).position,
            scrollable: a.scrollHeight > a.clientHeight,
            header: Math.round(document.querySelector("header").getBoundingClientRect().bottom),
          };
        });
      const a = await probe();
      await page.mouse.move(w / 2, h / 2);
      await page.mouse.wheel(0, 900);
      await page.waitForTimeout(800);
      const b = await probe();
      await page.mouse.move(150, h - 120);
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(800);
      const c = await page.evaluate(() => ({ scrollY, railScroll: document.querySelector('aside[aria-label="Filteri"]').scrollTop }));
      if (w === 1440) await shot(page, "../fix/catalog-product-ui/vis08-1440-scrolled");
      out[`vis08 ${w} ${url}`] = { a, b, c, pass: b.position === "sticky" && b.top >= b.header && b.bottom <= b.vh };
      await ctx.close();
    }
  if (!ONLY || ONLY.includes("flow11"))
    for (const [w, h] of [[360, 780], [390, 844], [768, 1024]]) {
      const { ctx, page } = await open(w, h, "/delovi/kocioni-diskovi", "flow11");
      const probe = () =>
        page.evaluate(() => {
          const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith("Filteri"));
          const row = b.parentElement;
          const r = b.getBoundingClientRect();
          return {
            scrollY,
            btnTop: Math.round(r.top),
            header: Math.round(document.querySelector("header").getBoundingClientRect().bottom),
            rowPos: getComputedStyle(row).position,
            rowBg: getComputedStyle(row).backgroundColor,
          };
        });
      const a = await probe();
      await page.evaluate(() => scrollTo(0, 1400));
      await page.waitForTimeout(800);
      const b = await probe();
      if (w === 390) await shot(page, "../fix/catalog-product-ui/flow11-390-scrolled");
      await page.getByRole("button", { name: /^Filteri/ }).click();
      await page.waitForTimeout(900);
      const sheet = await page.getByRole("dialog").isVisible().catch(() => false);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      const overX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      out[`flow11 ${w}`] = { a, b, sheet, overX, pass: b.btnTop >= b.header && b.btnTop < b.header + 40 && sheet };
      if (w === 390) {
        await scrollThrough(page, { stepMs: 60 });
        out[`flow11 ${w}`].reveal = await revealCheck(page);
      }
      await ctx.close();
    }
} finally {
  await browser.close();
}
writeFileSync(`docs/qa/fix/catalog-product-ui/layout${ONLY ? "-" + ONLY.join("-") : ""}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
