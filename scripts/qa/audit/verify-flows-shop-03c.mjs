/** flows-shop-03 workaround check: product page fitment row for a non-fitting disc with Golf VII stored. */
import { BASE, launch, newContext, shot } from "./kit.mjs";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await launch();
const ctx = await newContext(browser, { width: 390, height: 844, tag: "verify-fs03c" });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(150_000);
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.setItem("sk.vehicle.v1", JSON.stringify({ state: { vehicle: { brand: { slug: "volkswagen", name: "Volkswagen" }, model: { slug: "golf", name: "Golf" }, generation: { slug: "golf-7", name: "Golf VII", yearFrom: 2012, yearTo: 2020 }, engine: null } }, version: 1 })));
await page.goto(`${BASE}/pretraga?q=${encodeURIComponent("kočioni disk")}`, { waitUntil: "domcontentloaded" });
await page.locator('[data-testid="product-card"]').first().waitFor();
const href = await page.evaluate(() => [...document.querySelectorAll('[data-testid="product-card"] a')].map((a) => [a.textContent.trim(), a.getAttribute("href")]).find(([t]) => /256/.test(t))?.[1]);
await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded" });
await page.locator("h1").first().waitFor();
await sleep(4000);
const fit = await page.evaluate(() => (document.querySelector("main").innerText.match(/(Ne odgovara|Odgovara|Nije potvrđeno|ne odgovara)[^\n]{0,80}/g) ?? []).slice(0, 4));
console.log(href, JSON.stringify(fit));
const el = page.getByText(/odgovara/i).first();
if (await el.count()) { await el.scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, -200)); await sleep(800); }
await shot(page, "verify/flows-shop/flows-shop-03-reproduce-390-product-nonfit");
await browser.close();
