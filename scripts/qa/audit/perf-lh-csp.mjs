// perf-lh (step 21 audit): Lighthouse best-practices on /upit is 96 because of an
// "inspector-issues: Content security policy" entry. This records every securitypolicyviolation
// event (directive, blocked URI, source) on /upit and a few other templates, first visit
// (no consent cookie) at 412 × 823.
//
//   AUDIT_BASE=http://localhost:3200 node scripts/qa/audit/perf-lh-csp.mjs
import { writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { BASE, newContext, watch } from "./kit.mjs";

const PATHS = (process.env.PATHS ?? "/upit,/kontakt,/za-majstore,/,/delovi/kocioni-diskovi").split(",");
const browser = await chromium.launch();
const out = [];
try {
  for (const p of PATHS) {
    const context = await newContext(browser, { width: 412, height: 823, consent: false, tag: "perflh-csp" });
    const page = await context.newPage();
    const log = watch(page);
    await page.addInitScript(() => {
      window.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) =>
        window.__csp.push({ directive: e.violatedDirective, effective: e.effectiveDirective, blocked: e.blockedURI, source: e.sourceFile, line: e.lineNumber, sample: e.sample, disposition: e.disposition }),
      );
    });
    await page.goto(`${BASE}${p}`, { waitUntil: "load" });
    await page.waitForTimeout(4000);
    const csp = await page.evaluate(() => window.__csp);
    const row = { path: p, csp, console: log.console, pageErrors: log.pageErrors };
    out.push(row);
    console.log(JSON.stringify(row));
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync(
  `docs/qa/audit/perf-lh/csp-violations${process.env.PATHS ? "-2" : ""}.json`,
  JSON.stringify({ base: BASE, rows: out }, null, 1),
);
