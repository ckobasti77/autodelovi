// copy-01 skeptic: document.title after hydration and a client-side navigation (not just SSR head).
import { appendFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
const browser = await launch("chromium");
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-copy01" });
const page = await ctx.newPage();
const out = [];
await page.goto(`${BASE}/deo/kocioni-disk-prednji-276-24-mm-demo-0004`, { waitUntil: "networkidle" });
out.push(`hydrated document.title: ${await page.title()}`);
out.push(`H1: ${(await page.locator("h1").first().innerText()).replace(/\s+/g, " ")}`);
// Client-side navigation from the category page to a product link.
await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
const link = page.locator('a[href^="/deo/kocioni-disk"]').first();
const href = await link.getAttribute("href");
await link.click();
await page.waitForURL(`**${href}`);
await page.waitForTimeout(1500);
out.push(`client-nav ${href} document.title: ${await page.title()}`);
// Visual evidence: show document.title next to the H1 in an injected label (evidence only).
await page.evaluate(() => {
  const d = document.createElement("div");
  d.setAttribute("data-reveal", "off");
  d.style.cssText = "position:fixed;left:16px;right:16px;bottom:16px;z-index:99999;background:#000;color:#ff0;font:600 20px/1.4 monospace;padding:12px;border:3px solid #f00";
  d.textContent = "document.title = " + document.title + "   |   og:title = " + document.querySelector('meta[property="og:title"]').content;
  document.body.appendChild(d);
});
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1200);
await shot(page, "verify/copy/copy-01-skeptic-title-vs-h1-1440");
appendFileSync("docs/qa/audit/verify/copy/copy-01-skeptic.txt", "\n\n== Browser check ==\n" + out.join("\n") + "\n");
console.log(out.join("\n"));
await browser.close();
