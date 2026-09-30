/**
 * Copy track: drives interactive states whose copy is not in the static HTML (dialogs, toasts,
 * validation errors, checkout steps, cart) and records visible text + screenshots.
 *
 *   node scripts/qa/audit/copy-states.mjs [width]
 * Output: docs/qa/audit/copy/states-<width>.json and screenshots docs/qa/audit/copy/state-*.webp
 */
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const width = Number(process.argv[2] ?? 1440);
const height = width < 800 ? 844 : 900;
const tag = String(width);
const b = await launch();
const out = {};
const errors = [];

async function textOf(page, sel = "main") {
  return page.evaluate((s) => {
    const el = document.querySelector(s) ?? document.body;
    return el.innerText;
  }, sel);
}
async function visibleAlerts(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[role=alert],[aria-invalid=true] ~ *, [id$="-error"], .text-danger, [data-state=open][role=dialog], [role=status], li[role=status], ol[tabindex] li')]
      .map((e) => e.innerText?.trim())
      .filter(Boolean)
      .slice(0, 40),
  );
}
async function step(name, fn) {
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  if (only && !only.includes(name)) return;
  try {
    out[name] = await fn();
    console.log("ok", name);
  } catch (e) {
    errors.push(`${name}: ${String(e).slice(0, 300)}`);
    console.log("FAIL", name, String(e).slice(0, 200));
  }
}

const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const _step = step;
// 1. Cookie banner + settings dialog (fresh context without consent)
await step("consent", async () => {
  const ctx = await newContext(b, { width, height, consent: false, tag: `copy-consent-${tag}` });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
  const banner = await textOf(page, "body");
  await page.getByRole("button", { name: "Podešavanja" }).first().click();
  await page.waitForTimeout(600);
  const dialog = await page.evaluate(() => document.querySelector("[role=dialog]")?.innerText ?? "");
  await shot(page, `copy/state-consent-settings-${tag}`);
  await ctx.close();
  return { banner: banner.slice(0, 900), dialog };
});

const ctx = await newContext(b, { width, height, tag: `copy-states-${tag}` });
const page = await ctx.newPage();
const log = watch(page);

// 2. Mobile menu / header
if (width < 1024) {
  await step("mobileMenu", async () => {
    await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Otvori meni" }).click();
    await page.waitForTimeout(700);
    const t = await page.evaluate(() => document.querySelector("[role=dialog]")?.innerText ?? "");
    await shot(page, `copy/state-mobile-menu-${tag}`);
    await page.keyboard.press("Escape");
    return t;
  });
}

// 3. Vehicle picker dialog
await step("vehiclePicker", async () => {
  await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
  await page.getByTestId("vehicle-picker-trigger").first().click();
  await page.waitForTimeout(900);
  const t = await page.evaluate(() => document.querySelector("[role=dialog]")?.innerText ?? "");
  await shot(page, `copy/state-vehicle-picker-${tag}`);
  await page.keyboard.press("Escape");
  return t;
});

// 4. Header search suggestions
await step("searchSuggest", async () => {
  await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
  const input = page.locator("header input").first();
  await input.click();
  await input.fill("5Q0 615");
  await page.waitForTimeout(1500);
  const t = await page.evaluate(() => document.querySelector("[role=listbox]")?.innerText ?? document.activeElement?.closest("form")?.innerText ?? "");
  await shot(page, `copy/state-search-suggest-${tag}`);
  await input.fill("zzqq nepostoji");
  await page.waitForTimeout(1500);
  const t2 = await page.evaluate(() => document.querySelector("[role=listbox]")?.innerText ?? "");
  return { t, t2 };
});

// 5. Back-in-stock: invalid e-mail
await step("backInStock", async () => {
  await page.goto(`${BASE}/deo/kocione-plocice-prednje-demo-0012`, { waitUntil: "networkidle" });
  const form = page.getByTestId("back-in-stock-form");
  await form.getByRole("textbox").first().fill("pogresno@");
  await form.getByRole("button").first().click();
  await page.waitForTimeout(800);
  const t = await form.innerText();
  await shot(page, `copy/state-back-in-stock-error-${tag}`, { locator: form });
  return t;
});

// 6. Add to cart toast + cart page
await step("addToCart", async () => {
  await page.goto(`${BASE}/deo/kocioni-disk-prednji-276-24-mm-demo-0004`, { waitUntil: "networkidle" });
  await page.getByTestId("product-add-to-cart").first().click();
  await page.waitForTimeout(1200);
  const toast = await page.evaluate(() => [...document.querySelectorAll("[role=status],[data-radix-toast-announce-exclude],li[data-state=open]")].map((e) => e.innerText).join("\n"));
  await shot(page, `copy/state-toast-${tag}`);
  return toast;
});
await step("cart", async () => {
  await page.goto(`${BASE}/korpa`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const t = await textOf(page);
  await shot(page, `copy/state-cart-${tag}`);
  return t;
});

// 7. Checkout: empty contact step → errors; then invalid values; then walk through steps
await step("checkout", async () => {
  await page.goto(`${BASE}/porudzbina`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const r = (out.checkoutPartial = { contact: await textOf(page) });
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(700);
  r.contactErrors = await textOf(page);
  await shot(page, `copy/state-checkout-contact-errors-${tag}`);
  const fill = async (label, value) => {
    const f = page.getByLabel(label, { exact: false }).first();
    await f.fill(value);
  };
  await fill("Ime", "Marko");
  await fill("Prezime", "Marković");
  await fill("Telefon", "12");
  await fill("E-pošta", "marko@");
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(700);
  r.contactInvalid = await textOf(page);
  // company toggle
  const company = page.getByText("Kupujem kao firma").first();
  if (await company.count()) {
    await company.click();
    await page.waitForTimeout(400);
    await page.getByTestId("checkout-next").click();
    await page.waitForTimeout(500);
    r.companyErrors = await textOf(page);
    await shot(page, `copy/state-checkout-company-errors-${tag}`);
    await company.click();
  }
  await fill("Telefon", "064 123 4567");
  await fill("E-pošta", `audit-copy-${Date.now()}@primer.rs`);
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(900);
  r.delivery = await textOf(page);
  await shot(page, `copy/state-checkout-delivery-${tag}`);
  // choose courier and continue without address
  const courier = page.getByText("Kurirska služba").first();
  if (await courier.count()) await courier.click();
  await page.waitForTimeout(400);
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(600);
  r.deliveryErrors = await textOf(page);
  await fill("Ulica i broj", "Test ulica 5");
  await fill("Mesto", "Beograd");
  await fill("Poštanski broj", "110");
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(600);
  r.postalError = await textOf(page);
  await fill("Poštanski broj", "11000");
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(900);
  r.payment = await textOf(page);
  await shot(page, `copy/state-checkout-payment-${tag}`);
  const bank = page.getByText("Virmanom uz predračun").first();
  if (await bank.count() && await bank.isEnabled().catch(() => false) && !(await page.locator("input[value=bank_transfer]").isDisabled().catch(() => true))) {
    await bank.click();
    await page.waitForTimeout(300);
    await page.getByTestId("checkout-next").click();
    await page.waitForTimeout(600);
    r.bankError = await textOf(page);
    await page.getByText("Pouzećem").first().click();
  }
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(900);
  r.review = await textOf(page);
  await shot(page, `copy/state-checkout-review-${tag}`, { fullPage: true });
  // submit without terms
  await page.getByTestId("checkout-submit").click();
  await page.waitForTimeout(700);
  r.reviewErrors = await textOf(page);
  return r;
});

// 8. Inquiry form errors
await step("inquiry", async () => {
  await page.goto(`${BASE}/upit`, { waitUntil: "networkidle" });
  await page.getByTestId("inquiry-submit").click();
  await page.waitForTimeout(700);
  const r = { empty: await textOf(page) };
  await shot(page, `copy/state-inquiry-errors-${tag}`, { fullPage: true });
  await page.getByTestId("inquiry-vin-input").fill("WVWZZZ1KZ8W00000O");
  await page.getByTestId("inquiry-submit").click();
  await page.waitForTimeout(700);
  r.vin = await textOf(page);
  return r;
});

// 9. Sign-in error, sign-up weak password, reset
await step("signin", async () => {
  await page.goto(`${BASE}/prijava`, { waitUntil: "networkidle" });
  await page.getByTestId("auth-email").fill("nepostoji-copy@primer.rs");
  await page.getByTestId("auth-password").fill("pogresna123");
  await page.getByTestId("auth-submit").click();
  await page.waitForTimeout(3500);
  const t = await textOf(page);
  await shot(page, `copy/state-signin-error-${tag}`);
  await page.getByTestId("auth-email").fill("");
  await page.getByTestId("auth-submit").click();
  await page.waitForTimeout(700);
  return { wrong: t, empty: await textOf(page) };
});
await step("signup", async () => {
  await page.goto(`${BASE}/registracija`, { waitUntil: "networkidle" });
  await page.getByTestId("signup-submit").click();
  await page.waitForTimeout(700);
  const empty = await textOf(page);
  await page.getByTestId("signup-email").fill("copy@");
  await page.getByTestId("signup-password").fill("kratka");
  await page.getByTestId("signup-submit").click();
  await page.waitForTimeout(900);
  const bad = await textOf(page);
  await shot(page, `copy/state-signup-errors-${tag}`);
  return { empty, bad };
});
await step("reset", async () => {
  await page.goto(`${BASE}/zaboravljena-lozinka`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Pošalji kod/ }).click();
  await page.waitForTimeout(700);
  return await textOf(page);
});

// 10. Mechanic registration errors
await step("mechanicReg", async () => {
  await page.goto(`${BASE}/za-majstore/registracija`, { waitUntil: "networkidle" });
  await page.getByTestId("mechanic-registration-submit").or(page.getByRole("button", { name: "Registrujte servis" })).last().click();
  await page.waitForTimeout(900);
  const empty = await textOf(page);
  await shot(page, `copy/state-mechanic-reg-errors-${tag}`, { fullPage: true });
  const pib = page.getByLabel("PIB").first();
  await pib.fill("123456789");
  await page.getByLabel("Matični broj").first().fill("1234");
  await page.getByRole("button", { name: "Registrujte servis" }).last().click();
  await page.waitForTimeout(700);
  return { empty, pib: await textOf(page) };
});

// 11. Hero parts list panel (home) — open „Lista delova“ and pick a category
await step("partsPanel", async () => {
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Lista delova" }).first().click();
  await page.waitForTimeout(1200);
  const list = await page.evaluate(() => document.querySelector("[role=dialog]")?.innerText ?? "");
  await shot(page, `copy/state-parts-list-${tag}`);
  const item = page.getByRole("dialog").getByRole("button", { name: /Kočioni diskovi/ }).first();
  let panel = "";
  if (await item.count()) {
    await item.click();
    await page.waitForTimeout(2500);
    panel = await page.evaluate(() => [...document.querySelectorAll("[role=dialog],aside")].map((d) => d.innerText).join("\n----\n"));
    await shot(page, `copy/state-part-panel-${tag}`);
  }
  return { list, panel };
});

writeFileSync(`docs/qa/audit/copy/states-${width}${process.env.ONLY ? "-" + process.env.ONLY.replaceAll(",", "_") : ""}.json`, JSON.stringify({ out, errors, log }, null, 1));
console.log("errors", errors.length, "console", log.console.length);
await b.close();
