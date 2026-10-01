// Independent re-verification of FLOW-01 (search '<part> + car'): the audit reproduction at 390x844
// (guest, no vehicle), the same at 1440, chips + „Prikaži sve“ navigation, keyboard focus, reduced
// motion, text-reveal contract, overflow and console errors.
// AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/search-catalog-content-verify-search.mjs
import fs from "node:fs";

import {
  BASE,
  launch,
  newContext,
  overflowX,
  revealCheck,
  scrollThrough,
  watch,
} from "../audit/kit.mjs";
import sharp from "sharp";

const OUT = "docs/qa/fix/search-catalog-content/verify";
fs.mkdirSync(OUT, { recursive: true });
const report = { base: BASE, runs: [], nav: {}, keyboard: {}, reduced: {} };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snap = async (page, name, fullPage = false) => {
  const buf = await page.screenshot({ type: "png", fullPage });
  await sharp(buf).webp({ quality: 70 }).toFile(`${OUT}/${name}.webp`);
  return `${OUT}/${name}.webp`;
};

const state = (page) =>
  page.evaluate(() => {
    const txt = (sel) =>
      document.querySelector(sel)?.textContent?.replace(/\s+/g, " ").trim() ?? null;
    const sections = [...document.querySelectorAll("main section, main h2")]
      .filter((e) => e.tagName === "H2")
      .map((e) => e.textContent.trim());
    return {
      h1: txt("h1"),
      count: txt("[data-testid='search-count']"),
      vehicle: txt("[data-testid='search-vehicle']"),
      category: txt("[data-testid='search-category']"),
      chips: [
        ...document.querySelectorAll(
          "nav[aria-label='Suzite po kategoriji'] a, nav[aria-label='Kategorija'] a",
        ),
      ].map((a) => ({
        text: a.textContent.replace(/\s+/g, " ").trim(),
        href: a.getAttribute("href"),
      })),
      sections,
      cards: [...document.querySelectorAll("[data-testid='product-card'] a[data-card-link]")].map(
        (a) => a.textContent.trim(),
      ),
    };
  });

const QUERIES = [
  "pločice golf 7",
  "kočioni disk golf 7",
  "amortizer golf 7",
  "golf 7",
  "<b>disk</b>",
  "plocice golf",
  "pločice golf vii",
  "golf 7 pločice",
  "5Q0615505R",
];

const browser = await launch();
try {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: `vfy-scc-${w}` });
    const page = await ctx.newPage();
    page.setDefaultTimeout(90_000);
    const log = watch(page);
    for (const q of QUERIES) {
      await page.goto(`${BASE}/pretraga?q=${encodeURIComponent(q)}`, { waitUntil: "networkidle" });
      await page.locator("h1").first().waitFor();
      await sleep(600);
      const s = await state(page);
      const firstNonPad =
        q.includes("pločice") || q.includes("plocice")
          ? s.cards.findIndex((c) => !/pločice/i.test(c))
          : null;
      const run = { width: w, q, ...s, firstNonPad, overflow: await overflowX(page) };
      if (q === "pločice golf 7" || q === "golf 7") {
        await scrollThrough(page);
        run.reveal = await revealCheck(page);
        run.shot = await snap(page, `search-${q.replace(/\W+/g, "-")}-${w}`);
      }
      report.runs.push(run);
      console.log(w, q, "→", s.count, "|", s.vehicle, "|", s.cards.slice(0, 6).join(" ; "));
    }
    // Navigation: „golf 7“ → first chip, then „Prikaži sve“ on „pločice golf 7“, then back link.
    if (w === 390) {
      await page.goto(`${BASE}/pretraga?q=${encodeURIComponent("golf 7")}`, {
        waitUntil: "networkidle",
      });
      const chip = page.locator("nav[aria-label='Suzite po kategoriji'] a").first();
      const chipText = (await chip.textContent())?.trim();
      await chip.click();
      await page.waitForURL(/kategorija=/);
      await page.waitForLoadState("networkidle");
      report.nav.chip = { chipText, url: page.url(), ...(await state(page)) };
      report.nav.chipShot = await snap(page, "search-golf7-chip-390");
      await page.getByRole("link", { name: "Sve kategorije" }).click();
      await page.waitForURL((u) => !u.searchParams.has("kategorija"));
      await page.waitForLoadState("networkidle");
      report.nav.allCategories = { url: page.url(), count: (await state(page)).count };

      await page.goto(`${BASE}/pretraga?q=${encodeURIComponent("pločice golf 7")}`, {
        waitUntil: "networkidle",
      });
      await page.getByRole("link", { name: "Prikaži sve" }).click();
      await page.waitForURL(/vozilo=sva/);
      await page.waitForLoadState("networkidle");
      report.nav.showAll = { url: page.url(), ...(await state(page)) };
      report.nav.showAllShot = await snap(page, "search-plocice-golf7-prikazi-sve-390");
      await page
        .getByRole("link", { name: /Samo za/ })
        .first()
        .click();
      await page.waitForURL((u) => !u.search.includes("vozilo=sva"));
      await page.waitForLoadState("networkidle");
      report.nav.back = { url: page.url(), ...(await state(page)) };

      // Keyboard: Tab from the search input reaches the vehicle link and the chips with a visible ring.
      await page.goto(`${BASE}/pretraga?q=${encodeURIComponent("golf 7")}`, {
        waitUntil: "networkidle",
      });
      await page.getByTestId("search-page-input").focus();
      const stops = [];
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        stops.push(
          await page.evaluate(() => {
            const e = document.activeElement;
            const cs = getComputedStyle(e);
            return {
              tag: e.tagName,
              text: e.textContent.replace(/\s+/g, " ").trim().slice(0, 50),
              outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
              boxShadow: cs.boxShadow !== "none",
            };
          }),
        );
      }
      report.keyboard.stops = stops;
      await snap(page, "search-golf7-keyboard-390");
    }
    report[`log${w}`] = log;
    await ctx.close();
  }

  // Reduced motion at 390: nothing hidden, results identical.
  const ctx = await newContext(browser, {
    width: 390,
    height: 844,
    reducedMotion: "reduce",
    tag: "vfy-scc-rm",
  });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/pretraga?q=${encodeURIComponent("pločice golf 7")}`, {
    waitUntil: "networkidle",
  });
  await sleep(800);
  report.reduced = { ...(await state(page)), reveal: await revealCheck(page), log };
  await ctx.close();
} finally {
  await browser.close();
}
fs.writeFileSync(`${OUT}/search-ui.json`, JSON.stringify(report, null, 2));
console.log("saved", `${OUT}/search-ui.json`);
