/**
 * Creates one guest order and one inquiry through the real UI and prints their tokenized
 * URLs (for screenshots of the confirmation and status pages):
 *   node scripts/qa/make-demo-flows.mjs [baseUrl] <productSlug>
 */
import { chromium } from "@playwright/test";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const slug = process.argv[3];
if (!slug) throw new Error("product slug required");

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: `Mozilla/5.0 SklopQA/${Date.now()}`,
});
const page = await context.newPage();

await page.goto(`${base}/deo/${slug}`, { waitUntil: "networkidle" });
const add = page.locator("#buy-box").getByTestId("product-add-to-cart");
await add.click();
await page.getByText("Dodato").first().waitFor({ timeout: 20_000 });
await page.goto(`${base}/porudzbina`, { waitUntil: "networkidle" });
await page.getByLabel("Ime", { exact: true }).fill("Ana");
await page.getByLabel("Prezime").fill("Petrović");
await page.getByLabel("Telefon", { exact: true }).fill("063 555 1234");
await page.getByLabel("E-pošta").fill(`qa-${Date.now()}@primer.rs`);
await page.getByRole("checkbox", { name: /Kupujem kao firma/ }).click();
await page.getByLabel("Naziv firme").fill("Auto servis Petrović");
await page.getByLabel("PIB").fill("104052135");
await page.getByTestId("checkout-next").click();
await page.getByRole("radio", { name: /Lično preuzimanje/ }).click();
await page.getByTestId("checkout-next").click();
await page.getByRole("radio", { name: /Virmanom/ }).click();
await page.getByTestId("checkout-next").click();
await page.getByRole("checkbox", { name: /Prihvatam uslove kupovine/ }).click();
await page.waitForTimeout(3200);
await page.getByTestId("checkout-submit").click();
await page.waitForURL(/\/porudzbina\/hvala\//, { timeout: 30_000 });
console.log(`ORDER ${new URL(page.url()).pathname}`);

await page.goto(`${base}/upit`, { waitUntil: "networkidle" });
await page.getByTestId("inquiry-vin-input").fill("TMBJG7NE5F0123456");
await page.getByLabel("Opis").fill("Set zupčastog kaiša sa vodenom pumpom, motor 2.0 TDI.");
await page.getByTestId("inquiry-photo-input").setInputFiles(path.resolve("tests/fixtures/part-photo.jpg"));
await page.locator('[data-testid="inquiry-photo"][data-status="done"]').waitFor({ timeout: 30_000 });
await page.getByLabel("Ime", { exact: true }).fill("Ana Petrović");
await page.getByLabel("Telefon", { exact: true }).fill("063 555 1234");
await page.getByRole("checkbox", { name: /Slažem se/ }).click();
await page.waitForTimeout(3200);
await page.getByTestId("inquiry-submit").click();
await page.waitForURL(/\/upit\/hvala\//, { timeout: 30_000 });
console.log(`INQUIRY ${new URL(page.url()).pathname}`);
await browser.close();
