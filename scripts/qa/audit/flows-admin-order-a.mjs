// flows-admin: order A — edit lines (qty + catalogue line), notes, confirm (stock), ship with
// tracking, deliver, complete. Usage: node flows-admin-order-a.mjs SK-2026-000112
import { launch, watch, shot, convexRun } from "./kit.mjs";
import { ownerContext, open, save, sleep } from "./flows-admin-lib.mjs";

const number = process.argv[2];
const tag = number.slice(-3);
const browser = await launch();
const report = { number, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 300));
};
try {
  const ctx = await ownerContext(browser, { tag: "fa-oa" });
  const page = await open(ctx, `/admin/porudzbine/${number}`);
  const log = watch(page);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await sleep(1500);
  const stockText = async () =>
    (await page.locator("table").first().locator("tbody tr").allTextContents()).map((t) => t.replace(/\s+/g, " "));
  step("open", { rows: await stockText() });
  await shot(page, `flows-admin/order-${tag}-01-nova`, { fullPage: true });

  // --- edit lines
  if (process.argv[3] !== "noedit") {
  await page.getByRole("button", { name: "Izmeni stavke" }).click();
  const qty = page.getByLabel(/^Količina, /).first();
  await qty.fill("2");
  const picker = page.getByRole("combobox", { name: "Dodaj artikal iz kataloga" });
  const opts = page.getByRole("option");
  for (const q of ["disk", "Kočioni", "5Q0615301F", "DEMO-0005"]) {
    await picker.fill(q);
    await opts.first().waitFor({ timeout: 30_000 }).catch(() => {});
    const lb = (await page.getByRole("listbox", { name: "Artikli" }).textContent().catch(() => ""))?.slice(0, 200);
    step(`picker ${q}`, { count: await opts.count(), listbox: lb });
    if (q === "disk") await shot(page, `flows-admin/order-${tag}-02a-picker-disk`);
    if ((await opts.count()) > 0 && q !== "disk") break;
  }
  step("picker options", { count: await opts.count(), first: (await opts.first().textContent().catch(() => ""))?.slice(0, 120) });
  await shot(page, `flows-admin/order-${tag}-02-edit-picker`);
  await opts.first().click();
  await sleep(500);
  await shot(page, `flows-admin/order-${tag}-03-edit-added`);
  // invalid qty first
  const addQty = page.getByLabel(/^Količina, /).nth(1);
  await addQty.fill("0");
  await page.getByRole("button", { name: "Sačuvaj stavke" }).click();
  await sleep(800);
  step("invalid qty error", { alert: await page.getByRole("alert").allTextContents() });
  await addQty.fill("1");
  await page.getByRole("button", { name: "Sačuvaj stavke" }).click();
  await page.getByText("Stavke su izmenjene").first().waitFor({ timeout: 60_000 }).catch(() => {});
  await sleep(2000);
  step("after edit", { rows: await stockText() });
  await shot(page, `flows-admin/order-${tag}-04-edited`, { fullPage: true });
  }

  // --- notes: one internal, one visible
  const note = page.getByLabel("Nova napomena");
  step("empty note submit", { disabled: await page.getByRole("button", { name: "Dodaj napomenu" }).isDisabled() });
  await note.fill(`Interna beleška audit ${tag}: kupac zvao, proveriti adresu.`);
  await page.getByRole("button", { name: "Dodaj napomenu" }).click();
  await page.getByText("Napomena je dodata").first().waitFor({ timeout: 60_000 }).catch(() => {});
  await note.fill(`Za kupca: paket šaljemo sutra ujutru (${tag}).`);
  await page.getByLabel("Vidljivo kupcu na stranici porudžbine").check();
  await page.getByRole("button", { name: "Dodaj napomenu" }).click();
  await page.getByText("Napomena je dodata").first().waitFor({ timeout: 60_000 }).catch(() => {});
  await sleep(1500);

  // --- confirm
  const before = await stockText();
  await page.getByRole("button", { name: /^Potvrdi/ }).first().click();
  const dlg = page.getByRole("alertdialog");
  await dlg.waitFor();
  step("confirm dialog", { text: (await dlg.textContent())?.replace(/\s+/g, " ") });
  await shot(page, `flows-admin/order-${tag}-05-confirm-dialog`);
  await page.getByTestId("admin-order-transition-confirm").click();
  await dlg.waitFor({ state: "hidden", timeout: 60_000 });
  await sleep(2500);
  step("after confirm", { before, after: await stockText() });
  await shot(page, `flows-admin/order-${tag}-06-potvrdjena`, { fullPage: true });

  // --- ship with tracking (empty tracking first)
  await page.getByTestId("admin-order-transition-poslata").click();
  await dlg.waitFor();
  const confirmBtn = page.getByTestId("admin-order-transition-confirm");
  step("ship dialog empty tracking", { disabled: await confirmBtn.isDisabled(), text: (await dlg.textContent())?.replace(/\s+/g, " ") });
  await page.getByTestId("admin-order-tracking-input").fill(`RS${Date.now() % 1e8}SR`);
  await shot(page, `flows-admin/order-${tag}-07-ship-dialog`);
  await confirmBtn.click();
  await dlg.waitFor({ state: "hidden", timeout: 60_000 });
  await sleep(2500);
  await shot(page, `flows-admin/order-${tag}-08-poslata`, { fullPage: true });

  // --- delivered, completed
  for (const to of ["isporucena", "zavrsena"]) {
    const btn = page.getByTestId(`admin-order-transition-${to}`);
    if (!(await btn.count())) {
      step(`no primary button for ${to}`, { buttons: await page.getByRole("button").allTextContents() });
      break;
    }
    await btn.click();
    await dlg.waitFor();
    step(`${to} dialog`, { text: (await dlg.textContent())?.replace(/\s+/g, " ") });
    await page.getByTestId("admin-order-transition-confirm").click();
    await dlg.waitFor({ state: "hidden", timeout: 60_000 });
    await sleep(2500);
  }
  await shot(page, `flows-admin/order-${tag}-09-zavrsena`, { fullPage: true });
  step("final buttons", { buttons: (await page.locator("main button").allTextContents()).slice(0, 20) });
  step("history", { text: (await page.locator("section", { hasText: "Istorija" }).first().textContent())?.replace(/\s+/g, " ").slice(0, 1500) });
  step("email section", { text: (await page.locator("section", { hasText: "E-pošta" }).first().textContent())?.replace(/\s+/g, " ").slice(0, 1500) });
  step("errors", log);
  report.probe = convexRun("testing:orderProbe", { number });
  report.emails = convexRun("testing:emailProbe", { number });
  console.log(JSON.stringify(report.probe), JSON.stringify(report.emails).slice(0, 800));
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 500) });
} finally {
  save(`order-${tag}.json`, report);
  await browser.close();
}
