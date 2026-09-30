// Verifier (skeptic) for flows-admin-01: lost update in the product editor.
// Two SEPARATE browser contexts (two sessions, like two staff members), not two tabs of one context.
// Runs on a private inactive copy (Dupliraj) so no other reviewer edits the same product meanwhile.
// Variant 1: A edits name (unsaved), B saves a new price, A saves -> is B's price reverted?
// Variant 2: A edits name (unsaved), B saves an internal note, A saves -> is B's note cleared?
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, shot, convexRun } from "./kit.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";

const SRC = "qh7cqja340240s4jq1fsawnc3s8fctej";
const SKU = `VFY-SKEPTIC-FA01-${Date.now() % 1000000}`;
let PID = "";
const OUT = "docs/qa/audit/verify/flows-admin";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { SRC, SKU, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 500));
};
const probe = () => {
  for (let i = 0; i < 2; i++) {
    try {
      return convexRun("testing:productBySku", { sku: SKU });
    } catch (e) {
      if (i === 1) return { error: String(e).slice(0, 200) };
    }
  }
};

const browser = await launch();
try {
  const ctxA = await ownerCtx(browser, { tag: "vfy-fa01-A" });
  const ctxB = await ownerCtx(browser, { tag: "vfy-fa01-B" });

  // Private copy
  const S = await go(ctxB, `/admin/proizvodi/${SRC}`);
  await S.getByRole("button", { name: "Dupliraj" }).click();
  await S.waitForURL((u) => /\/admin\/proizvodi\/[a-z0-9]{20,}$/.test(u.pathname) && !u.pathname.endsWith(SRC), {
    timeout: 120_000,
  });
  PID = new URL(S.url()).pathname.split("/").pop();
  await S.getByTestId("admin-product-sku").waitFor();
  await sleep(3000);
  await S.getByTestId("admin-product-sku").fill(SKU);
  await S.getByTestId("admin-product-name").fill("Verifikacija skeptik FA01");
  await S.getByTestId("admin-product-price").fill("4990");
  await S.keyboard.press("Control+s");
  await sleep(4000);
  report.PID = PID;
  step("private copy", { PID, SKU, server: probe() });
  await S.close();

  const A = await go(ctxA, `/admin/proizvodi/${PID}`);
  const B = await go(ctxB, `/admin/proizvodi/${PID}`);
  for (const p of [A, B]) await p.getByTestId("admin-product-price").waitFor();
  const name0 = await A.getByTestId("admin-product-name").inputValue();
  const price0 = await A.getByTestId("admin-product-price").inputValue();
  const note0 = await A.getByLabel("Interna beleška").inputValue();
  step("initial", { name0, price0, note0, server: probe() });

  // ---------- Variant 1: price ----------
  await A.getByTestId("admin-product-name").fill(`${name0} (A)`);
  await sleep(500);
  step("v1 A dirty", { saveBar: await A.getByText("Imate nesačuvane izmene.").isVisible().catch(() => false) });
  await B.getByTestId("admin-product-price").fill("6.490,00");
  await B.keyboard.press("Control+s");
  await sleep(4000);
  step("v1 B saved price", { server: probe() });
  await sleep(1500);
  step("v1 A before save", {
    priceAshown: await A.getByTestId("admin-product-price").inputValue(),
    nameA: await A.getByTestId("admin-product-name").inputValue(),
    alerts: (await A.getByRole("alert").allTextContents()).filter((t) => t.trim()),
    statuses: (await A.locator("[role=status]").allTextContents()).filter((t) => t.trim()),
  });
  await A.getByTestId("admin-product-price").scrollIntoViewIfNeeded();
  await shot(A, "verify/flows-admin/flows-admin-01-skeptic-v1-tabA-stale");
  await A.keyboard.press("Control+s");
  await sleep(4000);
  step("v1 A saved", {
    priceAshown: await A.getByTestId("admin-product-price").inputValue(),
    server: probe(),
  });
  await sleep(1500);
  step("v1 B after A save", { priceBshown: await B.getByTestId("admin-product-price").inputValue() });
  await B.getByTestId("admin-product-price").scrollIntoViewIfNeeded();
  await shot(B, "verify/flows-admin/flows-admin-01-skeptic-v1-tabB-reverted");

  // ---------- Variant 2: a non-price field (internal note) ----------
  await sleep(1500);
  await A.getByTestId("admin-product-name").fill(`${name0} (A2)`);
  const note = `skeptic note ${Date.now()}`;
  await B.getByLabel("Interna beleška").fill(note);
  await B.keyboard.press("Control+s");
  await sleep(4000);
  step("v2 B saved note", { noteBshown: await B.getByLabel("Interna beleška").inputValue() });
  await sleep(1500);
  step("v2 A before save", { noteAshown: await A.getByLabel("Interna beleška").inputValue() });
  await A.keyboard.press("Control+s");
  await sleep(4000);
  step("v2 A saved", { noteAshown: await A.getByLabel("Interna beleška").inputValue(), server: probe() });
  const C = await go(ctxB, `/admin/proizvodi/${PID}`);
  await C.getByTestId("admin-product-price").waitFor();
  step("v2 fresh load", {
    name: await C.getByTestId("admin-product-name").inputValue(),
    price: await C.getByTestId("admin-product-price").inputValue(),
    note: await C.getByLabel("Interna beleška").inputValue(),
  });
  await C.getByLabel("Interna beleška").scrollIntoViewIfNeeded();
  await shot(C, "verify/flows-admin/flows-admin-01-skeptic-v2-fresh-note-cleared");

  const R = await go(ctxB, `/admin/revizija`, { wait: 4000 });
  const rows = (await R.locator("tr, li").allTextContents())
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t.includes(SKU))
    .slice(0, 8);
  step("audit rows", { rows });
  await shot(R, "verify/flows-admin/flows-admin-01-skeptic-audit");
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 800) });
} finally {
  writeFileSync(`${OUT}/flows-admin-01-skeptic.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
