// FLOW-02 / FLOW-20 / SEO-06 / VIS-31 re-verification on the product editor (owner session).
// AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/search-catalog-content-admin.mjs
import fs from "node:fs";

import { BASE, convexRun, launch, shot } from "../audit/kit.mjs";
import { go, ownerCtx } from "../audit/flows-admin-lib2.mjs";

const PID = "qh7cqja340240s4jq1fsawnc3s8fctej"; // AUDIT-FA-852021 (audit fixture, inactive)
const SKU = "AUDIT-FA-852021";
const OUT = "docs/qa/fix/search-catalog-content";
fs.mkdirSync(OUT, { recursive: true });
const report = { base: BASE, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, ...data });
  console.log(name, JSON.stringify(data).slice(0, 500));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const save = async (page) => {
  await page.keyboard.press("Control+s");
  await sleep(2500);
};
const head = async (path) => {
  const res = await fetch(BASE + path, { redirect: "manual" });
  return { status: res.status, location: res.headers.get("location") };
};

const browser = await launch();
try {
  const ctx = await ownerCtx(browser, { tag: "fix-scc" });
  const A = await go(ctx, `/admin/proizvodi/${PID}`);
  const B = await go(ctx, `/admin/proizvodi/${PID}`);
  const name0 = await A.getByTestId("admin-product-name").inputValue();
  const price0 = await A.getByTestId("admin-product-price").inputValue();
  step("start", { name0, price0, server: convexRun("testing:productBySku", { sku: SKU }) });

  // FLOW-02: A edits the name, B saves a new price, A saves — B's price must survive.
  await A.getByTestId("admin-product-name").fill(`${name0} (fix22)`);
  const newPrice = price0.startsWith("6") ? "4.990" : "6.490";
  await B.getByTestId("admin-product-price").fill(newPrice);
  await save(B);
  await sleep(1500);
  step("tab B saved", {
    server: convexRun("testing:productBySku", { sku: SKU }),
    notice: await A.getByTestId("admin-product-rebased").textContent().catch(() => null),
    priceA: await A.getByTestId("admin-product-price").inputValue(),
    nameA: await A.getByTestId("admin-product-name").inputValue(),
  });
  await shot(A, "../fix/search-catalog-content/admin-rebased-notice", {
    locator: A.getByTestId("admin-product-rebased"),
  }).catch(() => undefined);
  await save(A);
  step("tab A saved", {
    server: convexRun("testing:productBySku", { sku: SKU }),
    toasts: await A.locator("[data-sonner-toast]").allTextContents(),
  });
  // Restore.
  await A.getByTestId("admin-product-name").fill(name0);
  await A.getByTestId("admin-product-price").fill(price0);
  await save(A);
  step("restored", { server: convexRun("testing:productBySku", { sku: SKU }) });

  // VIS-31: one description counter.
  step("seo counters", {
    texts: await A.locator("text=/\\d+\\s\\/\\s(155|170)/").allTextContents(),
  });

  // SEO-06: rename the slug, the old URL answers 308 to the new one; renaming back must not loop.
  const slugInput = A.getByLabel("Adresa na sajtu (slug)");
  const slug0 = await slugInput.inputValue();
  await slugInput.fill(`${slug0}-r22`);
  await save(A);
  await sleep(3000);
  step("renamed", { old: await head(`/deo/${slug0}`), next: await head(`/deo/${slug0}-r22`) });
  await slugInput.fill(slug0);
  await save(A);
  await sleep(3000);
  step("renamed back", {
    original: await head(`/deo/${slug0}`),
    temporary: await head(`/deo/${slug0}-r22`),
  });

  // FLOW-20: empty save on a new product moves focus to the error summary.
  const N = await go(ctx, "/admin/proizvodi/novi");
  await N.getByRole("button", { name: /Sačuvaj|Napravi/ })
    .first()
    .click();
  await sleep(800);
  step("empty save", {
    focus: await N.evaluate(
      () => `${document.activeElement?.tagName} role=${document.activeElement?.getAttribute("role")}`,
    ),
    invalid: await N.locator("[aria-invalid=true]").count(),
  });
  await ctx.close();
} finally {
  await browser.close();
}
fs.writeFileSync(`${OUT}/admin.json`, JSON.stringify(report, null, 2));
