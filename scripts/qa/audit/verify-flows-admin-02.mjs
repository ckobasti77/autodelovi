// Verify flows-admin-02: phone-only inquiry → send quote (dialog copy, delivery, share options) → convert (e-mail required).
// Usage: node scripts/qa/audit/verify-flows-admin-02.mjs UP-2026-000080 [width]
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, watch, shot, BASE } from "./kit.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";

const [NUM, W = "1440"] = process.argv.slice(2);
const width = Number(W);
const DIR = "verify/flows-admin";
const PFX = `${DIR}/flows-admin-02-reproduce-${width}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = { NUM, width, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, ...data });
  console.log(name, JSON.stringify(data).slice(0, 700));
};
const txt = async (l) => ((await l.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();

const browser = await launch();
try {
  const ctx = await ownerCtx(browser, { width, height: 900, tag: "vfa02" });
  const page = await go(ctx, `/admin/upiti/${NUM}`);
  const log = watch(page);
  await sleep(1500);
  const aside = page.getByRole("complementary", { name: "Kontakt i dodela" });
  step("contact", { text: (await txt(aside)).slice(0, 400) });
  await shot(page, `${PFX}-01-contact`);

  const compose = page.getByTestId("admin-quote-compose");
  if (await compose.isVisible().catch(() => false)) await compose.click();
  const comp = page.getByTestId("admin-quote-composer");
  await comp.waitFor();
  await comp.getByRole("combobox").fill("5Q0615505R");
  await sleep(2500);
  await page.getByRole("option").first().click();
  await sleep(800);
  await page.getByTestId("admin-quote-send").click();
  const dlg = page.getByRole("alertdialog");
  await dlg.waitFor();
  step("send dialog", { text: await txt(dlg) });
  await shot(page, `${PFX}-02-send-dialog`);
  await page.getByTestId("admin-quote-send-confirm").click();
  await sleep(6000);
  const main = page.locator("main").first();
  const share = await page.evaluate(() => {
    const m = document.querySelector("main");
    const links = [...m.querySelectorAll("a")].map((a) => a.getAttribute("href") ?? "");
    const buttons = [...m.querySelectorAll("button")].map((b) => (b.textContent ?? "").trim()).filter(Boolean);
    return {
      statusLinks: links.filter((h) => h.includes("/upit/")),
      viberWa: links.filter((h) => /viber|wa\.me|whatsapp/i.test(h)),
      telLinks: links.filter((h) => h.startsWith("tel:")),
      copyButtons: buttons.filter((b) => /kopir|podeli|link/i.test(b)),
      buttons: buttons.slice(0, 40),
    };
  });
  step("after send (share options)", share);
  const history = page.getByRole("region", { name: "Istorija" }).or(page.locator("section", { hasText: "Istorija" }).first());
  step("history", { text: (await txt(history)).slice(0, 700) });
  step("mentions e-mail after send", {
    emailWordInMain: /E-pošta zabeležena|e-poštom poslat|E-pošta poslata/i.test(await txt(main)),
  });
  await shot(page, `${PFX}-03-after-send`);

  // Outbox check: /admin/mejlovi, search the inquiry number
  const outbox = await go(ctx, `/admin/mejlovi`);
  await sleep(1500);
  const outboxText = await txt(outbox.locator("main").first());
  step("outbox mentions inquiry", { found: outboxText.includes(NUM), sample: outboxText.slice(0, 300) });
  await outbox.close();

  // Convert
  const conv = page.getByRole("button", { name: "Pretvori u porudžbinu" });
  await conv.click();
  const cd = page.getByRole("dialog");
  await cd.waitFor();
  await sleep(800);
  const emailInput = cd.locator('input[type="email"]');
  step("convert dialog", {
    text: (await txt(cd)).slice(0, 500),
    emailValue: await emailInput.inputValue(),
    emailRequiredAttr: await emailInput.evaluate((e) => e.required),
    phoneValue: await cd.locator('input[inputmode="tel"]').inputValue(),
  });
  const submit = cd.getByRole("button", { name: "Kreiraj porudžbinu" });
  await submit.click();
  await sleep(1500);
  step("native validation", {
    validationMessage: await emailInput.evaluate((e) => e.validationMessage),
    valid: await emailInput.evaluate((e) => e.validity.valid),
    dialogOpen: await cd.isVisible(),
    url: page.url(),
  });
  await shot(page, `${PFX}-04-convert-blocked`);
  // Bypass the browser check to see the server rule (the server rejects, so no order is created).
  await emailInput.evaluate((e) => (e.required = false));
  await submit.click();
  await sleep(4000);
  step("server validation", {
    alerts: await cd.getByRole("alert").allTextContents().catch(() => []),
    dialogOpen: await cd.isVisible(),
    url: page.url(),
  });
  await shot(page, `${PFX}-05-convert-server-error`);
  await cd.getByRole("button", { name: "Odustani" }).click().catch(() => {});
  step("errors", log);
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 800) });
} finally {
  mkdirSync(`docs/qa/audit/${DIR}`, { recursive: true });
  writeFileSync(`docs/qa/audit/${PFX}.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
