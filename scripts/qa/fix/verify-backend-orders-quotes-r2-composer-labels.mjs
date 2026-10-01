/**
 * Step 22 re-verify (regression probe on BE-01's route /admin/upiti/[broj]): are the quote
 * composer's line inputs still named by their visible labels? The e2e
 * tests/e2e/admin.spec.ts „inquiry: answer with a quote“ fails on getByLabel("Naziv").
 * Opens the composer on a test inquiry (testing:createTestInquiry, isTest), adds a free line,
 * reads label → control association and the accessible names; nothing is saved.
 * Run: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/verify-backend-orders-quotes-r2-composer-labels.mjs
 * Output: docs/qa/fix/backend-orders-quotes/verify/r2-composer-labels.json + .webp
 */
import { writeFileSync } from "node:fs";
import sharp from "sharp";

import { BASE, convexRun, launch, loginAdmin, newContext, watch } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/backend-orders-quotes/verify";
const out = { base: BASE };
const number = process.env.INQUIRY ?? convexRun("testing:createTestInquiry", { tag: `r2-labels-${Date.now()}` }).number;
out.inquiry = number;
const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "r2-composer-labels" });
  const page = await ctx.newPage();
  const w = watch(page);
  await loginAdmin(page);
  await page.goto(`${BASE}/admin/upiti/${number}`, { waitUntil: "load", timeout: 120_000 });
  await page.getByTestId("admin-quote-compose").waitFor({ timeout: 120_000 });
  await page.getByTestId("admin-quote-compose").click();
  const composer = page.getByTestId("admin-quote-composer");
  await composer.waitFor();
  if ((await composer.locator("ol > li").count()) === 0) {
    await composer.getByRole("button", { name: "Slobodna stavka" }).click();
  }
  await composer.locator("ol > li").first().waitFor();
  out.labels = await composer.locator("ol > li").first().evaluate((li) =>
    [...li.querySelectorAll("label[for]")].map((l) => {
      const target = document.getElementById(l.getAttribute("for"));
      return {
        label: l.textContent.trim(),
        htmlFor: l.getAttribute("for"),
        targetExists: Boolean(target),
        controlIdNearby: l.parentElement?.querySelector("input,select,textarea")?.id ?? null,
      };
    }),
  );
  out.getByLabel = {};
  for (const name of ["Naziv", "Količina", "Cena sa PDV-om", "Rok (dana)", "Šifra / OEM", "Dostupnost"]) {
    out.getByLabel[name] = await composer.getByLabel(name, { exact: true }).count();
  }
  const snapshot = await composer.locator("ol > li").first().ariaSnapshot();
  out.ariaSnapshot = snapshot.split("\n").slice(0, 30);
  const buf = await composer.screenshot({ type: "png" });
  await sharp(buf).webp({ quality: 70 }).toFile(`${OUT}/r2-composer-labels-1440.webp`);
  out.shot = `${OUT}/r2-composer-labels-1440.webp`;
  out.console = w.console;
  out.pageErrors = w.pageErrors;
  await ctx.close();
} finally {
  await browser.close();
  writeFileSync(`${OUT}/r2-composer-labels.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
}
