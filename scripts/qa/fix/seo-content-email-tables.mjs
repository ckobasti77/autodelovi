// seo-content-email (step 22, VIS-13): Markdown tables on content pages. Below `sm` every row
// must be a stacked card that fits the column (no horizontal scroller, nothing clipped); at
// 1440 it stays a table. Also runs axe on the table and the site-wide text-reveal check.
//
//   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/seo-content-email-tables.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { axe, BASE, newContext, revealCheck, scrollThrough, shot } from "../audit/kit.mjs";

const PATHS = ["/dostava-i-placanje", "/kolacici", "/politika-privatnosti"];
const OUT = "docs/qa/fix/seo-content-email";
mkdirSync(OUT, { recursive: true });
const rows = [];
const browser = await chromium.launch();
try {
  for (const path of PATHS) {
    for (const width of [360, 1440]) {
      const context = await newContext(browser, { width, height: width < 1024 ? 780 : 900, tag: "fix-tables" });
      const page = await context.newPage();
      await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120000 });
      await scrollThrough(page);
      const facts = await page.evaluate(() =>
        [...document.querySelectorAll("main table")].map((t) => {
          const wrap = t.parentElement;
          const tr = t.querySelector("tbody tr");
          const label = tr?.querySelector("td span[aria-hidden]");
          return {
            tableW: Math.round(t.getBoundingClientRect().width),
            wrapW: Math.round(wrap.getBoundingClientRect().width),
            wrapScrollW: wrap.scrollWidth,
            rowDisplay: tr ? getComputedStyle(tr).display : null,
            firstRowH: tr ? Math.round(tr.getBoundingClientRect().height) : null,
            labelVisible: label ? getComputedStyle(label).display !== "none" : null,
            rowHeaders: t.querySelectorAll('th[role="rowheader"]').length,
          };
        }),
      );
      const reveal = await revealCheck(page);
      const violations = await axe(page, { include: "main" });
      const row = { path, width, tables: facts, reveal, axe: violations.map((v) => v.id ?? v) };
      rows.push(row);
      console.log(JSON.stringify(row));
      if (path === "/dostava-i-placanje") {
        const table = page.locator("main table").first();
        await table.scrollIntoViewIfNeeded();
        await shot(page, `../fix/seo-content-email/table-dostava-${width}`, { locator: table });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/tables.json`, JSON.stringify({ base: BASE, rows }, null, 1));
