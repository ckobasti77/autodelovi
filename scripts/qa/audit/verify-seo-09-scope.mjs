/** Step 21 QA audit — seo-09 verification, scope check: other notFound() routes, JS on and off (390, Chromium). */
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext, shot } from "./kit.mjs";

const URLS = [
  "/ponuda/ne-postoji",
  "/porudzbina/nevazeci-token-123456789012345678901234567",
  "/upit/nevazeci-token-1234567890123456789012345678",
  "/delovi/kocnice/volkswagen",
];
const out = [];
const browser = await launch("chromium");
try {
  for (const js of [true, false]) {
    const ctx = js
      ? await newContext(browser, { width: 390, height: 844, tag: "vseo09s" })
      : await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
    const page = await ctx.newPage();
    for (const u of URLS) {
      const r = await page.goto(BASE + u, { waitUntil: "networkidle" });
      await page.waitForTimeout(js ? 1500 : 300);
      out.push({
        js,
        url: u,
        status: r?.status(),
        title: await page.title(),
        h1: await page.evaluate(() => document.querySelector("h1")?.innerText ?? null),
        header: await page.evaluate(() => Boolean(document.querySelector("header"))),
      });
      if (u.startsWith("/porudzbina")) await shot(page, `verify/seo/seo-09-reproduce-${js ? "js" : "nojs"}-porudzbina-bad-token-390`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/seo/seo-09-reproduce-scope.json", JSON.stringify(out, null, 1));
for (const o of out) console.log(o.js ? "js  " : "nojs", o.status, o.url, "|", o.title, "|", o.h1, "| header", o.header);
