/**
 * Import wizard walk-through for the design review (docs/qa/IMPORT.md): template download,
 * 500-row fixture → preview → columns → check → dry run → commit → rollback, plus history,
 * batch record and exports — screenshots at the given width into docs/qa/screens/step-16/.
 *   node scripts/qa/import-flow.mjs [baseUrl] [width]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const width = Number(process.argv[3] ?? 1440);
const out = path.resolve("docs/qa/screens/step-16");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height: 900 },
  locale: "sr-Latn-RS",
  timezoneId: "Europe/Belgrade",
  acceptDownloads: true,
});
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
const shot = async (name, full = true) => {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(out, `${name}-${width}.png`), fullPage: full });
  console.log(name, width, errors.length ? `ERRORS: ${errors.join(" | ")}` : "");
  errors.length = 0;
};

await page.goto(`${base}/prijava?next=%2Fadmin%2Fuvoz`, { waitUntil: "networkidle" });
await page.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
await page.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
await page.getByTestId("auth-submit").click();
await page.waitForURL(/\/admin\/uvoz/, { timeout: 60_000 });
await page.waitForTimeout(2000);
await shot("uvoz-start");

const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByTestId("import-template").click(),
]);
console.log("template", download.suggestedFilename());

await page
  .getByTestId("import-file-input")
  .setInputFiles(path.resolve("tests/fixtures/import/proizvodi-500.xlsx"));
await page.getByTestId("import-row-count").waitFor({ timeout: 30_000 });
await shot("uvoz-datoteka");
await page.getByTestId("import-to-mapping").click();
await page.getByTestId("import-mapping").waitFor();
await shot("uvoz-kolone");
await page.getByTestId("import-to-check").click();
await page.getByTestId("import-problems").waitFor({ timeout: 30_000 });
await shot("uvoz-provera");
await page.getByTestId("import-start-dry-run").click();
await page.getByTestId("import-commit").waitFor({ timeout: 120_000 });
await page.waitForTimeout(2500);
await shot("uvoz-probni");
await page.getByTestId("import-commit").click();
await page.getByTestId("import-result").waitFor({ timeout: 240_000 });
await shot("uvoz-upisan");
const batchUrl = page.url();
await page.getByTestId("import-rollback").click();
await page.getByRole("button", { name: "Poništi uvoz" }).last().click();
await page.getByTestId("import-rolled-back").waitFor({ timeout: 240_000 });
await shot("uvoz-ponisten");
console.log("batch", batchUrl);

await page.goto(`${base}/admin/uvoz/istorija`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot("uvoz-istorija");
const id = new URL(batchUrl).searchParams.get("uvoz");
if (id) {
  await page.goto(`${base}/admin/uvoz/${id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await shot("uvoz-zapis");
}
await page.goto(`${base}/admin/izvoz`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await shot("izvoz");
for (const testId of ["export-products", "export-orders", "export-customers", "export-mechanics"]) {
  const [file] = await Promise.all([
    page.waitForEvent("download", { timeout: 120_000 }),
    page.getByTestId(testId).click(),
  ]);
  console.log("download", testId, file.suggestedFilename());
}
await browser.close();
