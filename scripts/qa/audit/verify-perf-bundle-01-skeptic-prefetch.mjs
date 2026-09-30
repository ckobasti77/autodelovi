// Verifier (skeptic) for perf-bundle-01: is the zod/RHF chunk fetched on pages that link to the
// forms (Link prefetch), and what happens on a client-side navigation cart -> checkout?
//   node scripts/qa/audit/verify-perf-bundle-01-skeptic-prefetch.mjs
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext, scrollThrough } from "./kit.mjs";

const CHUNK = "1uyyf-z7kpx1w.js";
const browser = await launch("chromium");
const out = [];
const log = (s) => {
  out.push(s);
  console.log(s);
};

for (const route of ["/", "/deo/kocione-plocice-prednje-demo-0012", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/korpa", "/za-majstore"]) {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "pb01-prefetch" });
  const page = await ctx.newPage();
  let hit = false;
  page.on("request", (r) => {
    if (r.url().includes(CHUNK)) hit = true;
  });
  await page.goto(BASE + route, { waitUntil: "load" });
  await scrollThrough(page);
  await page.waitForTimeout(4000);
  const links = await page.$$eval("a[href]", (as) =>
    [...new Set(as.map((a) => a.getAttribute("href")).filter((h) => /^\/(upit|porudzbina|za-majstore\/registracija)/.test(h)))],
  );
  log(`${route.padEnd(48)} links to forms: ${JSON.stringify(links)}  chunk fetched without interaction: ${hit}`);
  await ctx.close();
}

// Client-side navigation: add the in-stock product to the cart, open /korpa, click through to checkout.
{
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "pb01-nav" });
  const page = await ctx.newPage();
  const seen = [];
  page.on("request", (r) => {
    if (r.url().includes(CHUNK)) seen.push({ t: Date.now(), url: page.url() });
  });
  await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load" });
  const add = page.getByRole("button", { name: /dodaj u korpu/i }).first();
  await add.click();
  await page.waitForTimeout(1500);
  await page.goto(BASE + "/korpa", { waitUntil: "load" });
  await page.waitForTimeout(4000);
  const before = seen.length;
  const checkoutLink = page.locator('a[href^="/porudzbina"]').first();
  const hasLink = await checkoutLink.count();
  let navT = 0;
  if (hasLink) {
    const t0 = Date.now();
    await checkoutLink.click();
    await page.waitForURL(/\/porudzbina/);
    navT = Date.now() - t0;
  }
  await page.waitForTimeout(2000);
  log(
    `cart -> checkout (client nav): checkout link present ${Boolean(hasLink)}; chunk requested while on /korpa before click: ${before > 0}; requested after click: ${seen.length > before}; url now ${page.url().replace(BASE, "")}; nav ${navT} ms`,
  );
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-01-skeptic-prefetch.txt", out.join("\n") + "\n");
