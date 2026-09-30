// Verifier (flows-admin-06 / -05): quote send with an invalid free line; then valid send, convert
// to an order and read the order line SKU + otpremnica Šifra. Usage: node ... [UP-number]
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, convexRun } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/flows-admin";
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, ...data });
  console.log(name, JSON.stringify(data).slice(0, 900));
};
const txt = async (l) => ((await l.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();

let NUM = process.argv[2];
if (!NUM) {
  NUM = convexRun("testing:createTestInquiry", { tag: `vfa-${Date.now().toString().slice(-6)}` }).number;
}
report.inquiry = NUM;
step("inquiry", { NUM });

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "vfa-quote", mobile: false });
const page = await ctx.newPage();
page.setDefaultTimeout(90_000);
const log = watch(page);

async function goto(route) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 120_000 });
      return;
    } catch (e) {
      if (i === 2) throw e;
      await sleep(2500);
    }
  }
}

try {
  await goto(`/prijava?next=%2Fadmin`);
  await page.waitForLoadState("load").catch(() => {});
  await sleep(4000);
  await page.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
  await page.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 90_000 });
  await sleep(3000);

  await goto(`/admin/upiti/${NUM}`);
  await page.getByTestId("admin-quote-compose").waitFor();
  await sleep(1500);
  await page.getByTestId("admin-quote-compose").click();
  const comp = page.getByTestId("admin-quote-composer");
  await comp.waitFor();
  await comp.getByRole("combobox").fill("5Q0615505R");
  await sleep(3000);
  await page.getByRole("option").first().click();
  await sleep(800);
  const items = comp.locator("ol > li");
  const cat = items.nth(0);
  step("catalog line", {
    name: await cat.getByLabel("Naziv").inputValue(),
    sifra: await cat.getByLabel("Šifra / OEM").inputValue(),
    price: await cat.getByLabel("Cena sa PDV").inputValue(),
  });
  await comp.getByRole("button", { name: "Slobodna stavka" }).click();
  const free = items.nth(1);
  await free.getByLabel("Naziv").fill("Senzor ABS prednji levi (dobavljač)");
  await free.getByLabel("Šifra / OEM").fill("WHT 003 856");
  await free.getByLabel("Količina").fill("1,5");
  step("free line default availability", { v: await free.getByLabel("Dostupnost").inputValue() });

  // Variant A: "Sačuvaj nacrt" with the same invalid line (no dialog; inline error)
  await comp.getByRole("button", { name: "Sačuvaj nacrt" }).click();
  await sleep(1200);
  step("variant: save draft invalid", {
    alerts: await comp.getByRole("alert").allTextContents(),
    focus: await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.textContent?.slice(0, 40)}`),
    ariaInvalid: await comp.locator("[aria-invalid=true]").count(),
  });

  // Main: Pošalji ponudu with the invalid line
  await page.getByTestId("admin-quote-send").click();
  const dlg = page.getByRole("alertdialog");
  await dlg.waitFor();
  step("confirm dialog (invalid line present)", { text: await txt(dlg) });
  await shot(page, "verify/flows-admin/flows-admin-06-reproduce-dialog");
  await page.getByTestId("admin-quote-send-confirm").click();
  await sleep(2500);
  const aria = await page.locator("body").ariaSnapshot().catch(() => "");
  step("after confirm (invalid)", {
    dialogOpen: await dlg.isVisible().catch(() => false),
    dialogText: await txt(dlg),
    composerAlerts: await comp.getByRole("alert").allTextContents(),
    alertInAriaTree: /Stavka 2/.test(aria),
    composerHidden: await comp.evaluate((el) => !!el.closest("[inert]") || !!el.closest("[aria-hidden=true]")),
    focus: await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.textContent?.slice(0, 40)}`),
  });
  await shot(page, "verify/flows-admin/flows-admin-06-reproduce-stuck");
  // Escape closes?
  await page.keyboard.press("Escape");
  await sleep(600);
  step("after Escape", { dialogOpen: await dlg.isVisible().catch(() => false), composerAlerts: await comp.getByRole("alert").allTextContents() });
  if (await dlg.isVisible().catch(() => false)) await page.getByRole("button", { name: "Odustani" }).click();

  // Fix and send
  await free.getByLabel("Količina").fill("1");
  await free.getByLabel("Cena sa PDV").fill("7.450,00");
  await free.getByLabel("Dostupnost").selectOption("on_order").catch(() => {});
  await free.getByLabel("Rok (dana)").fill("3");
  await page.getByTestId("admin-quote-send").click();
  await dlg.waitFor();
  step("valid send dialog", { text: await txt(dlg) });
  await page.getByTestId("admin-quote-send-confirm").click();
  await sleep(6000);
  step("after valid send", { dialogOpen: await dlg.isVisible().catch(() => false), probe: convexRun("testing:adminProbe", { inquiryNumber: NUM }) });

  // Convert
  const conv = page.getByRole("button", { name: "Pretvori u porudžbinu" });
  await conv.waitFor({ timeout: 60_000 });
  await conv.click();
  const cd = page.getByRole("dialog");
  await cd.waitFor();
  await sleep(800);
  await cd.getByLabel(/E-pošta/).fill(`audit-verify-flows-admin-${Date.now().toString().slice(-6)}@primer.rs`).catch(() => {});
  await cd.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
  await sleep(6000);
  let number = page.url().match(/SK-\d{4}-\d{6}/)?.[0];
  if (!number) {
    const href = await page.locator("a[href*='/admin/porudzbine/SK-']").first().getAttribute("href").catch(() => null);
    number = href?.match(/SK-\d{4}-\d{6}/)?.[0];
  }
  step("converted", { url: page.url(), number, alerts: await page.getByRole("alert").allTextContents().catch(() => []) });
  report.order = number;
  if (number) {
    await goto(`/admin/porudzbine/${number}`);
    await page.getByRole("heading", { level: 1 }).first().waitFor();
    await sleep(3500);
    const main = await txt(page.locator("main").first());
    const i = main.indexOf("Kočioni disk");
    step("order detail line", { snippet: main.slice(Math.max(0, i - 40), i + 260) });
    const line = page.locator("main").getByText("Kočioni disk", { exact: false }).first();
    await line.scrollIntoViewIfNeeded().catch(() => {});
    await shot(page, "verify/flows-admin/flows-admin-05-reproduce-order");
    await goto(`/admin/porudzbine/${number}/otpremnica`);
    await sleep(4000);
    const rows = await page.locator("table tr").allTextContents();
    step("otpremnica rows", { head: await txt(page.locator("table thead").first()), rows: rows.map((r) => r.replace(/\s+/g, " ").trim()).slice(0, 6) });
    const table = page.locator("table").first();
    await shot(page, "verify/flows-admin/flows-admin-05-reproduce-otpremnica", { locator: table });
  }
  // Web-order baseline for comparison: a known web order containing DEMO-0004
  step("baseline DEMO-0004 product", convexRun("testing:productBySku", { sku: "DEMO-0004" }));
} catch (e) {
  step("FAILED", { e: String(e).slice(0, 900) });
} finally {
  step("errors", log);
  writeFileSync(`${OUT}/flows-admin-05-06-reproduce.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
