// Independent verification of flows-admin-01 on an isolated fixture product (no other agent edits it).
// S1 faithful: A edits name, B saves price, A saves. S2 reversed: A edits price, B saves name.
// S3: A edits name, B runs bulk "Promeni cene %" (+10 %) from the list, A saves.
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, convexRun } from "./kit.mjs";

const OUT = "verify/flows-admin/flows-admin-01-reproduce";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ts = Date.now().toString().slice(-6);
const SKU = `VERIFY-FA01-${ts}`;
const report = { SKU, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 700));
};
const server = () => convexRun("testing:productBySku", { sku: SKU });
const toasts = (p) => p.locator("[data-sonner-toast]").allTextContents();
const notices = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => e.children.length === 0 && /nesačuvane|izmenjen|u međuvremenu|osvež|drugde/i.test(e.textContent ?? ""))
      .map((e) => e.textContent.trim())
      .slice(0, 5),
  );

async function page(ctx, route) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(120_000);
  await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180_000 });
  return p;
}
async function editor(ctx, id) {
  const p = await page(ctx, `/admin/proizvodi/${id}`);
  await p.getByTestId("admin-product-price").waitFor();
  await sleep(2000);
  return p;
}

const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-fa01b", mobile: false });
  const L = await page(ctx, "/prijava?next=%2Fadmin");
  await L.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
  await L.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
  await L.getByTestId("auth-submit").click();
  await L.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 120_000 });
  await L.close();

  // Create an inactive fixture product through the UI.
  const N = await page(ctx, "/admin/proizvodi/novi");
  await N.getByTestId("admin-product-sku").waitFor();
  await N.getByTestId("admin-product-sku").fill(SKU);
  await N.getByTestId("admin-product-name").fill(`Verify disk ${ts}`);
  const cat = N.getByTestId("admin-product-category");
  await N.waitForFunction(
    () =>
      document.querySelectorAll("[data-testid=admin-product-category] option").length > 2 &&
      document.querySelectorAll("[data-testid=admin-product-manufacturer] option").length > 2,
    null,
    { timeout: 60_000 },
  );
  const catOpts = await cat.locator("option").evaluateAll((os) => os.map((o) => [o.value, o.textContent]));
  await cat.selectOption((catOpts.find(([v, t]) => v && /disk/i.test(t)) ?? catOpts.find(([v]) => v))[0]);
  const man = N.getByTestId("admin-product-manufacturer");
  const manOpts = await man.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean));
  await man.selectOption(manOpts[0]);
  await N.getByTestId("admin-product-price").fill("4.990");
  const sw = N.getByRole("switch", { name: /Aktivan/ });
  if ((await sw.getAttribute("aria-checked")) === "true") await sw.click();
  step("new form active", { ariaChecked: await sw.getAttribute("aria-checked") });
  await N.keyboard.press("Control+s");
  await N.waitForURL(/\/admin\/proizvodi\/(?!novi)[a-z0-9]+/, { timeout: 60_000 });
  await sleep(2000);
  const id = N.url().split("/").pop();
  report.productId = id;
  step("created", { id, server: server() });
  await N.close();

  // ---- S1 faithful
  const A = await editor(ctx, id);
  const B = await editor(ctx, id);
  const logA = watch(A);
  await A.getByTestId("admin-product-name").fill(`Verify disk ${ts} A`);
  await B.getByTestId("admin-product-price").fill("6.490,00");
  await B.keyboard.press("Control+s");
  await sleep(4000);
  step("S1 B saved price", { toastsB: await toasts(B), server: server() });
  await sleep(1000);
  await A.bringToFront();
  step("S1 A before save", {
    priceA: await A.getByTestId("admin-product-price").inputValue(),
    notices: await notices(A),
  });
  await A.getByTestId("admin-product-price").scrollIntoViewIfNeeded();
  await shot(A, `${OUT}-s1-tabA-before-save`);
  await A.keyboard.press("Control+s");
  await sleep(4000);
  step("S1 A saved", { toastsA: await toasts(A), server: server() });
  await B.close();

  // ---- S2 reversed: A (now clean, synced) edits price; B2 saves name.
  const B2 = await editor(ctx, id);
  await A.getByTestId("admin-product-price").fill("5.990,00");
  await B2.getByTestId("admin-product-name").fill(`Verify disk ${ts} B2`);
  await B2.keyboard.press("Control+s");
  await sleep(4000);
  step("S2 B2 saved name", { server: server() });
  await sleep(1000);
  await A.bringToFront();
  step("S2 A before save", { nameA: await A.getByTestId("admin-product-name").inputValue(), notices: await notices(A) });
  await A.getByTestId("admin-product-name").scrollIntoViewIfNeeded();
  await shot(A, `${OUT}-s2-tabA-stale-name`);
  await A.keyboard.press("Control+s");
  await sleep(4000);
  step("S2 A saved", { toastsA: await toasts(A), server: server() });
  await B2.close();

  // ---- S3 bulk price +10 % from the list while A has an unsaved name edit.
  await A.getByTestId("admin-product-name").fill(`Verify disk ${ts} S3`);
  const Lst = await page(ctx, `/admin/proizvodi?q=${SKU}&status=neaktivni`);
  const row = Lst.locator("tr", { hasText: SKU }).first();
  await row.waitFor({ timeout: 60_000 });
  await row.getByRole("checkbox").first().check();
  await Lst.getByRole("button", { name: "Promeni cene %" }).click();
  await Lst.getByPlaceholder("npr. 5 ili -10").fill("10");
  await Lst.getByRole("button", { name: "Promeni cene", exact: true }).click();
  await sleep(4000);
  step("S3 bulk +10% done", { toastsL: await toasts(Lst), server: server() });
  await sleep(1000);
  await A.bringToFront();
  step("S3 A before save", { priceA: await A.getByTestId("admin-product-price").inputValue(), notices: await notices(A) });
  await A.getByTestId("admin-product-price").scrollIntoViewIfNeeded();
  await shot(A, `${OUT}-s3-tabA-after-bulk`);
  await A.keyboard.press("Control+s");
  await sleep(4000);
  step("S3 A saved", { toastsA: await toasts(A), server: server() });

  // History of this fixture
  await Lst.close();
  const H = await editor(ctx, id);
  const hist = H.locator("#istorija");
  await hist.scrollIntoViewIfNeeded().catch(() => {});
  await sleep(3000);
  const priceTab = H.getByRole("tab", { name: /Cene/ });
  step("history all", { text: ((await hist.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").slice(0, 1500) });
  await shot(H, `${OUT}-history`, { locator: hist }).catch(() => {});
  if (await priceTab.count()) {
    await priceTab.click();
    await sleep(1500);
    step("history prices", { text: ((await hist.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").slice(0, 1500) });
    await shot(H, `${OUT}-history-prices`, { locator: hist }).catch(() => {});
  }
  step("errors A", logA);
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 800) });
} finally {
  mkdirSync("docs/qa/audit/verify/flows-admin", { recursive: true });
  writeFileSync(`docs/qa/audit/${OUT}.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
