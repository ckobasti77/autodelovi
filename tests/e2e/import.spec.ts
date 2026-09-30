/**
 * Step 16 — Excel import (docs/IMPORT.md), desktop widths only: template download; the
 * 500-row fixture (tests/fixtures/import/proizvodi-500.xlsx, made by
 * scripts/make-import-fixtures.mjs) → columns auto-mapped by synonyms → the check shows the
 * seeded errors → dry run 490 new / 10 errors → commit → counts → rollback removes the
 * products. Fixture products are inactive, so the storefront never shows them; leftovers
 * of a failed run are purged before and after.
 */
import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

import { TEST_IDS } from "../../constants/testIds";

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

test.skip(!email || !password, "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "admin runs at desktop widths");
test.describe.configure({ mode: "serial" });

function convexRun<T>(fn: string, args: Record<string, unknown> = {}): T {
  const out = execFileSync(
    process.execPath,
    [path.resolve("node_modules/convex/bin/main.js"), "run", `testing:${fn}`, JSON.stringify(args)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
  // The CLI prints the JSON value last: an object, array, number or null.
  const start = out.search(/[[{]|^-?\d|^null/m);
  // A `null` result prints nothing.
  return (start < 0 ? null : JSON.parse(out.slice(start))) as T;
}

type Probe = { active: boolean; retailPricePara: number; stockQty: number; source: string } | null;

/** Removes fixture products left by a failed run (40 per call). */
function purge() {
  for (let i = 0; i < 40; i++) {
    if (convexRun<{ products: number }>("purgeImportFixtures").products === 0) return;
  }
}

test.beforeAll(() => purge());
test.afterAll(() => purge());

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function signIn(page: Page) {
  await page.goto(`/prijava?next=${encodeURIComponent("/admin/uvoz")}`);
  await page.getByTestId(TEST_IDS.authEmail).fill(email!);
  await page.getByTestId(TEST_IDS.authPassword).fill(password!);
  await page.getByTestId(TEST_IDS.authSubmit).click();
  await expect(page).toHaveURL(/\/admin\/uvoz/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Uvoz iz Excela" })).toBeVisible({
    timeout: 30_000,
  });
}

test("template download has the five sheets and Serbian headers", async ({ page }) => {
  await signIn(page);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("import-template").click(),
  ]);
  expect(download.suggestedFilename()).toBe("sablon-za-uvoz-artikala.xlsx");
  const file = await download.path();
  const book = XLSX.read(readFileSync(file), { type: "buffer" });
  expect(book.SheetNames).toEqual(["Proizvodi", "Uputstvo", "Kategorije", "Proizvođači", "Vozila"]);
  const header = XLSX.utils.sheet_to_json<string[]>(book.Sheets.Proizvodi!, { header: 1 })[0];
  expect(header?.slice(0, 5)).toEqual(["Šifra", "Naziv", "Kategorija", "Proizvođač", "Kvalitet"]);
  const categories = XLSX.utils.sheet_to_json<string[]>(book.Sheets.Kategorije!, { header: 1 });
  expect(categories.length).toBeGreaterThan(40);
});

test("500 rows: mapping → seeded errors → dry run → commit → rollback", async ({ page }) => {
  test.setTimeout(600_000);
  const errors = collectErrors(page);
  await signIn(page);

  await page
    .getByTestId("import-file-input")
    .setInputFiles(path.resolve("tests/fixtures/import/proizvodi-500.xlsx"));
  await expect(page.getByTestId("import-row-count")).toHaveText("500 redova", { timeout: 30_000 });
  await page.getByTestId("import-to-mapping").click();

  // Synonym headers („Šifra artikla“, „Brend“, „Kat. br.“, „MPC“, „Lager“ …) map by themselves.
  const mapping = page.getByTestId("import-mapping");
  await expect(
    mapping.getByRole("combobox", { name: "Polje za kolonu Šifra artikla" }),
  ).toHaveValue("sku");
  await expect(mapping.getByRole("combobox", { name: "Polje za kolonu Brend" })).toHaveValue(
    "manufacturer",
  );
  await expect(mapping.getByRole("combobox", { name: "Polje za kolonu Kat. br." })).toHaveValue(
    "oem",
  );
  await expect(mapping.getByRole("combobox", { name: "Polje za kolonu MPC" })).toHaveValue(
    "priceRetail",
  );
  await expect(mapping.getByRole("combobox", { name: "Polje za kolonu Lager" })).toHaveValue(
    "stock",
  );
  await page.getByTestId("import-to-check").click();

  const problems = page.getByTestId("import-problems");
  await expect(problems).toBeVisible({ timeout: 60_000 });
  await expect(problems).toContainText("Cena „12,99a“ nije ispravan broj.");
  await expect(problems).toContainText("Kategorija „Nepostojeća kategorija“ ne postoji.");
  await expect(problems).toContainText("Šifra IMP-T-0001 se ponavlja u fajlu");
  await expect(problems).toContainText("Količina ne može biti negativna (-3).");
  await expect(problems).toContainText("Adresa slike nije ispravna");
  await expect(problems).toContainText("Vozila nisu prepoznata: Opel Astra H.");

  await page.getByTestId("import-start-dry-run").click();
  const commit = page.getByTestId("import-commit");
  await expect(commit).toBeVisible({ timeout: 180_000 });
  await expect(page.getByText("490 artikala se upisuje")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Greške (10)" })).toBeVisible();
  await page.getByRole("tab", { name: "Greške (10)" }).click();
  // The first five error rows; the two missing-name rows (new products need a name) are in the count.
  await expect(
    page.getByRole("tabpanel").getByText("Cena „12,99a“ nije ispravan broj."),
  ).toBeVisible();

  await commit.click();
  await expect(page.getByTestId("import-result")).toBeVisible({ timeout: 300_000 });
  const created = convexRun<Probe>("productBySku", { sku: "IMP-T-0005" });
  expect(created).toMatchObject({ active: false, source: "import" });
  expect(convexRun<Probe>("productBySku", { sku: "IMP-T-0011" })).toBeNull(); // bad price row

  await page.getByTestId("import-rollback").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Poništi uvoz" }).click();
  await expect(page.getByTestId("import-rolled-back")).toBeVisible({ timeout: 300_000 });
  expect(convexRun<Probe>("productBySku", { sku: "IMP-T-0005" })).toBeNull();

  expect(errors).toEqual([]);
});
