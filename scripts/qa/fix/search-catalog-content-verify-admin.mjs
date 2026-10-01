// Independent re-verification of FLOW-02 (product editor lost update) on the audit fixture
// AUDIT-FA-852021 (inactive). Scenarios:
//  S1 audit reproduction: two tabs, A edits the name, B saves a new price, A saves.
//  S2 skeptic variant: two separate owner sessions, B saves „Interna beleška“, A (dirty name) saves.
//  S3 both edit the price: A must see the conflict notice; A's explicit value wins on save.
//  S4 own save: no spurious notice, save bar gone; „Odbaci izmene“ clears the notice.
// Restores name, price and internal note at the end.
// AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/search-catalog-content-verify-admin.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

import sharp from "sharp";

import { BASE, convexRun, launch, watch } from "../audit/kit.mjs";
import { go, ownerCtx } from "../audit/flows-admin-lib2.mjs";

const PID = "qh7cqja340240s4jq1fsawnc3s8fctej";
const SKU = "AUDIT-FA-852021";
const OUT = "docs/qa/fix/search-catalog-content/verify";
fs.mkdirSync(OUT, { recursive: true });
const report = { base: BASE, PID, SKU, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 700));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = () => convexRun("testing:productBySku", { sku: SKU });
const snap = async (page, name, locator) => {
  const buf = locator
    ? await locator.screenshot({ type: "png" })
    : await page.screenshot({ type: "png" });
  await sharp(buf).webp({ quality: 75 }).toFile(`${OUT}/${name}.webp`);
  return `${OUT}/${name}.webp`;
};
/** Audit log rows for this product, newest first (convex data CLI, jsonl). */
const auditRows = (n = 40) => {
  const out = execFileSync(
    process.execPath,
    [
      path.resolve("node_modules/convex/bin/main.js"),
      "data",
      "auditLog",
      "--limit",
      String(n),
      "--order",
      "desc",
      "--format",
      "jsonl",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
  return out
    .split("\n")
    .filter((l) => l.trim().startsWith("{"))
    .map((l) => JSON.parse(l))
    .filter((r) => r.entityId === PID)
    .map((r) => ({ at: r.at, summary: r.summary, fields: (r.diff ?? []).map((d) => d.field) }));
};
const field = (p, id) => p.getByTestId(id);
const note = (p) => p.getByLabel("Interna beleška");
const ui = async (p) => ({
  name: await field(p, "admin-product-name").inputValue(),
  price: await field(p, "admin-product-price").inputValue(),
  note: await note(p).inputValue(),
  notice: await p
    .getByTestId("admin-product-rebased")
    .textContent({ timeout: 1500 })
    .catch(() => null),
  saveBar: await p
    .getByText("Imate nesačuvane izmene.")
    .isVisible()
    .catch(() => false),
  toasts: await p.locator("[data-sonner-toast]").allTextContents(),
});
const save = async (p) => {
  await p.keyboard.press("Control+s");
  await sleep(3500);
};

const browser = await launch();
let A, B, A2, restore;
try {
  const ctx1 = await ownerCtx(browser, { tag: "vfy-scc-1" });
  const ctx2 = await ownerCtx(browser, { tag: "vfy-scc-2" });
  A = await go(ctx1, `/admin/proizvodi/${PID}`);
  B = await go(ctx1, `/admin/proizvodi/${PID}`);
  const logA = watch(A);
  await field(A, "admin-product-price").waitFor();
  await field(B, "admin-product-price").waitFor();
  const s0 = await ui(A);
  restore = { name: s0.name, price: s0.price, note: s0.note };
  step("start", { ui: s0, server: server() });

  // S1 — audit reproduction (two tabs, one session).
  const nameA = `${s0.name.replace(/ \[vfy.*\]$/, "")} [vfy-s1]`;
  await field(A, "admin-product-name").fill(nameA);
  const priceB = s0.price.startsWith("6") ? "5.990,00" : "6.490,00";
  await field(B, "admin-product-price").fill(priceB);
  await save(B);
  await sleep(1500);
  step("S1 tab B saved price", { server: server(), tabA: await ui(A) });
  await field(A, "admin-product-price").scrollIntoViewIfNeeded();
  await snap(A, "admin-s1-tabA-after-B-saved");
  await A.getByTestId("admin-product-rebased")
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await snap(A, "admin-s1-notice", A.getByTestId("admin-product-rebased")).catch(() => null);
  await save(A);
  step("S1 tab A saved", { server: server(), tabA: await ui(A), audit: auditRows().slice(0, 3) });

  // S2 — two separate sessions, B saves the internal note while A has an unsaved name edit.
  A2 = await go(ctx2, `/admin/proizvodi/${PID}`);
  await field(A2, "admin-product-name").waitFor();
  await B.reload({ waitUntil: "domcontentloaded" });
  await field(B, "admin-product-name").waitFor();
  await sleep(2000);
  await field(A2, "admin-product-name").fill(`${s0.name} [vfy-s2]`);
  const noteText = `vfy-s2 beleška ${Date.now()}`;
  await note(B).fill(noteText);
  await save(B);
  await sleep(1500);
  step("S2 session B saved note", { tabA2: await ui(A2) });
  await save(A2);
  const fresh = await go(ctx1, `/admin/proizvodi/${PID}`);
  await field(fresh, "admin-product-name").waitFor();
  step("S2 session A saved", {
    server: server(),
    freshLoad: await ui(fresh),
    noteKept: (await note(fresh).inputValue()) === noteText,
    audit: auditRows().slice(0, 3),
  });
  await fresh.close();

  // S3 — both change the price: conflict notice, explicit value of the saver wins.
  await B.reload({ waitUntil: "domcontentloaded" });
  await field(B, "admin-product-price").waitFor();
  await A2.reload({ waitUntil: "domcontentloaded" });
  await field(A2, "admin-product-price").waitFor();
  await sleep(2000);
  await field(A2, "admin-product-price").fill("7.111,00");
  await field(B, "admin-product-price").fill("7.222,00");
  await save(B);
  await sleep(1500);
  step("S3 B saved 7222, A2 has 7111 unsaved", { server: server(), tabA2: await ui(A2) });
  await A2.getByTestId("admin-product-rebased")
    .scrollIntoViewIfNeeded()
    .catch(() => {});
  await snap(A2, "admin-s3-conflict-notice", A2.getByTestId("admin-product-rebased")).catch(
    () => null,
  );
  await save(A2);
  step("S3 A2 saved", { server: server(), tabA2: await ui(A2), audit: auditRows().slice(0, 2) });

  // S4 — own save shows no notice; discard clears a notice.
  await field(B, "admin-product-name").fill(`${s0.name} [vfy-s4]`);
  await save(B);
  step("S4 own save (B)", { tabB: await ui(B), server: server() });
  await field(A2, "admin-product-name").fill(`${s0.name} [vfy-s4-dirty]`);
  await field(B, "admin-product-price").fill("7.333,00");
  await save(B);
  await sleep(1500);
  const beforeDiscard = await ui(A2);
  await A2.getByRole("button", { name: "Odbaci izmene" }).click();
  await sleep(800);
  step("S4 discard in A2", { beforeDiscard, afterDiscard: await ui(A2) });
  step("console A", logA);
  await ctx2.close();
  await ctx1.close();
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 1200) });
} finally {
  if (restore) {
    try {
      const ctx = await ownerCtx(browser, { tag: "vfy-scc-restore" });
      const R = await go(ctx, `/admin/proizvodi/${PID}`);
      await field(R, "admin-product-name").waitFor();
      await field(R, "admin-product-name").fill(restore.name);
      await field(R, "admin-product-price").fill(restore.price);
      await note(R).fill(restore.note);
      await save(R);
      step("restored", { server: server(), ui: await ui(R) });
      await ctx.close();
    } catch (e) {
      step("RESTORE FAILED", { error: String(e).slice(0, 600) });
    }
  }
  await browser.close();
  fs.writeFileSync(`${OUT}/admin.json`, JSON.stringify(report, null, 2));
}
