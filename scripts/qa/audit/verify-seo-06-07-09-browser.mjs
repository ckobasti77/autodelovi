/**
 * Step 21 QA audit — browser side of the independent verification of seo-06, seo-07 and seo-09.
 *   seo-06: viewport captures of a system hub and a single-generation model hub at 390 and 1440.
 *   seo-07: rendered DOM (after JS) — links to /kontakt in header, footer, opened mobile menu, home.
 *   seo-09: shop-segment 404s with JS on and off (title, H1, header present) in Chromium, Firefox, WebKit.
 * Output: docs/qa/audit/verify/seo/seo-0{6,7,9}-reproduce-*.{webp,json}
 */
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext, scrollThrough, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/seo";
const res = { seo06: {}, seo07: {}, seo09: [] };

// ---------------------------------------------------------------- Chromium: seo-06, seo-07
{
  const browser = await launch("chromium");
  try {
    for (const vp of [
      { tag: "390", width: 390, height: 844 },
      { tag: "1440", width: 1440, height: 900 },
    ]) {
      const ctx = await newContext(browser, { width: vp.width, height: vp.height, tag: `vseo-${vp.tag}` });
      const page = await ctx.newPage();

      // seo-06
      for (const [name, url] of [
        ["system-hub-kocnice", "/delovi/kocnice"],
        ["system-hub-tockovi", "/delovi/tockovi"],
        ["model-hub-skoda-rapid", "/vozila/skoda/rapid"],
        ["brand-hub-cupra", "/vozila/cupra"],
      ]) {
        await page.goto(BASE + url, { waitUntil: "networkidle" });
        await scrollThrough(page, { stepMs: 80 });
        await page.waitForTimeout(600);
        const facts = await page.evaluate(() => {
          const main = document.querySelector("main");
          const clone = main.cloneNode(true);
          clone.querySelectorAll('nav[aria-label="Putanja"],script,style').forEach((n) => n.remove());
          const text = clone.innerText ?? clone.textContent;
          return {
            h1: main.querySelector("h1")?.innerText,
            paragraphsInMain: [...main.querySelectorAll("p")].map((p) => p.innerText.trim()).filter(Boolean),
            mainLinks: [...main.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
            visibleWords: text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length,
            itemList: [...document.querySelectorAll('script[type="application/ld+json"]')].some((s) =>
              s.textContent.includes('"ItemList"'),
            ),
            robots: document.querySelector('meta[name="robots"]')?.content,
            scrollHeight: document.documentElement.scrollHeight,
          };
        });
        (res.seo06[url] ??= {})[vp.tag] = facts;
        await shot(page, `${OUT.replace("docs/qa/audit/", "")}/seo-06-reproduce-${name}-${vp.tag}`);
      }

      // seo-07: rendered DOM
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await scrollThrough(page, { stepMs: 80 });
      const homeLinks = await page.evaluate(() =>
        [...document.querySelectorAll("a[href]")].filter((a) => /\/kontakt(\b|$|[?#])/.test(a.getAttribute("href"))).length,
      );
      await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
      let menuLinks = null;
      let menuItems = null;
      if (vp.width < 1024) {
        await page.getByRole("button", { name: "Otvori meni" }).click();
        await page.waitForTimeout(900);
        const dialog = page.getByRole("dialog").last();
        menuItems = await dialog.evaluate((d) =>
          [...d.querySelectorAll("a[href], p")].map((e) => `${e.tagName.toLowerCase()} ${e.getAttribute("href") ?? ""} ${e.innerText.replace(/\s+/g, " ").trim()}`),
        );
        menuLinks = await dialog.evaluate((d) => [...d.querySelectorAll("a[href]")].filter((a) => a.getAttribute("href").startsWith("/kontakt")).length);
        await shot(page, `${OUT.replace("docs/qa/audit/", "")}/seo-07-reproduce-mobile-menu-${vp.tag}`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }
      const footer = page.getByTestId("site-footer").or(page.locator("footer")).first();
      await footer.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(1200);
      const allLinksToKontakt = await page.evaluate(() =>
        [...document.querySelectorAll("a[href]")].filter((a) => a.getAttribute("href").startsWith("/kontakt")).map((a) => a.outerHTML.slice(0, 120)),
      );
      const footerText = await page.evaluate(() => document.querySelector("footer")?.innerText.replace(/\s+/g, " ").slice(0, 900));
      await shot(page, `${OUT.replace("docs/qa/audit/", "")}/seo-07-reproduce-footer-${vp.tag}`);
      res.seo07[vp.tag] = { homeLinksToKontakt: homeLinks, menuLinksToKontakt: menuLinks, menuItems, categoryPageLinksToKontakt: allLinksToKontakt, footerText };
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------- seo-09 in three engines
const NF = [
  "/deo/ne-postoji-demo-9999",
  "/delovi/nepostojeca-kategorija",
  "/delovi/kocioni-diskovi/nepostojeca-marka",
  "/delovi/kocioni-diskovi/volkswagen/nepostojeci-model",
  "/vozila/nepostojeca",
  "/vozila/volkswagen/nepostojeci",
  "/vozila/volkswagen/golf/golf-99",
  "/deo/KOCIONI-DISK-PREDNJI-276-24-MM-DEMO-0004",
  "/ovo-ne-postoji",
];
for (const engine of ["chromium", "firefox", "webkit"]) {
  const browser = await launch(engine);
  try {
    for (const js of [true, false]) {
      const ctx = await newContext(browser, { width: 390, height: 844, tag: `vseo09-${engine}`, engine });
      if (!js) await ctx.close();
      const context = js
        ? ctx
        : await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false, locale: "sr-Latn-RS" });
      const page = await context.newPage();
      const urls = engine === "chromium" ? NF : [NF[0], NF[4], NF[8]];
      for (const url of urls) {
        const r = await page.goto(BASE + url, { waitUntil: "networkidle" });
        await page.waitForTimeout(js ? 1500 : 300);
        const facts = await page.evaluate(() => ({
          title: document.title,
          h1: document.querySelector("h1")?.innerText ?? null,
          header: Boolean(document.querySelector("header")),
          footer: Boolean(document.querySelector("footer")),
          main: Boolean(document.querySelector("main")),
          bodyText: document.body.innerText.replace(/\s+/g, " ").trim().slice(0, 80),
        }));
        res.seo09.push({ engine, js, url, status: r?.status(), ...facts });
        if (engine === "chromium" && (url === NF[0] || url === NF[8] || url === NF[4])) {
          const slug = url.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
          await shot(page, `${OUT.replace("docs/qa/audit/", "")}/seo-09-reproduce-${js ? "js" : "nojs"}-${slug}-390`);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

writeFileSync(`${OUT}/seo-06-07-09-browser.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res.seo07, null, 1).slice(0, 4000));
for (const r of res.seo09) console.log(r.engine, r.js ? "js" : "nojs", r.status, r.url, "|", r.title, "|", r.h1, "| header", r.header, "| main", r.main, "|", r.bodyText);
for (const [u, v] of Object.entries(res.seo06)) console.log(u, JSON.stringify({ w390: v["390"].visibleWords, w1440: v["1440"].visibleWords, p: v["1440"].paragraphsInMain, itemList: v["1440"].itemList, links: v["1440"].mainLinks.length }));
