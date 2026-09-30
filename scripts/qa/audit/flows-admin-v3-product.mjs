// flows-admin v3: product lost-update re-check (two tabs), history section, empty-save focus.
import { launch, watch, shot, convexRun } from "./kit.mjs";
import { save, sleep } from "./flows-admin-lib.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";

const PID = "qh7cqja340240s4jq1fsawnc3s8fctej";
const browser = await launch();
const report = { PID, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 600));
};
try {
  const ctx = await ownerCtx(browser, { tag: "fa3-prod" });
  const A = await go(ctx, `/admin/proizvodi/${PID}`);
  const B = await go(ctx, `/admin/proizvodi/${PID}`);
  const log = watch(A);
  await A.getByTestId("admin-product-price").waitFor();
  await B.getByTestId("admin-product-price").waitFor();
  const p0 = await A.getByTestId("admin-product-price").inputValue();
  const n0 = await A.getByTestId("admin-product-name").inputValue();
  step("initial", { price: p0, name: n0 });
  // Tab A: edit only the name (dirty, not saved)
  await A.getByTestId("admin-product-name").fill(n0.replace(/ \(v3.*\)$/, "") + " (v3)");
  // Tab B: change the price and save with Ctrl+S
  const newPrice = p0.startsWith("6") ? "5.990,00" : "6.490,00";
  await B.getByTestId("admin-product-price").fill(newPrice);
  await B.keyboard.press("Control+s");
  await sleep(3500);
  step("tab B saved", {
    priceB: await B.getByTestId("admin-product-price").inputValue(),
    toastsB: await B.locator("[data-sonner-toast]").allTextContents(),
    server: convexRun("testing:productBySku", { sku: "AUDIT-FA-852021" }),
  });
  await sleep(1500);
  step("tab A before save", {
    priceA: await A.getByTestId("admin-product-price").inputValue(),
    warning: await A.getByRole("alert").allTextContents(),
    status: await A.locator("[role=status]").allTextContents(),
  });
  await A.getByTestId("admin-product-price").scrollIntoViewIfNeeded();
  await shot(A, "flows-admin/v3-prod-01-tabA-stale-price");
  await A.keyboard.press("Control+s");
  await sleep(3500);
  step("after tab A save", {
    toastsA: await A.locator("[data-sonner-toast]").allTextContents(),
    priceA: await A.getByTestId("admin-product-price").inputValue(),
    server: convexRun("testing:productBySku", { sku: "AUDIT-FA-852021" }),
  });
  // History section
  const hist = A.locator("#istorija");
  await hist.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(2000);
  step("history", { text: ((await hist.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").slice(0, 1200) });
  await shot(A, "flows-admin/v3-prod-02-history", { locator: hist }).catch(() => {});
  // Restore name
  await A.getByTestId("admin-product-name").fill(n0);
  await A.keyboard.press("Control+s");
  await sleep(2500);
  step("errors", log);
  // Empty-save focus on new product
  const N = await go(ctx, `/admin/proizvodi/novi`);
  await N.getByTestId("admin-product-name").waitFor();
  const saveBtn = N.getByRole("button", { name: /Sačuvaj|Napravi/ }).first();
  step("new save button", { label: await saveBtn.textContent() });
  await saveBtn.click();
  await sleep(1200);
  step("empty save", {
    focus: await N.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.getAttribute("data-testid") ?? ""} ${document.activeElement?.getAttribute("aria-label") ?? ""}`),
    toasts: await N.locator("[data-sonner-toast]").allTextContents(),
    invalid: await N.locator("[aria-invalid=true]").count(),
    describedBy: await N.getByTestId("admin-product-name").getAttribute("aria-describedby"),
  });
  await shot(N, "flows-admin/v3-prod-03-empty-save");
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 800) });
} finally {
  save("v3-product.json", report);
  await browser.close();
}
