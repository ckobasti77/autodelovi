// Verifier for copy-01: visual evidence — the live document.title / og:title / description
// next to the H1, rendered as an overlay on the real product page (1440 and 390, Chromium +
// Firefox title check), plus the anonymous vs mechanic title comparison.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { BASE, launch, newContext, shot, loginWith } from "./kit.mjs";

const OUT = path.resolve("docs/qa/audit/verify/copy");
const urls = [
  "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
  "/deo/kocione-plocice-prednje-sa-senzorom-demo-0009",
  "/deo/abs-senzor-prednji-demo-0020",
];

async function overlay(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s)?.getAttribute("content") ?? "(none)";
    const data = {
      h1: document.querySelector("h1")?.textContent?.trim() ?? "",
      title: document.title,
      og: q('meta[property="og:title"]'),
      tw: q('meta[name="twitter:title"]'),
      desc: q('meta[name="description"]'),
    };
    const box = document.createElement("div");
    box.setAttribute("data-reveal", "off");
    box.style.cssText =
      "position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;background:#fff;color:#000;border:3px solid #c00;padding:10px;font:14px/1.35 monospace;white-space:pre-wrap;word-break:break-word";
    box.textContent = `[verifier overlay]\nH1:          ${data.h1}\ndocument.title: ${data.title}\nog:title:    ${data.og}\ntwitter:title: ${data.tw}\ndescription: ${data.desc}`;
    document.body.appendChild(box);
    return data;
  });
}

const log = [];
for (const engine of ["chromium", "firefox"]) {
  const browser = await launch(engine);
  for (const w of engine === "chromium" ? [1440, 390] : [1440]) {
    const ctx = await newContext(browser, { width: w, height: w > 1000 ? 900 : 844, engine, tag: "verify-copy01" });
    const page = await ctx.newPage();
    for (const u of urls) {
      await page.goto(BASE + u, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      const d = await overlay(page);
      log.push({ engine, width: w, url: u, ...d });
      if (u === urls[0]) await shot(page, `verify/copy/copy-01-reproduce-${engine}-${w}`);
    }
    await ctx.close();
  }
  await browser.close();
}

// Mechanic (signed-in) view: title must be the same template output.
try {
  const accounts = JSON.parse(readFileSync(path.resolve(".playwright/audit-accounts.json"), "utf8"));
  const mech = accounts.mechanic ?? Object.values(accounts).find((a) => /meh|mech/i.test(JSON.stringify(a)));
  const browser = await launch("chromium");
  const ctx = await newContext(browser, { width: 1440, tag: "verify-copy01-mech" });
  const page = await ctx.newPage();
  await loginWith(page, mech.email, mech.password, urls[0]);
  await page.goto(BASE + urls[0], { waitUntil: "networkidle" });
  log.push({ role: "mechanic", url: urls[0], title: await page.title() });
  await ctx.close();
  await browser.close();
} catch (e) {
  log.push({ role: "mechanic", error: String(e) });
}

writeFileSync(path.join(OUT, "copy-01-reproduce-browser.json"), JSON.stringify(log, null, 2));
console.log(JSON.stringify(log.map((l) => ({ e: l.engine ?? l.role, w: l.width, u: l.url, title: l.title, err: l.error })), null, 1));
