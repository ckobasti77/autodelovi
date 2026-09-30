// Verify seo-15 in a rendered browser (what a JS-rendering crawler sees): no consent cookie, 390 px.
import { writeFileSync, appendFileSync } from "node:fs";
import { launch, newContext, shot, BASE } from "./kit.mjs";
const browser = await launch("chromium");
const ctx = await newContext(browser, { width: 390, height: 844, consent: false, tag: "verify-seo-15" });
const page = await ctx.newPage();
await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "networkidle" });
const info = await page.evaluate(() => {
  const dlg = document.querySelector('[role="dialog"][aria-labelledby]');
  const headings = [...document.querySelectorAll("h1,h2,h3")].slice(0, 3).map((h) => `${h.tagName} ${h.textContent.trim()}`);
  const all = [...document.body.querySelectorAll("*")];
  return {
    dialogVisible: !!dlg && dlg.getBoundingClientRect().height > 0,
    dialogHasNosnippet: !!dlg?.closest("[data-nosnippet]") || !!dlg?.hasAttribute("data-nosnippet"),
    dialogIndex: all.indexOf(dlg),
    headerIndex: all.indexOf(document.querySelector("header")),
    h1Index: all.indexOf(document.querySelector("h1")),
    firstHeadings: headings,
    firstText: document.body.innerText.slice(0, 300).replace(/\s+/g, " "),
  };
});
console.log(JSON.stringify(info, null, 2));
await shot(page, "verify/seo/seo-15-reproduce-390");
appendFileSync("docs/qa/audit/verify/seo/seo-15-reproduce.txt", `\nRendered (Chromium 390x844, no sk_consent) ${BASE}/delovi/kocioni-diskovi:\n${JSON.stringify(info, null, 2)}\nScreenshot: docs/qa/audit/verify/seo/seo-15-reproduce-390.webp\n`);
await browser.close();
