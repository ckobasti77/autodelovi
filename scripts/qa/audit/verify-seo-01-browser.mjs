// Verifier for seo-01: rendered document.title vs H1 in real browsers (hard load + client-side
// navigation), with a visible banner overlay so the screenshot shows both strings.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const P1 = "/deo/kocioni-disk-prednji-276-24-mm-demo-0004";
const P2 = "/deo/kocione-plocice-prednje-sa-senzorom-demo-0009";
const log = [];

async function overlay(page) {
  await page.evaluate(() => {
    const h1 = document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim();
    const og = document.querySelector('meta[property="og:title"]')?.getAttribute("content");
    const d = document.createElement("div");
    d.setAttribute("data-reveal", "off");
    d.style.cssText =
      "position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#b00020;color:#fff;font:14px/1.4 monospace;padding:8px 12px;white-space:pre-wrap";
    d.textContent = `document.title: ${document.title}\nog:title:       ${og}\nH1:             ${h1}`;
    document.body.appendChild(d);
  });
}

async function read(page) {
  return page.evaluate(() => ({
    url: location.pathname,
    title: document.title,
    og: document.querySelector('meta[property="og:title"]')?.getAttribute("content"),
    tw: document.querySelector('meta[name="twitter:title"]')?.getAttribute("content"),
    h1: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim(),
  }));
}

for (const [engine, width, height] of [
  ["chromium", 1440, 900],
  ["chromium", 390, 844],
  ["webkit", 390, 844],
  ["firefox", 1280, 800],
]) {
  const browser = await launch(engine);
  const ctx = await newContext(browser, { width, height, engine, tag: "verify-seo-01" });
  const page = await ctx.newPage();
  for (const p of [P1, P2]) {
    await page.goto(BASE + p, { waitUntil: "load" });
    await page.waitForTimeout(800);
    log.push({ engine, width, mode: "hard-load", ...(await read(page)) });
  }
  if (engine === "chromium") {
    await page.goto(BASE + P2, { waitUntil: "load" });
    await page.waitForTimeout(500);
    await overlay(page);
    await shot(page, `verify/seo/seo-01-reproduce-${engine}-${width}`);
    // Client-side navigation: search results -> product card link.
    await page.goto(BASE + "/pretraga?q=disk", { waitUntil: "load" });
    await page.waitForTimeout(1500);
    const link = page.locator(`a[href="${P1}"]`).first();
    if (await link.count()) {
      await link.scrollIntoViewIfNeeded();
      await link.click();
      await page.waitForURL(`**${P1}`);
      await page.waitForTimeout(1500);
      log.push({ engine, width, mode: "client-nav from /pretraga?q=disk", ...(await read(page)) });
    } else {
      log.push({ engine, width, mode: "client-nav", error: "link not found" });
    }
  }
  await browser.close();
}
for (const r of log) console.log(JSON.stringify(r));
writeFileSync("docs/qa/audit/verify/seo/seo-01-reproduce-browser.json", JSON.stringify(log, null, 2));
