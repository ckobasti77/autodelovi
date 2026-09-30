/**
 * Step 21 QA audit — independent runtime verification of seo-08 (renamed product slug -> no redirect).
 * Creates an INACTIVE test product through the admin UI (SKU E2E-VSEO08-<ts>, same convention as
 * tests/e2e/admin.spec.ts, so it never reaches the storefront listings), renames its slug through the
 * „Adresa na sajtu (slug)“ field, then requests the old and new /deo/ URLs without following redirects.
 * Output: docs/qa/audit/verify/seo/seo-08-reproduce.json + seo-08-reproduce-*.webp
 */
import { writeFileSync } from "node:fs";

import { BASE, launch, loginAdmin, newContext, shot, convexRun } from "./kit.mjs";

const stamp = Date.now().toString(36);
const out = { base: BASE, stamp };
const browser = await launch("chromium");
try {
  const context = await newContext(browser, { width: 1440, height: 900, tag: "verify-seo08" });
  const page = await context.newPage();
  await loginAdmin(page);
  const name = `Kočioni disk verifikacija ${stamp}`;
  await page.goto(`${BASE}/admin/proizvodi/novi`, { waitUntil: "networkidle" });
  await page.getByTestId("admin-product-name").fill(name);
  await page.getByTestId("admin-product-sku").fill(`E2E-VSEO08-${stamp}`);
  await page.getByTestId("admin-product-category").selectOption({ label: "Kočnice › Kočioni diskovi" });
  await page.getByTestId("admin-product-manufacturer").selectOption({ label: "ATE" });
  await page.getByTestId("admin-product-price").fill("12990");
  // Keep the test product off the storefront.
  await page.getByRole("switch", { name: /Aktivan/ }).click();
  await page.getByRole("button", { name: "Sačuvaj artikal" }).click();
  await page.waitForURL(/\/admin\/proizvodi\/[a-z0-9]{20,}$/, { timeout: 60_000 });
  await page.getByRole("heading", { level: 1, name }).waitFor({ timeout: 30_000 });
  out.adminUrl = page.url();

  const slugInput = page.getByLabel("Adresa na sajtu (slug)");
  const oldSlug = await slugInput.inputValue();
  out.oldSlug = oldSlug;
  out.helpText = await page.getByText("Promena pravi preusmerenje sa stare adrese.").textContent();
  const newSlug = `${oldSlug}-novi`;
  await slugInput.fill(newSlug);
  await slugInput.scrollIntoViewIfNeeded();
  out.adminShot = await shot(page, "verify/seo/seo-08-reproduce-admin-slug");
  await page.getByRole("button", { name: "Sačuvaj", exact: true }).click();
  await page.getByText("Sačuvano.").first().waitFor({ timeout: 30_000 });
  await page.reload({ waitUntil: "networkidle" });
  out.newSlugAfterReload = await page.getByLabel("Adresa na sajtu (slug)").inputValue();

  // Give the Next data cache a moment; product lookups are tagged and revalidated on write.
  await page.waitForTimeout(3000);
  const probe = async (p) => {
    const r = await fetch(BASE + p, { redirect: "manual" });
    return { path: p, status: r.status, location: r.headers.get("location") };
  };
  out.oldUrl = await probe(`/deo/${oldSlug}`);
  out.newUrl = await probe(`/deo/${out.newSlugAfterReload}`);

  const visitor = await context.newPage();
  await visitor.goto(`${BASE}/deo/${oldSlug}`, { waitUntil: "networkidle" });
  await visitor.waitForTimeout(1500);
  out.oldUrlBrowser = {
    finalUrl: visitor.url(),
    title: await visitor.title(),
    h1: await visitor.locator("h1").first().textContent().catch(() => null),
  };
  out.visitorShot = await shot(visitor, "verify/seo/seo-08-reproduce-old-url");
} finally {
  await browser.close();
}
try {
  out.product = convexRun("testing:productBySku", { sku: `E2E-VSEO08-${stamp}` });
} catch (e) {
  out.productErr = String(e).slice(0, 300);
}
writeFileSync("docs/qa/audit/verify/seo/seo-08-reproduce.json", JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
