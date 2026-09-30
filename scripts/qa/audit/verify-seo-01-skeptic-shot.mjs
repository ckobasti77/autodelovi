// seo-01 skeptic: rendered document.title vs H1 on two product pages, 390 and 1440, chromium.
import fs from "node:fs";
import { launch, newContext, shot, BASE } from "./kit.mjs";
const browser = await launch("chromium");
const out = [];
for (const width of [390, 1440]) {
  for (const slug of ["kocione-plocice-prednje-sa-senzorom-demo-0009", "kocioni-disk-prednji-276-24-mm-demo-0004"]) {
    const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: "verify-seo01" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/deo/${slug}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => ({
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim(),
      og: document.querySelector('meta[property="og:title"]')?.content,
    }));
    out.push({ width, slug, ...info });
    await page.evaluate((t) => {
      const b = document.createElement("div");
      b.setAttribute("data-reveal", "off");
      b.style.cssText = "position:fixed;left:0;right:0;top:0;z-index:99999;background:#b00020;color:#fff;font:600 15px/1.35 monospace;padding:8px 12px;white-space:pre-wrap";
      b.textContent = "document.title = " + t.title + "\nH1             = " + t.h1;
      document.body.appendChild(b);
    }, info);
    if (slug.includes("0009")) await shot(page, `verify/seo/seo-01-skeptic-title-vs-h1-${width}`);
    await ctx.close();
  }
}
fs.writeFileSync("docs/qa/audit/verify/seo/seo-01-skeptic-rendered.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
