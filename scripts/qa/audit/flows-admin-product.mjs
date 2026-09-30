// flows-admin: product create (validation, codes preview, SEO preview, image upload), edit,
// two-tab lost-update check, duplicate, history, deactivate. Usage: node flows-admin-product.mjs
import path from "node:path";
import { launch, watch, shot } from "./kit.mjs";
import { save, sleep } from "./flows-admin-lib.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";

const browser = await launch();
const ts = Date.now().toString().slice(-6);
const report = { ts, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 600));
};
const txt = async (l) => ((await l.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
const priceOf = async (p) => p.getByTestId("admin-product-price").locator("input").or(p.getByTestId("admin-product-price")).first().inputValue();

try {
  const ctx = await ownerCtx(browser, { tag: "fa-prod" });
  const page = await go(ctx, "/admin/proizvodi/novi");
  const log = watch(page);
  // 1. empty save via Ctrl+S
  await page.keyboard.press("Control+s");
  await sleep(1200);
  step("empty save", {
    errors: (await page.locator("[id$=-error], [role=alert], .text-danger").allTextContents()).map((s) => s.trim()).filter(Boolean).slice(0, 12),
    invalid: await page.locator("[aria-invalid=true]").count(),
    focus: await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.id ?? ""}`),
  });
  await shot(page, "flows-admin/prod-01-empty-save");
  // 2. fill
  const sku = `AUDIT-FA-${ts}`;
  await page.getByTestId("admin-product-sku").fill(sku);
  await page.getByTestId("admin-product-name").fill(`Audit disk prednji ${ts}`);
  const catSel = page.getByTestId("admin-product-category");
  const catOpts = await catSel.locator("option").evaluateAll((os) => os.map((o) => [o.value, o.textContent]));
  const disk = catOpts.find(([v, t]) => v && /disk/i.test(t)) ?? catOpts.find(([v]) => v);
  await catSel.selectOption(disk[0]);
  const manSel = page.getByTestId("admin-product-manufacturer");
  const manOpts = await manSel.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
  await manSel.selectOption(manOpts[0]);
  await page.getByTestId("admin-product-price").fill("4.990");
  // price with garbage
  await page.getByLabel("OEM broj 1", { exact: true }).fill("5q0-615-301 f");
  await sleep(400);
  const oemRow = page.getByLabel("OEM broj 1", { exact: true }).locator("xpath=..");
  step("oem preview", { row: await txt(oemRow) });
  await page.getByRole("button", { name: "Dodaj OEM broj" }).click();
  await page.getByLabel("OEM broj 2", { exact: true }).fill("5Q0 615 301F");
  await sleep(400);
  step("oem dup", { row: await txt(page.getByLabel("OEM broj 2", { exact: true }).locator("xpath=..")) });
  await shot(page, "flows-admin/prod-02-codes", { locator: page.getByLabel("OEM broj 1", { exact: true }).locator("xpath=ancestor::fieldset[1]") }).catch(() => {});
  const seo = page.getByLabel("Pregled u rezultatima pretrage");
  step("seo preview", { text: await txt(seo) });
  await page.keyboard.press("Control+s");
  await page.waitForURL(/\/admin\/proizvodi\/(?!novi)[a-z0-9]+/, { timeout: 60_000 }).catch(() => {});
  await sleep(3000);
  const id = page.url().split("/").pop();
  step("created", { url: page.url(), toasts: await page.locator("[data-sonner-toast]").allTextContents() });
  report.productId = id;
  // image upload
  const file = page.getByTestId("admin-product-image-input");
  if (await file.count()) {
    await file.setInputFiles(path.resolve("tests/fixtures/part-photo.jpg"));
    await sleep(8000);
    step("image uploaded", { imgs: await page.locator("main img").count(), toasts: await page.locator("[data-sonner-toast]").allTextContents() });
  } else step("no image input");
  await shot(page, "flows-admin/prod-03-created", { fullPage: true });

  // 3. two-tab lost update
  const b = await go(ctx, `/admin/proizvodi/${id}`);
  await page.getByTestId("admin-product-name").fill(`Audit disk prednji ${ts} (tab A)`);
  await b.getByTestId("admin-product-price").fill("5.990");
  await b.keyboard.press("Control+s");
  await sleep(5000);
  step("tab B saved price", { priceB: await b.getByTestId("admin-product-price").inputValue(), toasts: await b.locator("[data-sonner-toast]").allTextContents() });
  step("tab A sees", { priceA: await page.getByTestId("admin-product-price").inputValue() });
  await shot(page, "flows-admin/prod-04-tabA-before-save");
  await page.keyboard.press("Control+s");
  await sleep(5000);
  await b.reload({ waitUntil: "domcontentloaded" });
  await b.getByTestId("admin-product-price").waitFor();
  await sleep(3000);
  step("after tab A save", {
    priceServer: await b.getByTestId("admin-product-price").inputValue(),
    nameServer: await b.getByTestId("admin-product-name").inputValue(),
  });
  // history
  const hist = b.getByRole("tab", { name: /Cene/ });
  if (await hist.count()) {
    await hist.first().click();
    await sleep(800);
  }
  const histRegion = b.locator("section, div").filter({ hasText: "Istorija artikla" }).last();
  step("history", { text: (await txt(histRegion)).slice(0, 800) });
  await shot(b, "flows-admin/prod-05-history", { fullPage: true });
  await b.close();

  // 4. duplicate then deactivate both
  await page.getByRole("button", { name: "Dupliraj" }).click();
  await page.waitForURL((u) => !u.pathname.endsWith(id), { timeout: 60_000 }).catch(() => {});
  await sleep(3000);
  const dupId = page.url().split("/").pop();
  step("duplicate", { dupId, h1: await txt(page.locator("h1").first()), sku: await page.getByTestId("admin-product-sku").inputValue(), slug: await page.getByLabel("Adresa na sajtu (slug)").inputValue().catch(() => "") , badges: await txt(page.locator("main header, main").first()).then((t) => t.slice(0, 200)) });
  report.dupId = dupId;
  await shot(page, "flows-admin/prod-06-duplicate");
  const orig = await go(ctx, `/admin/proizvodi/${id}`);
  const deact = orig.getByRole("button", { name: "Deaktiviraj" });
  step("deactivate button", { visible: await deact.isVisible() });
  await deact.click();
  await sleep(1500);
  step("after deactivate (no confirm?)", { dialog: await orig.getByRole("alertdialog").isVisible().catch(() => false), toasts: await orig.locator("[data-sonner-toast]").allTextContents() });
  await shot(orig, "flows-admin/prod-07-deactivated");
  step("errors", log);
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 800) });
} finally {
  save(`product-${ts}.json`, report);
  await browser.close();
}
