// vis-commerce: build a guest cart with three lines (one with qty 2) and save the storage state
// so every width reuses the same cart without extra writes.
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch } from "./kit.mjs";

const SLUGS = [
  "kocioni-disk-prednji-276-24-mm-demo-0004",
  "kocioni-disk-prednji-288-25-mm-ventilirani-demo-0001",
  "kocioni-disk-zadnji-272-10-mm-puni-demo-0003",
];

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "viscom-setup" });
const page = await ctx.newPage();
const log = watch(page);
for (const [i, slug] of SLUGS.entries()) {
  await page.goto(`${BASE}/deo/${slug}`, { waitUntil: "networkidle" });
  const add = page.locator("#buy-box").getByTestId("product-add-to-cart");
  await add.click();
  await page.waitForFunction(
    () => /Dodato/.test(document.querySelector("#buy-box [data-testid=product-add-to-cart]")?.textContent ?? ""),
    null,
    { timeout: 20000 },
  );
  if (i === 0) {
    await page.waitForTimeout(1800);
    await add.click();
    await page.waitForTimeout(2000);
  }
}
await page.waitForTimeout(1500);
console.log("cart count", await page.getByTestId("cart-count").textContent());
mkdirSync("docs/qa/audit/vis-commerce/_state", { recursive: true });
writeFileSync("docs/qa/audit/vis-commerce/_state/cart.json", JSON.stringify(await ctx.storageState(), null, 2));
console.log(JSON.stringify(log));
await browser.close();
