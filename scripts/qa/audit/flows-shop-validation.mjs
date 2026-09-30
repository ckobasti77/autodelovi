/**
 * flows-shop: checkout validation (required, phone, e-mail, PIB, MB, postal code, VIN, terms),
 * input preservation (back + reload), and network loss on submit (offline → retry → exactly one
 * order). Guest at 390 px. Evidence: docs/qa/audit/flows-shop/V-*.webp + validation.json.
 */
import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { P, addToCart, probeOrder, saveJson, sleep } from "./flows-shop-lib.mjs";

const T = "flows-shop";
const out = { steps: [] };
const browser = await launch();
const ctx = await newContext(browser, { width: 390, height: 844, tag: "flows-val" });
const page = await ctx.newPage();
page.setDefaultTimeout(45_000);
const log = watch(page);

async function errs(label) {
  const r = await page.evaluate(() => {
    const invalid = [...document.querySelectorAll('[aria-invalid="true"]')].map((e) => {
      const id = e.getAttribute("id");
      const lab = id ? document.querySelector(`label[for="${id}"]`)?.textContent?.trim() : null;
      const desc = (e.getAttribute("aria-describedby") || "")
        .split(/\s+/)
        .filter(Boolean)
        .map((d) => document.getElementById(d)?.textContent?.trim())
        .filter(Boolean);
      return { label: lab || e.getAttribute("aria-label") || e.getAttribute("name"), value: e.value ?? null, desc };
    });
    const fieldErrs = [...document.querySelectorAll("[data-invalid]")].map((e) => e.innerText.replace(/\s+/g, " ").slice(0, 160));
    const alerts = [...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText.replace(/\s+/g, " ").slice(0, 200)).filter(Boolean);
    const a = document.activeElement;
    return { invalid, fieldErrs, alerts, focus: a ? `${a.tagName.toLowerCase()}#${a.id}|${a.getAttribute("aria-label") || a.textContent?.trim().slice(0, 40)}` : null };
  });
  out.steps.push({ label, ...r });
  console.log(label, JSON.stringify(r).slice(0, 900));
  return r;
}

await addToCart(page, P.cheap, 1);
await page.goto(`${BASE}/porudzbina`, { waitUntil: "domcontentloaded" });
await page.getByTestId("checkout-step-contact").waitFor({ timeout: 30_000 });
await page.waitForFunction(() => {
  const b = document.querySelector('[data-testid="checkout-next"]');
  return b && Object.keys(b).some((k) => k.startsWith("__react"));
});
// 1. empty contact
await page.getByTestId("checkout-next").click();
await sleep(600);
await errs("contact-empty");
await shot(page, `${T}/V-contact-empty-390`);
// 2. invalid phone/email
await page.getByLabel("Ime", { exact: true }).fill("Marko");
await page.getByLabel("Prezime").fill("Petrović");
await page.getByLabel("Telefon", { exact: true }).fill("123");
await page.getByLabel("E-pošta").fill("marko@primer");
await page.getByTestId("checkout-next").click();
await sleep(500);
await errs("contact-bad-phone-email");
// phone variants accepted?
const phoneVariants = {};
for (const ph of ["064/123-4567", "+381 (0) 64 1234567", "0641234567", "011 123 4567", "+49 170 1234567", "064 123", "06412345678901"]) {
  await page.getByLabel("Telefon", { exact: true }).fill(ph);
  await page.getByLabel("Telefon", { exact: true }).blur();
  await page.getByTestId("checkout-next").click();
  await sleep(350);
  phoneVariants[ph] = await page.evaluate(() => {
    const el = [...document.querySelectorAll("input")].find((i) => i.getAttribute("autocomplete") === "tel" || /tel/.test(i.type));
    return el?.getAttribute("aria-invalid") === "true" ? "invalid" : "ok";
  });
}
out.phoneVariants = phoneVariants;
console.log("phones", JSON.stringify(phoneVariants));
await page.getByLabel("Telefon", { exact: true }).fill("064 123 4567");
await page.getByLabel("E-pošta").fill(`audit-flows-val-${Date.now()}@primer.rs`);
// 3. company: empty, 8-digit PIB, bad checksum PIB, bad MB checksum
const companyBox = page.getByRole("checkbox", { name: /Kupujem kao firma/ });
await companyBox.click();
await page.getByTestId("checkout-next").click();
await sleep(500);
await errs("company-empty");
await shot(page, `${T}/V-company-empty-390`);
await page.getByLabel("Naziv firme").fill("Test d.o.o.");
await page.getByLabel("PIB").fill("15455287");
await page.getByLabel(/Matični broj/).fill("6455287");
await page.getByTestId("checkout-next").click();
await sleep(500);
await errs("company-short");
await page.getByLabel("PIB").fill("154552871"); // wrong check digit (valid is 154552870)
await page.getByLabel(/Matični broj/).fill("64552873"); // wrong check digit (valid is 64552872)
await page.getByTestId("checkout-next").click();
await sleep(500);
await errs("company-bad-checksum");
await shot(page, `${T}/V-company-checksum-390`);
await page.getByLabel("PIB").fill("154 552 870");
await page.getByLabel(/Matični broj/).fill("6455-2872");
await page.getByTestId("checkout-next").click();
await page.getByTestId("checkout-step-delivery").waitFor({ timeout: 15_000 });
// 4. courier empty address, bad postal code
await page.getByRole("radio", { name: /Kurirska služba/ }).click();
await page.getByTestId("checkout-next").click();
await sleep(500);
await errs("courier-empty");
await shot(page, `${T}/V-courier-empty-390`);
await page.getByLabel("Ulica i broj").fill("Bulevar oslobođenja 12");
await page.getByLabel("Poštanski broj").fill("2100");
await page.getByLabel("Mesto").fill("Novi Sad");
await page.getByTestId("checkout-next").click();
await sleep(500);
await errs("courier-postal-4");
await page.getByLabel("Poštanski broj").fill("21000");
await page.getByTestId("checkout-next").click();
await page.getByTestId("checkout-step-payment").waitFor({ timeout: 15_000 });
await page.getByRole("radio", { name: /Virmanom uz predračun/ }).click();
await page.getByTestId("checkout-next").click();
await page.getByTestId("checkout-step-review").waitFor({ timeout: 15_000 });
// 5. VIN: 16 chars, with O, then submit without terms
const vin = page.getByLabel(/Broj šasije/);
out.vinPresent = await vin.count();
if (out.vinPresent) {
  await vin.fill("WVWZZZ1KZAW00000");
  await page.getByTestId("checkout-submit").click();
  await sleep(700);
  await errs("review-vin16-noterms");
  await shot(page, `${T}/V-review-vin-terms-390`);
  await vin.fill("WVWZZZ1KZAW0O0001");
  await page.getByTestId("checkout-submit").click();
  await sleep(500);
  await errs("review-vin-O");
  await vin.fill("");
}
// 6. preservation: back to contact and reload
await page.getByTestId("checkout-back").click().catch(async () => page.getByRole("button", { name: /Nazad/ }).first().click());
await sleep(400);
await page.reload({ waitUntil: "domcontentloaded" });
await page.getByTestId("checkout-step-contact").waitFor({ timeout: 30_000 }).catch(() => {});
await sleep(1500);
out.afterReload = await page.evaluate(() => {
  const step = document.querySelector('[data-testid^="checkout-step-"]')?.getAttribute("data-testid");
  const vals = [...document.querySelectorAll("input")].filter((i) => i.type !== "hidden" && i.type !== "checkbox" && i.type !== "radio").map((i) => i.value);
  return { step, vals };
});
console.log("afterReload", JSON.stringify(out.afterReload));
await shot(page, `${T}/V-after-reload-390`);
// 7. walk to review and submit offline
async function nextUntilReview() {
  for (let i = 0; i < 4; i++) {
    if (await page.getByTestId("checkout-step-review").isVisible().catch(() => false)) return;
    await page.getByTestId("checkout-next").click();
    await sleep(700);
  }
}
await nextUntilReview();
await errs("walk-to-review");
await page.getByRole("checkbox", { name: /Prihvatam uslove kupovine/ }).click();
await sleep(3500);
await ctx.setOffline(true);
await sleep(800);
await page.getByTestId("checkout-submit").click();
await sleep(6000);
out.offline = await page.evaluate(() => ({
  url: location.href,
  submitDisabled: document.querySelector('[data-testid="checkout-submit"]')?.hasAttribute("disabled"),
  submitBusy: document.querySelector('[data-testid="checkout-submit"]')?.getAttribute("aria-busy"),
  submitText: document.querySelector('[data-testid="checkout-submit"]')?.textContent?.trim(),
  status: [...document.querySelectorAll('[role="status"],[role="alert"]')].map((e) => e.innerText.trim()).filter(Boolean),
}));
console.log("offline", JSON.stringify(out.offline));
await shot(page, `${T}/V-offline-submit-390`);
// double-click while offline
await page.getByTestId("checkout-submit").click({ force: true }).catch(() => {});
await page.getByTestId("checkout-submit").click({ force: true }).catch(() => {});
await ctx.setOffline(false);
const t0 = Date.now();
await page.waitForURL(/\/porudzbina\/hvala\//, { timeout: 60_000 }).catch(() => {});
out.afterOnline = { url: page.url(), ms: Date.now() - t0 };
if (/hvala/.test(page.url())) {
  const number = (await page.getByTestId("order-number").first().textContent())?.trim();
  out.afterOnline.number = number;
  out.afterOnline.probe = probeOrder(number);
  // Probe the next number to detect a duplicate submission
  const m = number?.match(/SK-(\d{4})-(\d{6})/);
  if (m) {
    const next = `SK-${m[1]}-${String(Number(m[2]) + 1).padStart(6, "0")}`;
    out.afterOnline.nextNumber = next;
    out.afterOnline.nextProbe = probeOrder(next);
  }
} else {
  await shot(page, `${T}/V-offline-after-online-390`);
  out.afterOnline.status = await page.evaluate(() => [...document.querySelectorAll('[role="status"],[role="alert"]')].map((e) => e.innerText.trim()).filter(Boolean));
}
console.log("afterOnline", JSON.stringify(out.afterOnline));
out.log = log;
saveJson("validation.json", out);
await browser.close();
