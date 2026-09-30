// verify perf-lh-08 / perf-lh-12 (independent verifier).
// 08: records securitypolicyviolation events + which chunks load on /upit and /za-majstore/registracija.
// 12: on home at 412 × 823 (mobile, consent pre-answered), measures the systems-index links and the
//     cards of the preceding cv-auto section before scrolling (section skipped by content-visibility)
//     and after scrolling it into view; runs axe target-size in both states.
//
//   AUDIT_BASE=http://localhost:3200 node scripts/qa/audit/verify-perf-lh-08-12.mjs
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

import { BASE, newContext, shot } from "./kit.mjs";

const browser = await chromium.launch();
const out = { base: BASE, csp: [], targetSize: {} };
try {
  for (const p of ["/upit", "/za-majstore/registracija"]) {
    const context = await newContext(browser, { width: 412, height: 823, consent: false, tag: "vperflh-csp" });
    const page = await context.newPage();
    const chunks = [];
    page.on("response", async (r) => {
      if (r.url().includes("/_next/static/chunks/") && r.url().endsWith(".js")) chunks.push(r.url().split("/").pop());
    });
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) =>
        window.__csp.push({ directive: e.violatedDirective, blocked: e.blockedURI, source: (e.sourceFile ?? "").split("/").pop(), disposition: e.disposition }),
      );
    });
    await page.goto(`${BASE}${p}`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    const csp = await page.evaluate(() => window.__csp);
    out.csp.push({ path: p, csp, zodChunkLoaded: chunks.includes("1uyyf-z7kpx1w.js"), chunkCount: chunks.length });
    console.log(p, JSON.stringify(csp), "zod chunk:", chunks.includes("1uyyf-z7kpx1w.js"));
    await context.close();
  }

  const context = await newContext(browser, { width: 412, height: 823, tag: "vperflh-ts" });
  const page = await context.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const measure = () =>
    page.evaluate(() => {
      const links = [...document.querySelectorAll('a[href="/delovi/usisna-grana"], a[href="/delovi/brizgaljke-pumpa-goriva"]')]
        .filter((a) => !a.closest("section.cv-auto") || true)
        .map((a) => ({ text: a.textContent.trim(), top: Math.round(a.getBoundingClientRect().top + scrollY), h: Math.round(a.getBoundingClientRect().height), inCv: !!a.closest(".cv-auto") }));
      const cats = document.getElementById("cats-title")?.closest("section");
      const r = cats?.getBoundingClientRect();
      const cards = cats ? [...cats.querySelectorAll("ul > li > a")] : [];
      const lastCard = cards.at(-1)?.getBoundingClientRect();
      const next = cats?.nextElementSibling?.getBoundingClientRect();
      return {
        catsSection: r ? { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY), h: Math.round(r.height) } : null,
        lastCardBottom: lastCard ? Math.round(lastCard.bottom + scrollY) : null,
        nextSectionTop: next ? Math.round(next.top + scrollY) : null,
        links,
      };
    });
  const axeTs = async () => {
    const res = await new AxeBuilder({ page }).withRules(["target-size"]).analyze();
    return res.violations.flatMap((v) => v.nodes.map((n) => ({ target: n.target.join(" "), summary: n.failureSummary.slice(0, 200) })));
  };
  out.targetSize.beforeScroll = { ...(await measure()), axe: await axeTs() };
  // Scroll the cards section into view so content-visibility renders it, then back to the systems index.
  await page.evaluate(() => document.getElementById("cats-title")?.scrollIntoView());
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector('a[href="/delovi/usisna-grana"]')?.scrollIntoView({ block: "center" }));
  await page.waitForTimeout(800);
  out.targetSize.afterScroll = { ...(await measure()), axe: await axeTs() };
  await shot(page, "verify/perf-lh/perf-lh-12-home-412-systems-index");
  console.log(JSON.stringify(out.targetSize, null, 1));
  await context.close();
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/perf-lh/perf-lh-08-12.json", JSON.stringify(out, null, 1));
