/**
 * Step 21 QA audit, track "seo": server HTML (JavaScript disabled) vs rendered DOM (JavaScript on)
 * for one URL per template. Compares title/canonical/robots/H1, JSON-LD count, internal link set,
 * main text words, product cards, images with alt; screenshots of the no-JS render at 390 and 1440.
 *   node scripts/qa/audit/seo-render.mjs -> docs/qa/audit/seo/render-compare.json + nojs-*.webp
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

import { BASE, launch, newContext, scrollThrough, shot, watch } from "./kit.mjs";

const PAGES = [
  ["home", "/"],
  ["category", "/delovi/kocioni-diskovi"],
  ["system", "/delovi/kocnice"],
  ["landing-model", "/delovi/kocioni-diskovi/volkswagen/golf"],
  ["landing-brand", "/delovi/kocioni-diskovi/volkswagen"],
  ["product", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"],
  ["product-oos", "/deo/kocione-plocice-prednje-demo-0012"],
  ["vehicle-gen", "/vozila/volkswagen/golf/golf-7"],
  ["vehicle-model", "/vozila/volkswagen/golf"],
  ["za-majstore", "/za-majstore"],
  ["upit", "/upit"],
  ["kontakt", "/kontakt"],
];

async function facts(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const text = (main?.innerText ?? "").replace(/\s+/g, " ").trim();
    return {
      title: document.title,
      canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
      robots: document.querySelector('meta[name="robots"]')?.content ?? null,
      h1: [...document.querySelectorAll("h1")].map((h) => h.innerText.replace(/\s+/g, " ").trim()),
      jsonld: document.querySelectorAll('script[type="application/ld+json"]').length,
      links: [...new Set([...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).filter((h) => h.startsWith("/")))],
      words: text ? text.split(" ").length : 0,
      cards: document.querySelectorAll('[data-testid="product-card"]').length,
      imgs: document.querySelectorAll("main img").length,
      imgsNoAlt: [...document.querySelectorAll("main img")].filter((i) => !i.hasAttribute("alt")).length,
      hiddenCopy: [...document.querySelectorAll("main h1, main h2, main p, main li")]
        .filter((e) => e.offsetParent && e.textContent.trim() && getComputedStyle(e).opacity === "0").length,
    };
  });
}

const browser = await launch("chromium");
const out = [];
for (const [name, p] of PAGES) {
  const row = { name, path: p };
  for (const js of [false, true]) {
    const ctx = await browser.newContext({
      javaScriptEnabled: js,
      viewport: { width: 1440, height: 900 },
      userAgent: "Mozilla/5.0 (compatible; SklopAudit-seo-render)",
      locale: "sr-Latn-RS",
    });
    await ctx.addCookies([
      {
        name: "sk_consent",
        value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-seo-0001" })),
        domain: "localhost",
        path: "/",
      },
    ]);
    const page = await ctx.newPage();
    const log = watch(page);
    await page.goto(BASE + p, { waitUntil: js ? "networkidle" : "load", timeout: 60_000 });
    if (js) await scrollThrough(page);
    row[js ? "js" : "nojs"] = await facts(page);
    if (js) row.errors = { console: log.console, page: log.pageErrors, bad: log.badResponses };
    if (!js && ["home", "product", "category", "landing-model"].includes(name)) {
      row.nojsShot = await shot(page, `seo/nojs-${name}-1440`);
    }
    await ctx.close();
  }
  const a = row.nojs;
  const b = row.js;
  row.diff = {
    title: a.title === b.title,
    canonical: a.canonical === b.canonical,
    robots: a.robots === b.robots,
    h1: JSON.stringify(a.h1) === JSON.stringify(b.h1),
    jsonld: a.jsonld === b.jsonld,
    linksOnlyWithJs: b.links.filter((l) => !a.links.includes(l)).slice(0, 15),
    linksOnlyWithoutJs: a.links.filter((l) => !b.links.includes(l)).slice(0, 15),
    words: [a.words, b.words],
    cards: [a.cards, b.cards],
  };
  delete row.nojs.links;
  delete row.js.links;
  out.push(row);
  console.log(name, JSON.stringify(row.diff));
}
// mobile no-JS product + home
for (const [name, p] of [["home", "/"], ["product", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"]]) {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "seo" });
  await ctx.close();
  const c2 = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await c2.newPage();
  await page.goto(BASE + p, { waitUntil: "load" });
  out.push({ name: `${name}-390-nojs`, shot: await shot(page, `seo/nojs-${name}-390`) });
  await c2.close();
}
await browser.close();
writeFileSync(path.resolve("docs/qa/audit/seo/render-compare.json"), JSON.stringify(out, null, 1));
