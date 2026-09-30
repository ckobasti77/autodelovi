// Independent verification of flows-admin-01 (product editor lost update across tabs).
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, convexRun } from "./kit.mjs";

const PID = "qh7cqja340240s4jq1fsawnc3s8fctej";
const SKU = "AUDIT-FA-852021";
const OUT = "verify/flows-admin/flows-admin-01-reproduce";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { PID, SKU, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 700));
};
const server = () => convexRun("testing:productBySku", { sku: SKU });

async function login(ctx) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(120_000);
  for (let i = 0; i < 3; i++) {
    try {
      await p.goto(`${BASE}/prijava?next=%2Fadmin`, { waitUntil: "domcontentloaded", timeout: 180_000 });
      await p.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
      await p.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
      await p.getByTestId("auth-submit").click();
      await p.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 120_000 });
      break;
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  await p.close();
}
async function open(ctx) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(120_000);
  await p.goto(`${BASE}/admin/proizvodi/${PID}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await p.getByTestId("admin-product-price").waitFor();
  await sleep(2000);
  return p;
}
const saveBarText = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((e) => e.children.length === 0 && /nesačuvane|izmenjen|u međuvremenu|osvež/i.test(e.textContent ?? ""))
      .map((e) => e.textContent.trim())
      .slice(0, 5),
  );

const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-fa01", mobile: false });
  await login(ctx);
  const s0 = server();
  step("server initial", s0);

  // ---- Scenario 1 (faithful): A edits name only, B saves price, A saves.
  const A = await open(ctx);
  const B = await open(ctx);
  const logA = watch(A);
  const name0 = await A.getByTestId("admin-product-name").inputValue();
  const price0 = await A.getByTestId("admin-product-price").inputValue();
  step("S1 initial UI", { name0, price0 });
  await A.getByTestId("admin-product-name").fill(`${name0} V`);
  await sleep(500);
  step("S1 A dirty", { bar: await saveBarText(A) });
  const newPrice = "6.490,00";
  await B.getByTestId("admin-product-price").fill(newPrice);
  await B.keyboard.press("Control+s");
  await sleep(4000);
  step("S1 B saved", { toastsB: await B.locator("[data-sonner-toast]").allTextContents(), server: server() });
  await sleep(1500);
  await A.bringToFront();
  step("S1 A before save", {
    priceA: await A.getByTestId("admin-product-price").inputValue(),
    nameA: await A.getByTestId("admin-product-name").inputValue(),
    bar: await saveBarText(A),
    alerts: await A.getByRole("alert").allTextContents(),
  });
  await A.getByTestId("admin-product-price").scrollIntoViewIfNeeded();
  await shot(A, `${OUT}-s1-tabA-before-save`);
  await A.keyboard.press("Control+s");
  await sleep(4000);
  step("S1 A saved", {
    toastsA: await A.locator("[data-sonner-toast]").allTextContents(),
    priceA: await A.getByTestId("admin-product-price").inputValue(),
    server: server(),
  });

  // Audit log rows for this SKU
  const R = await ctx.newPage();
  R.setDefaultTimeout(120_000);
  await R.goto(`${BASE}/admin/revizija`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await R.getByRole("heading", { level: 1 }).first().waitFor();
  await sleep(4000);
  const rows = await R.evaluate((sku) =>
    [...document.querySelectorAll("tr, li, [role=row]")]
      .map((e) => e.textContent.replace(/\s+/g, " ").trim())
      .filter((t) => t.includes(sku))
      .slice(0, 6),
  SKU);
  step("S1 audit rows", { rows });
  const row = R.locator("tr", { hasText: SKU }).first();
  if (await row.count()) {
    await row.scrollIntoViewIfNeeded();
    await shot(R, `${OUT}-s1-audit-log`, { clip: { x: 0, y: 0, width: 1440, height: 900 } });
  }
  await R.close();
  await A.close();
  await B.close();

  // ---- Scenario 2 (variant): A edits price only, B saves name, A saves -> is B's name reverted?
  const A2 = await open(ctx);
  const B2 = await open(ctx);
  const nameBefore2 = await A2.getByTestId("admin-product-name").inputValue();
  const priceBefore2 = await A2.getByTestId("admin-product-price").inputValue();
  step("S2 initial UI", { nameBefore2, priceBefore2 });
  await A2.getByTestId("admin-product-price").fill("5.990,00");
  await B2.getByTestId("admin-product-name").fill(`${nameBefore2} B2`);
  await B2.keyboard.press("Control+s");
  await sleep(4000);
  step("S2 B saved name", { server: server() });
  await sleep(1500);
  await A2.bringToFront();
  step("S2 A before save", {
    nameA: await A2.getByTestId("admin-product-name").inputValue(),
    bar: await saveBarText(A2),
  });
  await A2.getByTestId("admin-product-name").scrollIntoViewIfNeeded();
  await shot(A2, `${OUT}-s2-tabA-stale-name`);
  await A2.keyboard.press("Control+s");
  await sleep(4000);
  step("S2 A saved", { toastsA: await A2.locator("[data-sonner-toast]").allTextContents(), server: server() });
  step("console/page errors A", logA);

  // ---- Restore to the state found at start.
  await A2.getByTestId("admin-product-name").fill(s0.name);
  await A2.getByTestId("admin-product-price").fill(
    (s0.retailPricePara / 100).toLocaleString("sr-Latn-RS", { minimumFractionDigits: 2 }),
  );
  await A2.keyboard.press("Control+s");
  await sleep(4000);
  step("restored", { server: server() });
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 800) });
} finally {
  mkdirSync("docs/qa/audit/verify/flows-admin", { recursive: true });
  writeFileSync(`docs/qa/audit/${OUT}.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
