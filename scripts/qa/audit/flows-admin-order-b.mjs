// flows-admin: order B (ceka_deo → potvrdjena → otkazana with reason; stock back), order D (cancel
// from nova), order C (two tabs: concurrency). Usage: node flows-admin-order-b.mjs B D C
import { launch, watch, shot, convexRun } from "./kit.mjs";
import { ownerContext, open, save, sleep } from "./flows-admin-lib.mjs";

const [B, D, C] = process.argv.slice(2);
const browser = await launch();
const report = { B, D, C, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, ...data });
  console.log(name, JSON.stringify(data).slice(0, 400));
};
const rows = async (page) =>
  (await page.locator("table").first().locator("tbody tr").allTextContents()).map((t) => t.replace(/\s+/g, " "));
const statusChip = async (page) => (await page.locator("h1").first().locator("xpath=..").textContent())?.replace(/\s+/g, " ");

async function viaMenu(page, verb) {
  await page.getByRole("button", { name: "Promeni status" }).click();
  await page.getByRole("menuitem", { name: verb }).click();
  await page.getByRole("alertdialog").waitFor();
}
async function confirm(page) {
  await page.getByTestId("admin-order-transition-confirm").click();
  await page.getByRole("alertdialog").waitFor({ state: "hidden", timeout: 60_000 });
  await sleep(2500);
}

try {
  const ctx = await ownerContext(browser, { tag: "fa-ob" });
  // ---------- B
  if (B) {
    const tag = B.slice(-3);
    const page = await open(ctx, `/admin/porudzbine/${B}`);
    const log = watch(page);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await sleep(1500);
    step("B open", { rows: await rows(page) });
    await page.getByRole("button", { name: "Promeni status" }).click();
    step("B menu items", { items: await page.getByRole("menuitem").allTextContents() });
    await shot(page, `flows-admin/order-${tag}-01-menu`);
    await page.keyboard.press("Escape");
    await viaMenu(page, "Čeka deo");
    step("B ceka_deo dialog", { text: (await page.getByRole("alertdialog").textContent())?.replace(/\s+/g, " ") });
    await confirm(page);
    step("B after ceka_deo", { head: await statusChip(page), rows: await rows(page) });
    await page.getByTestId("admin-order-transition-potvrdjena").click();
    await page.getByRole("alertdialog").waitFor();
    await confirm(page);
    const afterConfirm = await rows(page);
    step("B after potvrdjena", { head: await statusChip(page), rows: afterConfirm });
    await viaMenu(page, "Otkaži porudžbinu");
    const dlg = page.getByRole("alertdialog");
    const btn = page.getByTestId("admin-order-transition-confirm");
    step("B cancel dialog", { text: (await dlg.textContent())?.replace(/\s+/g, " "), disabledEmpty: await btn.isDisabled(), focused: await page.evaluate(() => document.activeElement?.tagName + " " + (document.activeElement?.textContent ?? "").slice(0, 30)) });
    await dlg.getByRole("textbox").fill("ab");
    step("B cancel 2 chars", { disabled: await btn.isDisabled(), hint: (await dlg.textContent())?.replace(/\s+/g, " ") });
    await shot(page, `flows-admin/order-${tag}-02-cancel-short-reason`);
    // Escape while typing: does the dialog close and lose the reason?
    await dlg.getByRole("textbox").fill("Kupac odustao, audit flows-admin.");
    await shot(page, `flows-admin/order-${tag}-03-cancel-dialog`);
    await confirm(page);
    step("B after otkazana", { head: await statusChip(page), rows: await rows(page), buttons: (await page.locator("main button").allTextContents()).slice(0, 12) });
    await shot(page, `flows-admin/order-${tag}-04-otkazana`, { fullPage: true });
    step("B errors", log);
    report.Bprobe = convexRun("testing:orderProbe", { number: B });
    report.Bemails = convexRun("testing:emailProbe", { number: B }).map((e) => e.templateKey);
    step("B probe", { p: report.Bprobe, e: report.Bemails });
    await page.close();
  }
  // ---------- D
  if (D) {
    const tag = D.slice(-3);
    const page = await open(ctx, `/admin/porudzbine/${D}`);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await sleep(1500);
    await viaMenu(page, "Otkaži porudžbinu");
    step("D cancel dialog from nova", { text: (await page.getByRole("alertdialog").textContent())?.replace(/\s+/g, " ") });
    // Escape with a typed reason
    await page.getByRole("alertdialog").getByRole("textbox").fill("Test razlog");
    await page.keyboard.press("Escape");
    await sleep(500);
    step("D after Escape", { dialogOpen: await page.getByRole("alertdialog").isVisible().catch(() => false) });
    await viaMenu(page, "Otkaži porudžbinu");
    step("D reason kept after reopen", { value: await page.getByRole("alertdialog").getByRole("textbox").inputValue() });
    await page.getByRole("alertdialog").getByRole("textbox").fill("Duplikat porudžbine (audit).");
    await confirm(page);
    // mark paid on a cancelled order?
    const paidBtn = page.getByRole("button", { name: "Označi kao plaćeno" });
    step("D cancelled: pay button visible", { visible: await paidBtn.isVisible().catch(() => false), noteVisible: await page.getByRole("button", { name: "Dodaj napomenu" }).isVisible().catch(() => false), edit: await page.getByRole("button", { name: "Izmeni stavke" }).isVisible().catch(() => false) });
    await shot(page, `flows-admin/order-${tag}-01-otkazana`, { fullPage: true });
    await page.close();
  }
  // ---------- C (two tabs)
  if (C) {
    const tag = C.slice(-3);
    const p1 = await open(ctx, `/admin/porudzbine/${C}`);
    const p2 = await open(ctx, `/admin/porudzbine/${C}`);
    const l2 = watch(p2);
    await p1.getByRole("heading", { level: 1 }).waitFor();
    await p2.getByRole("heading", { level: 1 }).waitFor();
    await sleep(1500);
    // tab 2 opens "Izmeni stavke" and the confirm dialog is prepared later
    await p2.getByRole("button", { name: "Izmeni stavke" }).click();
    await p2.getByLabel(/^Količina, /).first().fill("3");
    // tab 1 confirms
    await p1.getByTestId("admin-order-transition-potvrdjena").click();
    await p1.getByRole("alertdialog").waitFor();
    await confirm(p1);
    await sleep(4000);
    step("C tab2 after tab1 confirm (editing open)", { head: await statusChip(p2), saveVisible: await p2.getByRole("button", { name: "Sačuvaj stavke" }).isVisible().catch(() => false), inputs: await p2.getByLabel(/^Količina, /).count() });
    await shot(p2, `flows-admin/order-${tag}-01-tab2-stale-edit`);
    if (await p2.getByRole("button", { name: "Sačuvaj stavke" }).isVisible().catch(() => false)) {
      await p2.getByRole("button", { name: "Sačuvaj stavke" }).click();
      await sleep(4000);
      step("C tab2 save after confirm", { alerts: await p2.getByRole("alert").allTextContents(), toasts: await p2.locator("[role=status]").allTextContents() });
      await shot(p2, `flows-admin/order-${tag}-02-tab2-save-result`);
    }
    // tab 2: open ship dialog, tab 1 cancels meanwhile, tab 2 submits
    await p2.reload({ waitUntil: "domcontentloaded" });
    await p2.getByRole("heading", { level: 1 }).waitFor();
    await sleep(2000);
    await p2.getByTestId("admin-order-transition-poslata").click();
    await p2.getByTestId("admin-order-tracking-input").fill("RS000111222SR");
    await viaMenu(p1, "Otkaži porudžbinu");
    await p1.getByRole("alertdialog").getByRole("textbox").fill("Konkurentni test (audit).");
    await confirm(p1);
    await sleep(4000);
    step("C tab2 dialog still open after cancel in tab1", { open: await p2.getByRole("alertdialog").isVisible().catch(() => false), head: await statusChip(p2) });
    await shot(p2, `flows-admin/order-${tag}-03-tab2-dialog-stale`);
    await p2.getByTestId("admin-order-transition-confirm").click().catch((e) => step("C tab2 click failed", { e: String(e).slice(0, 200) }));
    await sleep(4000);
    step("C tab2 submit result", { alerts: await p2.getByRole("alert").allTextContents(), head: await statusChip(p2) });
    await shot(p2, `flows-admin/order-${tag}-04-tab2-submit-result`);
    step("C tab2 errors", l2);
    report.Cprobe = convexRun("testing:orderProbe", { number: C });
    step("C probe", report.Cprobe);
  }
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 600) });
} finally {
  save(`orders-bdc.json`, report);
  await browser.close();
}
