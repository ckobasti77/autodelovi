/**
 * Admin interaction states for the design review (docs/qa/ADMIN.md): command palette with
 * results, notification bell, order transition dialog, quote composer, bulk bar, product
 * editor dirty save bar — at 1440 and 1024, into docs/qa/screens/step-15/states/.
 *   node scripts/qa/admin-states.mjs [baseUrl] <orderNumber> <inquiryNumber> <productId>
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const [base = "http://localhost:3000", order, inquiry, product] = process.argv.slice(2);
const out = path.resolve("docs/qa/screens/step-15/states");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "sr-Latn-RS", timezoneId: "Europe/Belgrade" })).newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`${base}/prijava?next=%2Fadmin`, { waitUntil: "networkidle" });
await page.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
await page.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
await page.getByTestId("auth-submit").click();
await page.waitForURL(/\/admin$/, { timeout: 60_000 });
const shot = async (name) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, `${name}-${page.viewportSize().width}.png`) });
  console.log(name, page.viewportSize().width, errors.length ? `ERRORS ${errors.join(" | ")}` : "");
  errors.length = 0;
};
for (const width of [1440, 1024]) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox", { name: /Pretraga/ }).fill("1K0");
  await page.waitForTimeout(1500);
  await shot("palette");
  await page.keyboard.press("Escape");
  await page.getByTestId("admin-notification-bell").click();
  await shot("bell");
  await page.keyboard.press("Escape");
  if (order) {
    await page.goto(`${base}/admin/porudzbine/${order}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.getByRole("button", { name: "Promeni status" }).click();
    await shot("order-menu");
    await page.keyboard.press("Escape");
    const cancel = page.getByRole("button", { name: /^Potvrdi$|Označi kao/ }).first();
    if (await cancel.count()) {
      await cancel.click();
      await shot("order-dialog");
      await page.keyboard.press("Escape");
    }
  }
  if (inquiry) {
    await page.goto(`${base}/admin/upiti/${inquiry}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const compose = page.getByTestId("admin-quote-compose");
    if (await compose.count()) {
      await compose.click();
      await page.getByRole("button", { name: "Slobodna stavka" }).click();
      await page.getByTestId("admin-quote-composer").getByLabel("Naziv", { exact: true }).fill("Set kvačila LuK 2.0 TDI");
      await page.getByTestId("admin-quote-composer").getByLabel("Cena sa PDV").fill("24990");
      await page.screenshot({ path: path.join(out, `quote-${width}.png`), fullPage: true });
      console.log("quote", width);
    }
  }
  await page.goto(`${base}/admin/proizvodi`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const boxes = page.getByRole("checkbox", { name: /^Izaberi / });
  await boxes.nth(1).click();
  await boxes.nth(2).click();
  await shot("products-bulk");
  if (product) {
    await page.goto(`${base}/admin/proizvodi/${product}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);
    await page.getByTestId("admin-product-name").fill("Izmena naziva — proba");
    await shot("product-dirty");
  }
  await page.goto(`${base}/admin/proizvodi/novi`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, `product-new-${width}.png`), fullPage: true });
  console.log("product-new", width);
}
await browser.close();
