// flows-admin: inquiry → quote (catalog line + free line) → send → customer page → convert to order.
// Usage: node flows-admin-inquiry.mjs UP-2026-000054
import { BASE, launch, watch, shot, convexRun, newContext } from "./kit.mjs";
import { save, sleep } from "./flows-admin-lib.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";

const [NUM] = process.argv.slice(2);
const tag = NUM.slice(-3);
const browser = await launch();
const report = { NUM, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 500));
};
const txt = async (l) => ((await l.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();

try {
  const ctx = await ownerCtx(browser, { tag: "fa-inq" });
  const page = await go(ctx, `/admin/upiti/${NUM}`);
  const log = watch(page);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await sleep(2000);
  step("open", { head: await txt(page.locator("main").first()).then((t) => t.slice(0, 400)) });
  await shot(page, `flows-admin/inq-${tag}-01-open`);

  await page.getByTestId("admin-quote-compose").click();
  const comp = page.getByTestId("admin-quote-composer");
  await comp.waitFor();
  // Empty send: button disabled?
  step("empty composer", { sendDisabled: await page.getByTestId("admin-quote-send").isDisabled() });
  // Save empty draft → validation message
  await comp.getByRole("button", { name: "Sačuvaj nacrt" }).click();
  await sleep(600);
  step("empty draft save", { alert: await txt(comp.getByRole("alert")) });

  // catalog line via picker
  const picker = comp.getByRole("combobox");
  await picker.fill("5Q0615505R");
  await sleep(2500);
  const opts = await page.getByRole("option").allTextContents();
  step("picker options", { opts: opts.slice(0, 5).map((o) => o.replace(/\s+/g, " ")) });
  await shot(page, `flows-admin/inq-${tag}-02-picker`);
  if (opts.length) {
    await page.getByRole("option").first().click();
  }
  await sleep(500);
  // free line — leave price empty first
  await comp.getByRole("button", { name: "Slobodna stavka" }).click();
  const items = comp.locator("ol > li");
  const n = await items.count();
  const free = items.nth(n - 1);
  await free.getByLabel("Naziv").fill("Senzor ABS prednji levi (dobavljač)");
  await free.getByLabel("Šifra / OEM").fill("wht 003 856");
  await free.getByLabel("Količina").fill("1,5");
  await page.getByTestId("admin-quote-send").click();
  await page.getByRole("alertdialog").waitFor();
  step("send dialog (invalid qty)", { text: await txt(page.getByRole("alertdialog")) });
  await page.getByTestId("admin-quote-send-confirm").click();
  await sleep(1500);
  step("invalid qty result", {
    alert: await txt(comp.getByRole("alert")),
    dialogOpen: await page.getByRole("alertdialog").isVisible().catch(() => false),
    invalidFields: await comp.locator("[aria-invalid=true]").count(),
  });
  await shot(page, `flows-admin/inq-${tag}-03-invalid`);
  await free.getByLabel("Količina").fill("1");
  await free.getByLabel("Cena sa PDV").fill("7.450,00");
  await free.getByLabel("Dostupnost").selectOption("on_order").catch(() => {});
  await free.getByLabel("Rok (dana)").fill("3");
  await comp.getByLabel("Napomena o isporuci").fill("Deo stiže za 3 radna dana od potvrde (audit).");
  step("composer total", { total: await txt(comp.locator("p", { hasText: "Ukupno" })) });
  await shot(page, `flows-admin/inq-${tag}-04-composer`, { fullPage: true });
  await page.getByTestId("admin-quote-send").click();
  await page.getByRole("alertdialog").waitFor();
  step("send dialog", { text: await txt(page.getByRole("alertdialog")) });
  await page.getByTestId("admin-quote-send-confirm").click();
  await sleep(4000);
  step("after send", {
    toasts: await page.locator("[data-sonner-toast], [role=status]").allTextContents(),
    alerts: await page.getByRole("alert").allTextContents(),
    head: (await txt(page.locator("main").first())).slice(0, 500),
  });
  await shot(page, `flows-admin/inq-${tag}-05-sent`);
  const probe = convexRun("testing:adminProbe", { inquiryNumber: NUM });
  step("probe after send", probe);
  let emails = [];
  try {
    emails = convexRun("testing:emailProbe", { number: NUM });
  } catch (e) {
    emails = [String(e).slice(0, 200)];
  }
  step("emails", { emails: Array.isArray(emails) ? emails.map((e) => e.templateKey ?? e) : emails });

  // Customer page — token? Look for a status link in the page
  const links = await page.locator("a[href*='/upit/']").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  step("customer links on admin page", { links });

  // Convert
  const convBtn = page.getByRole("button", { name: "Pretvori u porudžbinu" });
  step("convert visible", { v: await convBtn.isVisible().catch(() => false) });
  if (await convBtn.isVisible().catch(() => false)) {
    await convBtn.click();
    const dlg = page.getByRole("dialog");
    await dlg.waitFor();
    await sleep(800);
    step("convert dialog", { text: (await txt(dlg)).slice(0, 700) });
    await shot(page, `flows-admin/inq-${tag}-06-convert-dialog`);
    // submit with whatever is prefilled
    await dlg.getByRole("button", { name: /Kreiraj|Pretvori/ }).last().click();
    await sleep(5000);
    step("after convert", {
      url: page.url(),
      alerts: await page.getByRole("alert").allTextContents(),
      dialogOpen: await dlg.isVisible().catch(() => false),
      dialogText: (await txt(dlg)).slice(0, 500),
    });
    await shot(page, `flows-admin/inq-${tag}-07-after-convert`);
  }
  step("errors", log);
  report.final = convexRun("testing:inquiryProbe", { number: NUM });
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 800) });
} finally {
  save(`inquiry-${tag}.json`, report);
  await browser.close();
}
