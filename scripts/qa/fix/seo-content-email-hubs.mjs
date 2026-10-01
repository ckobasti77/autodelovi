// seo-content-email (step 22, SEO-04 / COPY-05): the reworked hubs — system hub with intro,
// top parts and landings; model hub with counts per generation; brand hub with counts and
// top categories; /vozila with catalogue facts. Screens at 390 and 1440, text-reveal check,
// horizontal overflow, axe on <main>, word count of <main>.
//
//   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/seo-content-email-hubs.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

import { axe, BASE, newContext, overflowX, revealCheck, scrollThrough, shot, watch } from "../audit/kit.mjs";

const RUNS = [
  { path: "/delovi/kocnice", widths: [390, 1440], name: "system-kocnice" },
  { path: "/vozila/skoda/octavia", widths: [390], name: "model-octavia" },
  { path: "/vozila/cupra", widths: [1440], name: "brand-cupra" },
  { path: "/vozila", widths: [], name: "vozila" },
];
const OUT = "docs/qa/fix/seo-content-email";
mkdirSync(OUT, { recursive: true });
const rows = [];
const browser = await chromium.launch();
try {
  for (const { path, widths, name } of RUNS) {
    for (const width of widths.length ? widths : [1440]) {
      const context = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: "fix-hubs" });
      const page = await context.newPage();
      const log = watch(page);
      await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 120000 });
      await scrollThrough(page);
      const words = await page.evaluate(
        () => (document.querySelector("main")?.innerText ?? "").split(/\s+/).filter((w) => /\p{L}/u.test(w)).length,
      );
      const row = {
        path,
        width,
        words,
        h1: await page.locator("h1").first().innerText(),
        reveal: await revealCheck(page),
        overflow: (await overflowX(page)).over,
        axe: (await axe(page, { include: "main" })).map((v) => v.id ?? v),
        consoleErrors: [...log.console, ...log.pageErrors].slice(0, 3),
      };
      rows.push(row);
      console.log(JSON.stringify(row));
      if (widths.length) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await shot(page, `../fix/seo-content-email/${name}-${width}`, { fullPage: true });
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/hubs.json`, JSON.stringify({ base: BASE, rows }, null, 1));
