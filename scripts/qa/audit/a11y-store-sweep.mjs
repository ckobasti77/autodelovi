/**
 * a11y-store: axe + structural checks (landmarks, h1, heading order, skip link, lang, images alt,
 * reveal contract) for every storefront template at 1440 and 390.
 *   node scripts/qa/audit/a11y-store-sweep.mjs [widthTag...]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, newContext, watch, scrollThrough, revealCheck, overflowX, axe, BASE } from "./kit.mjs";

const TOKEN = "GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw";
const ROUTES = [
  "/",
  "/delovi",
  "/delovi/kocnice",
  "/delovi/kocioni-diskovi",
  "/delovi/kocioni-diskovi/volkswagen",
  "/delovi/kocioni-diskovi/volkswagen/golf",
  "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
  "/deo/kocione-plocice-prednje-demo-0012",
  "/vozila",
  "/vozila/volkswagen",
  "/vozila/volkswagen/golf",
  "/vozila/volkswagen/golf/golf-7",
  "/pretraga?q=5Q0615505R",
  "/pretraga?q=disk",
  "/pretraga?q=qqqzzz999",
  "/ponuda/kocione-plocice-golf",
  "/korpa",
  "/porudzbina",
  `/porudzbina/${TOKEN}`,
  `/porudzbina/${TOKEN}/predracun`,
  `/porudzbina/hvala/${TOKEN}`,
  "/upit",
  "/upit/3UMmrdzw1RNGw5ToQh06cANjxl8c_-Ajvp7eBwA1ayI",
  "/za-majstore",
  "/za-majstore/registracija",
  "/prijava",
  "/registracija",
  "/zaboravljena-lozinka",
  "/o-nama",
  "/kontakt",
  "/dostava-i-placanje",
  "/reklamacije-i-povrat",
  "/uslovi-koriscenja",
  "/politika-privatnosti",
  "/kolacici",
  "/ovo-ne-postoji",
];

const widths = process.argv.slice(2).length ? process.argv.slice(2) : ["1440", "390"];
const OUT = "docs/qa/audit/a11y-store";
mkdirSync(OUT, { recursive: true });

async function structure(page) {
  return page.evaluate(() => {
    const vis = (e) => {
      const r = e.getBoundingClientRect();
      const s = getComputedStyle(e);
      return s.display !== "none" && s.visibility !== "hidden" && !(r.width === 0 && r.height === 0) ? true : false;
    };
    const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6,[role=heading]")].filter(
      (h) => !h.closest("[aria-hidden=true],[hidden]") && getComputedStyle(h).display !== "none",
    );
    const levels = hs.map((h) => Number(h.getAttribute("aria-level") || h.tagName.slice(1)));
    const skips = [];
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] > levels[i - 1] + 1)
        skips.push(`h${levels[i - 1]}→h${levels[i]} "${hs[i].textContent.trim().slice(0, 40)}"`);
    }
    const h1s = hs.filter((h, i) => levels[i] === 1).map((h) => h.textContent.trim().slice(0, 80));
    const firstH = levels[0];
    const land = (sel) => [...document.querySelectorAll(sel)].filter((e) => !e.closest("[hidden]"));
    const mains = land("main,[role=main]");
    const navs = land("nav,[role=navigation]").map(
      (n) => n.getAttribute("aria-label") || n.getAttribute("aria-labelledby") || "(unlabelled)",
    );
    const banners = land("header:not(main header):not(article header):not(section header),[role=banner]").length;
    const footers = land("footer:not(main footer):not(article footer):not(section footer),[role=contentinfo]").length;
    const skip = [...document.querySelectorAll("a[href^='#']")].find((a) => /presko/i.test(a.textContent));
    const skipTarget = skip ? document.querySelector(skip.getAttribute("href")) : null;
    const imgs = [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).map((i) => i.src.slice(-60));
    const imgAlts = [...document.querySelectorAll("img[alt]")].map((i) => i.alt).filter(Boolean).slice(0, 6);
    const emptyLinks = [...document.querySelectorAll("a[href]")]
      .filter((a) => vis(a) && !(a.textContent.trim() || a.getAttribute("aria-label") || a.querySelector("img[alt]:not([alt=''])") || a.getAttribute("aria-labelledby")))
      .map((a) => a.getAttribute("href"))
      .slice(0, 5);
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    const dupIds = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))].slice(0, 5);
    return {
      lang: document.documentElement.lang,
      title: document.title,
      h1s,
      firstHeading: firstH,
      headingSkips: skips,
      mains: mains.length,
      navs,
      banners,
      footers,
      skip: skip ? { text: skip.textContent.trim(), href: skip.getAttribute("href"), targetExists: !!skipTarget, targetTag: skipTarget?.tagName, targetTabIndex: skipTarget?.getAttribute("tabindex") } : null,
      imgsNoAlt: imgs,
      imgAlts,
      emptyLinks,
      dupIds,
    };
  });
}

const browser = await launch();
const results = [];
for (const tag of widths) {
  const w = { 1440: [1440, 900], 390: [390, 844], 320: [320, 700], 768: [768, 1024] }[tag];
  const queue = [...ROUTES];
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const route = queue.shift();
      const ctx = await newContext(browser, { width: w[0], height: w[1], tag: `a11ysweep${tag}` });
      const page = await ctx.newPage();
      const log = watch(page);
      let res = { route, width: tag };
      try {
        const resp = await page.goto(BASE + route, { waitUntil: "networkidle", timeout: 60000 });
        res.status = resp?.status();
        await scrollThrough(page, { stepMs: 90 });
        res.structure = await structure(page);
        res.reveal = await revealCheck(page);
        res.overflow = await overflowX(page);
        res.axe = await axe(page);
      } catch (e) {
        res.error = String(e).slice(0, 300);
      }
      res.console = log.console.slice(0, 5);
      res.pageErrors = log.pageErrors.slice(0, 5);
      res.bad = log.badResponses.filter((b) => !/ovo-ne-postoji/.test(b)).slice(0, 5);
      results.push(res);
      console.log(tag, route, res.status, "axe:", (res.axe || []).map((v) => `${v.id}(${v.nodes})`).join(" ") || "-", "h1:", res.structure?.h1s.length, "skips:", res.structure?.headingSkips.length);
      await ctx.close();
    }
  });
  await Promise.all(workers);
}
await browser.close();
writeFileSync(`${OUT}/sweep-${widths.join("-")}.json`, JSON.stringify(results, null, 1));
