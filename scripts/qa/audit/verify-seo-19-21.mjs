/**
 * Step 21 QA audit — independent verification of seo-19 (/upit has no breadcrumb / BreadcrumbList)
 * and seo-21 (mixed-case storefront URLs 404 instead of redirecting). Rendered DOM checks after
 * hydration + viewport screenshots at 390 and 1440.
 *   node scripts/qa/audit/verify-seo-19-21.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { BASE, launch, newContext, shot } from "./kit.mjs";

const browser = await launch("chromium");
const out = { base: BASE, at: new Date().toISOString(), seo19: [], seo21: [] };

for (const width of [390, 1440]) {
  const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `verify-seo-19-${width}` });
  const page = await ctx.newPage();
  for (const p of ["/upit", "/za-majstore", "/kontakt"]) {
    await page.goto(BASE + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const facts = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Putanja"]');
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => {
        try {
          const j = JSON.parse(s.textContent);
          return [j].flat().map((x) => x["@type"]).join(",");
        } catch {
          return "invalid";
        }
      });
      return {
        breadcrumbNav: nav ? nav.innerText.replace(/\s+/g, " ").trim() : null,
        jsonLdTypes: ld,
        h1: document.querySelector("h1")?.innerText.trim() ?? null,
        robots: document.querySelector('meta[name="robots"]')?.content ?? null,
        canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
      };
    });
    out.seo19.push({ path: p, width, ...facts });
    if (p === "/upit" || p === "/za-majstore") {
      await shot(page, `verify/seo/seo-19-reproduce${p.replaceAll("/", "-")}-${width}`);
    }
  }
  await ctx.close();
}

for (const width of [390, 1440]) {
  const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `verify-seo-21-${width}` });
  const page = await ctx.newPage();
  for (const p of ["/Delovi/Kocioni-Diskovi", "/deo/KOCIONI-DISK-PREDNJI-276-24-MM-DEMO-0004"]) {
    const res = await page.goto(BASE + p, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    const facts = await page.evaluate(() => ({
      url: location.pathname,
      title: document.title,
      h1: document.querySelector("h1")?.innerText.trim() ?? null,
      robots: document.querySelector('meta[name="robots"]')?.content ?? null,
      links: [...document.querySelectorAll("main a")].slice(0, 12).map((a) => a.getAttribute("href")),
    }));
    out.seo21.push({ path: p, width, status: res?.status(), ...facts });
    await shot(page, `verify/seo/seo-21-reproduce${p.startsWith("/deo") ? "-deo-upper" : "-delovi-mixed"}-${width}`);
  }
  await ctx.close();
}
await browser.close();

const dir = path.resolve("docs/qa/audit/verify/seo");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "seo-19-21-reproduce.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
