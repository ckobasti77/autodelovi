// flows-admin v3: inquiry quote → invalid line (dialog behaviour) → valid send → e-mail → convert.
// Usage: node scripts/qa/audit/flows-admin-v3-inquiry.mjs UP-2026-000054
import { launch, watch, shot, convexRun } from "./kit.mjs";
import { save, sleep } from "./flows-admin-lib.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";

const [NUM] = process.argv.slice(2);
const tag = NUM.slice(-3);
const browser = await launch();
const report = { NUM, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 600));
};
const txt = async (l) => ((await l.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();

try {
  const ctx = await ownerCtx(browser, { tag: "fa3-inq" });
  const page = await go(ctx, `/admin/upiti/${NUM}`);
  const log = watch(page);
  await sleep(1500);
  const compose = page.getByTestId("admin-quote-compose");
  if (await compose.isVisible().catch(() => false)) await compose.click();
  const comp = page.getByTestId("admin-quote-composer");
  await comp.waitFor();
  await comp.getByRole("combobox").fill("5Q0615505R");
  await sleep(2500);
  await page.getByRole("option").first().click();
  await sleep(500);
  await comp.getByRole("button", { name: "Slobodna stavka" }).click();
  const items = comp.locator("ol > li");
  const free = items.nth((await items.count()) - 1);
  await free.getByLabel("Naziv").fill("Senzor ABS prednji levi (dobavljač)");
  await free.getByLabel("Šifra / OEM").fill("wht 003 856");
  await free.getByLabel("Količina").fill("1,5");
  step("free line default availability", { v: await free.getByLabel("Dostupnost").inputValue().catch(() => "?") });
  await page.getByTestId("admin-quote-send").click();
  const dlg = page.getByRole("alertdialog");
  await dlg.waitFor();
  step("confirm dialog with invalid line", { text: await txt(dlg) });
  await page.getByTestId("admin-quote-send-confirm").click();
  await sleep(2000);
  const alertTxt = await comp.getByRole("alert").allTextContents().catch(() => []);
  step("after confirm (invalid)", {
    dialogOpen: await dlg.isVisible().catch(() => false),
    composerAlerts: alertTxt,
    ariaInvalid: await comp.locator("[aria-invalid=true]").count(),
    focus: await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.textContent?.slice(0, 40)}`),
    composerInert: await comp.evaluate((el) => !!el.closest("[inert]") || el.closest("[aria-hidden=true]") !== null),
  });
  await shot(page, `flows-admin/v3-inq-01-invalid-dialog-open`);
  await page.getByRole("button", { name: "Odustani" }).click();
  await sleep(500);
  await free.getByLabel("Količina").fill("1");
  await free.getByLabel("Cena sa PDV").fill("7.450,00");
  await free.getByLabel("Dostupnost").selectOption("on_order").catch(() => {});
  await free.getByLabel("Rok (dana)").fill("3");
  await comp.getByLabel("Napomena o isporuci").fill("Deo stiže za 3 radna dana od potvrde.");
  step("composer total", { total: await txt(comp.locator("p", { hasText: "Ukupno" }).first()) });
  await page.getByTestId("admin-quote-send").click();
  await dlg.waitFor();
  step("send dialog", { text: await txt(dlg) });
  await page.getByTestId("admin-quote-send-confirm").click();
  await sleep(5000);
  step("after send", {
    dialogOpen: await dlg.isVisible().catch(() => false),
    toasts: await page.locator("[data-sonner-toast]").allTextContents(),
    head: (await txt(page.locator("main").first())).slice(0, 700),
  });
  await shot(page, `flows-admin/v3-inq-02-sent`);
  step("probe after send", convexRun("testing:adminProbe", { inquiryNumber: NUM }));
  try {
    step("emails", { emails: convexRun("testing:emailProbe", { number: NUM }) });
  } catch (e) {
    step("emails err", { e: String(e).slice(0, 300) });
  }
  const conv = page.getByRole("button", { name: "Pretvori u porudžbinu" });
  step("convert visible", { v: await conv.isVisible().catch(() => false) });
  if (await conv.isVisible().catch(() => false)) {
    await conv.click();
    const cd = page.getByRole("dialog");
    await cd.waitFor();
    await sleep(800);
    step("convert dialog", { text: (await txt(cd)).slice(0, 900) });
    await shot(page, `flows-admin/v3-inq-03-convert-dialog`);
    // try submitting as-is first (validation check)
    const submit = cd.getByRole("button", { name: /Napravi|Kreiraj|Pretvori/ }).last();
    await submit.click();
    await sleep(3000);
    step("after convert submit", {
      url: page.url(),
      dialogOpen: await cd.isVisible().catch(() => false),
      alerts: await cd.getByRole("alert").allTextContents().catch(() => []),
      dialogText: (await txt(cd)).slice(0, 600),
    });
    await shot(page, `flows-admin/v3-inq-04-after-convert`);
  }
  step("errors", log);
  report.final = convexRun("testing:inquiryProbe", { number: NUM });
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 800) });
} finally {
  save(`v3-inquiry-${tag}.json`, report);
  await browser.close();
}
