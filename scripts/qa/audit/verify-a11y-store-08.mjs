/**
 * Verify a11y-store-08: reflow at 320 CSS px (header overflow, card clipping), mobile and desktop-zoom emulation.
 *   node scripts/qa/audit/verify-a11y-store-08.mjs [engine]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, newContext, shot, scrollThrough, overflowX, BASE } from "./kit.mjs";

const engine = process.argv[2] ?? "chromium";
const DIR = "docs/qa/audit/verify/a11y-store";
mkdirSync(DIR, { recursive: true });
const out = {};
const note = (k, v) => {
  out[k] = v;
  console.log("--", k, (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 1800));
};
const SPACING = `*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}`;
const ROUTES = [
  ["home", "/"],
  ["category", "/delovi/kocioni-diskovi"],
  ["product", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"],
  ["search", "/pretraga?q=disk"],
  ["vehicle", "/vozila/volkswagen/golf/golf-7"],
  ["checkout", "/porudzbina"],
  ["inquiry", "/upit"],
  ["landing", "/ponuda/kocione-plocice-golf"],
];

const header = (page) =>
  page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const hdr = document.querySelector("header");
    const row = hdr?.firstElementChild;
    const cluster = hdr?.querySelector("div.ml-auto");
    const items = cluster
      ? [...cluster.children].filter((c) => c.getBoundingClientRect().width > 0).map((c) => {
          const r = c.getBoundingClientRect();
          return `${c.tagName.toLowerCase()}[${(c.getAttribute("aria-label") || c.textContent || "").trim().slice(0, 20)}] ${Math.round(r.left)}-${Math.round(r.right)}`;
        })
      : [];
    const wm = hdr?.querySelector("a");
    return {
      vw,
      sw: document.documentElement.scrollWidth,
      rowScrollW: row?.scrollWidth,
      rowClientW: row?.clientWidth,
      wordmark: wm ? `${Math.round(wm.getBoundingClientRect().left)}-${Math.round(wm.getBoundingClientRect().right)}` : null,
      clusterRight: cluster ? Math.round(cluster.getBoundingClientRect().right * 10) / 10 : null,
      items,
    };
  });

const cardInfo = (page) =>
  page.evaluate(() => {
    return [...document.querySelectorAll("main article[data-product-slug]")].slice(0, 3).map((c) => {
      const cr = c.getBoundingClientRect();
      const btn = c.querySelector("[data-testid=product-add-to-cart]");
      const br = btn?.getBoundingClientRect();
      const oem = [...c.querySelectorAll("p")].find((p) => p.textContent.trim().startsWith("OEM"));
      const title = c.querySelector("a[data-card-link]");
      return {
        card: `${Math.round(cr.left)}-${Math.round(cr.right)} w${Math.round(cr.width)}`,
        btn: br ? `${Math.round(br.left)}-${Math.round(br.right)} "${btn.textContent.trim()}" sw${btn.scrollWidth}/cw${btn.clientWidth}` : null,
        btnOverflowsCard: br ? br.right > cr.right + 0.5 : null,
        oem: oem ? `"${oem.textContent.trim()}" sw${oem.scrollWidth}/cw${oem.clientWidth} truncated=${oem.scrollWidth > oem.clientWidth + 1}` : null,
        title: title ? `"${title.textContent.trim()}" sh${title.scrollHeight}/ch${title.clientHeight} clamped=${title.scrollHeight > title.clientHeight + 1}` : null,
      };
    });
  });

const browser = await launch(engine);
for (const mobile of [true, false]) {
  for (const [tag, route] of ROUTES) {
    const key = `${engine}-320-${mobile ? "mobile" : "desktopzoom"}-${tag}`;
    const ctx = await newContext(browser, { width: 320, height: 720, mobile, tag: `v08${tag}`, engine });
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + route, { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(2000);
      await scrollThrough(page, { stepMs: 80 });
      const r = { overflow: await overflowX(page), header: await header(page) };
      if (["landing", "category", "search", "vehicle"].includes(tag)) r.cards = await cardInfo(page);
      if (tag === "home" || tag === "landing") {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        await shot(page, `verify/a11y-store/a11y-store-08-reproduce-header-${key}`, { clip: { x: 0, y: 0, width: 320, height: 64 } });
      }
      if (tag === "landing" || tag === "category") {
        const card = page.locator("main article[data-product-slug]").first();
        await card.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1500);
        await shot(page, `verify/a11y-store/a11y-store-08-reproduce-card-${key}`, { locator: card });
        await page.addStyleTag({ content: SPACING });
        await page.waitForTimeout(600);
        r.cardsSpacing = await cardInfo(page);
        r.overflowSpacing = await overflowX(page);
        await shot(page, `verify/a11y-store/a11y-store-08-reproduce-card-spacing-${key}`, { locator: card });
      }
      note(key, r);
    } catch (e) {
      note(`${key} error`, String(e).slice(0, 300));
    }
    await ctx.close();
  }
}
// Threshold: header overflow at 330/340/360 (mobile)
for (const w of [330, 340, 350, 360]) {
  const ctx = await newContext(browser, { width: w, height: 720, tag: `v08t${w}`, engine });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + "/ponuda/kocione-plocice-golf", { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(2500);
    note(`${engine}-${w}-threshold`, { overflow: await overflowX(page), header: await header(page), cards: await cardInfo(page) });
  } catch (e) {
    note(`${w} error`, String(e).slice(0, 300));
  }
  await ctx.close();
}
writeFileSync(`${DIR}/a11y-store-08-reproduce-${engine}.json`, JSON.stringify(out, null, 1));
await browser.close();
