// Verify flows-admin-02 (skeptic): phone/Viber-only inquiry → quote send → customer link → convert dialog.
// Creates one public inquiry through /upit (no e-mail, channel Viber), sends a quote, never converts.
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, convexRun } from "./kit.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";

const OUT = "docs/qa/audit/verify/flows-admin";
mkdirSync(OUT, { recursive: true });
const K = "verify/flows-admin/flows-admin-02-skeptic";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = async (l) => ((await l.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
const report = { steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, ...data });
  console.log(name, JSON.stringify(data).slice(0, 700));
};

const browser = await launch();
try {
  // 1. Customer submits a phone/Viber-only inquiry through the public form.
  const cctx = await newContext(browser, { width: 1440, height: 900, tag: "vfa02sk" });
  const cp = await cctx.newPage();
  cp.setDefaultTimeout(120_000);
  const clog = watch(cp);
  await cp.goto(`${BASE}/upit`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await cp.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
  await sleep(4000);
  await cp.getByLabel("Opis").fill("Treba mi prednji kočioni disk za Golf 7, 2016 (verify skeptic 02).");
  await cp.getByLabel("Ime", { exact: true }).fill("Verify Skeptik");
  await cp.getByLabel("Telefon", { exact: true }).fill("064 555 0202");
  await cp.getByRole("radio", { name: "Viber" }).click().catch(() => {});
  step("channel checked", {
    viber: await cp.getByRole("radio", { name: "Viber" }).getAttribute("aria-checked").catch(() => "?"),
    emailOptionalLabel: await txt(cp.locator("#iq-email").locator("..")).catch(() => "?"),
  });
  await cp.getByRole("checkbox", { name: /Slažem se/ }).click();
  await sleep(3400);
  await cp.getByTestId("inquiry-submit").click().catch(async () => {
    await cp.getByRole("button", { name: /Pošalji upit/ }).click();
  });
  const navigated = await cp.waitForURL(/\/upit\/hvala\//, { timeout: 60_000 }).then(() => true, () => false);
  if (!navigated) {
    step("submit did not navigate", {
      url: cp.url(),
      alerts: await cp.getByRole("alert").allTextContents().catch(() => []),
      invalid: await cp.locator("[aria-invalid=true]").evaluateAll((els) => els.map((e) => e.id || e.getAttribute("name"))),
      log: clog,
    });
    await shot(cp, `${K}-00-submit-debug`);
    throw new Error("inquiry submit did not navigate");
  }
  await sleep(1500);
  const NUM = (await txt(cp.getByTestId("inquiry-number"))) || "";
  const statusHref = await cp.getByRole("link", { name: "stranici upita" }).getAttribute("href");
  step("thanks page", { NUM, statusHref, main: (await txt(cp.locator("main").first())).slice(0, 400) });
  await shot(cp, `${K}-01-thanks`);

  // 2. Owner sends a quote with one catalog line.
  const actx = await ownerCtx(browser, { tag: "vfa02sk-own" });
  const page = await go(actx, `/admin/upiti/${NUM}`);
  const alog = watch(page);
  await sleep(1500);
  step("contact panel", {
    text: (await txt(page.getByRole("heading", { name: "Kontakt" }).locator("xpath=..").first())).slice(0, 400),
    viberHref: await page.getByRole("link", { name: "Viber" }).first().getAttribute("href").catch(() => null),
    waHref: await page.getByRole("link", { name: "WhatsApp" }).first().getAttribute("href").catch(() => null),
    telHref: await page.getByRole("link", { name: "Pozovi" }).first().getAttribute("href").catch(() => null),
  });
  await page.getByRole("button", { name: "Napravi ponudu" }).click();
  const comp = page.getByTestId("admin-quote-composer");
  await comp.waitFor();
  await comp.getByRole("combobox").fill("5Q0615505R");
  await sleep(3000);
  await page.getByRole("option").first().click();
  await sleep(800);
  await page.getByTestId("admin-quote-send").click();
  const dlg = page.getByRole("alertdialog");
  await dlg.waitFor();
  step("send dialog", { text: await txt(dlg) });
  await shot(page, `${K}-02-send-dialog`);
  await page.getByTestId("admin-quote-send-confirm").click();
  await sleep(5000);
  const links = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")).filter((h) => /\/upit\//.test(h)));
  step("after send", {
    dialogOpen: await dlg.isVisible().catch(() => false),
    toasts: await page.locator("[data-sonner-toast]").allTextContents(),
    statusBadge: (await txt(page.locator("main").first())).match(/Ponuda poslata|Nov|U obradi/)?.[0] ?? null,
    upitLinksOnPage: links,
    copyButtons: await page.getByRole("button", { name: /Kopiraj/ }).count(),
    historyHasEmail: /e-po[sš]t|mejl/i.test(await txt(page.getByRole("heading", { name: /Istorija/ }).locator("xpath=..").first())),
  });
  await shot(page, `${K}-03-after-send`);

  // 3. The customer's saved status link shows the quote with an accept button.
  await cp.goto(`${BASE}${statusHref}`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await sleep(3500);
  step("customer status page", {
    main: (await txt(cp.locator("main").first())).slice(0, 700),
    acceptBtn: await cp.getByRole("button", { name: /Prihvat/ }).count(),
  });
  await shot(cp, `${K}-04-customer-status`);

  // 4. Convert dialog: e-mail required (client) and server rule.
  await page.bringToFront();
  await page.getByRole("button", { name: "Pretvori u porudžbinu" }).click();
  const cd = page.getByRole("dialog");
  await cd.waitFor();
  await sleep(800);
  const emailInput = cd.getByLabel(/E-pošta/);
  step("convert dialog", {
    text: (await txt(cd)).slice(0, 600),
    emailValue: await emailInput.inputValue(),
    emailRequiredAttr: await emailInput.evaluate((e) => e.required),
    phoneValue: await cd.getByLabel(/Telefon/).inputValue(),
  });
  await cd.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
  await sleep(1500);
  step("submit with empty e-mail (native)", {
    validationMessage: await emailInput.evaluate((e) => e.validationMessage),
    dialogOpen: await cd.isVisible(),
    url: page.url(),
  });
  await shot(page, `${K}-05-convert-blocked`);
  // Bypass the native check to see the server rule (fails; no order is created).
  await emailInput.evaluate((e) => {
    e.required = false;
    e.form?.setAttribute("novalidate", "");
  });
  await cd.getByRole("button", { name: "Kreiraj porudžbinu" }).click();
  await sleep(4000);
  step("submit with empty e-mail (server)", {
    alerts: await cd.getByRole("alert").allTextContents().catch(() => []),
    dialogOpen: await cd.isVisible(),
    url: page.url(),
  });
  await shot(page, `${K}-06-convert-server-error`);
  await cd.getByRole("button", { name: "Odustani" }).click().catch(() => {});
  step("probe", convexRun("testing:inquiryProbe", { number: NUM }));
  step("errors", { customer: clog, admin: alog });
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 900) });
} finally {
  writeFileSync(`${OUT}/flows-admin-02-skeptic.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
