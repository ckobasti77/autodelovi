/**
 * flows-shop track helpers (step 21 audit): add to cart, drive the 4-step checkout, read the
 * confirmation. Builds on kit.mjs.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { BASE, convexRun } from "./kit.mjs";

export const TRACK = "flows-shop";
export const OUT = path.resolve("docs/qa/audit/flows-shop");
mkdirSync(OUT, { recursive: true });

export const ACCOUNTS = JSON.parse(readFileSync(path.resolve(".playwright/audit-accounts.json"), "utf8"));

export const P = {
  cheap: "set-za-reparaciju-kocione-celjusti-prednji-demo-0019", // 1.490, 25
  abs: "abs-senzor-prednji-demo-0022", // 2.590, 24
  disc256: "kocioni-disk-prednji-256-22-mm-demo-0006", // 3.990, 21
  gti: "kocioni-disk-prednji-340-30-mm-gti-demo-0005", // 18.900, 23
  caliper: "kociona-celjust-prednja-leva-demo-0017", // 11.900, 16
  low1: "kocioni-disk-zadnji-272-10-mm-puni-demo-0003", // 3.890, 1
  absRear1: "abs-senzor-zadnji-demo-0021", // 2.790, 1
  zero0001: "kocioni-disk-prednji-288-25-mm-ventilirani-demo-0001",
  zero0012: "kocione-plocice-prednje-demo-0012",
  zero0026: "opruga-prednja-demo-0026",
  zero0008: "kocioni-disk-prednji-320-30-mm-demo-0008",
};

export function saveJson(name, data) {
  const file = path.join(OUT, name.endsWith(".json") ? name : `${name}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Adds `qty` of a product from its page (buy box). */
export async function addToCart(page, slug, qty = 1) {
  await page.goto(`${BASE}/deo/${slug}`, { waitUntil: "domcontentloaded" });
  const box = page.locator("#buy-box");
  const add = box.getByTestId("product-add-to-cart");
  await add.waitFor({ state: "visible", timeout: 30_000 });
  // wait for hydration
  await page.waitForFunction(() => {
    const b = document.querySelector('#buy-box [data-testid="product-add-to-cart"]');
    return b && Object.keys(b).some((k) => k.startsWith("__react"));
  }, null, { timeout: 90_000 });
  if (qty > 1) {
    const input = box.getByRole("group").getByRole("spinbutton");
    await input.fill(String(qty));
  }
  await add.click();
  await box.getByText("Dodato").first().waitFor({ timeout: 30_000 });
}

/** Reads the header cart count (0 if none). */
export async function cartCount(page) {
  const el = page.getByTestId("cart-count");
  if (!(await el.count())) return 0;
  const t = (await el.first().textContent())?.trim() ?? "0";
  return Number.parseInt(t, 10) || 0;
}

/**
 * Drives /porudzbina. opts: { firstName,lastName,phone,email, company:{name,pib,mb}|null|"keep",
 * delivery:"pickup"|"courier", address:{street,postalCode,city}, payment:label regex, vin, note,
 * submit:true }
 * Returns { number, token, url } after the thank-you page (or the page state when submit=false).
 */
export async function checkout(page, opts) {
  await page.goto(`${BASE}/porudzbina`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("checkout-step-contact").waitFor({ timeout: 30_000 });
  const started = Date.now();
  if (opts.firstName !== undefined) await page.getByLabel("Ime", { exact: true }).fill(opts.firstName);
  if (opts.lastName !== undefined) await page.getByLabel("Prezime").fill(opts.lastName);
  if (opts.phone !== undefined) await page.getByLabel("Telefon", { exact: true }).fill(opts.phone);
  if (opts.email !== undefined) await page.getByLabel("E-pošta").fill(opts.email);
  const companyBox = page.getByRole("checkbox", { name: /Kupujem kao firma/ });
  if (opts.company && opts.company !== "keep") {
    if ((await companyBox.getAttribute("aria-checked")) !== "true") await companyBox.click();
    await page.getByLabel("Naziv firme").fill(opts.company.name);
    await page.getByLabel("PIB").fill(opts.company.pib);
    if (opts.company.mb !== undefined) await page.getByLabel(/Matični broj/).fill(opts.company.mb);
  } else if (opts.company === null) {
    if ((await companyBox.getAttribute("aria-checked")) === "true") await companyBox.click();
  }
  await page.getByTestId("checkout-next").click();
  await page.getByTestId("checkout-step-delivery").waitFor({ timeout: 15_000 });
  if (opts.delivery === "courier") {
    await page.getByRole("radio", { name: /Kurirska služba/ }).click();
    if (opts.address) {
      await page.getByLabel("Ulica i broj").fill(opts.address.street);
      await page.getByLabel("Poštanski broj").fill(opts.address.postalCode);
      await page.getByLabel("Mesto").fill(opts.address.city);
    }
  } else if (opts.delivery === "pickup") {
    await page.getByRole("radio", { name: /Lično preuzimanje/ }).click();
  }
  const shippingOnDelivery = await page.getByTestId("checkout-total").first().textContent().catch(() => null);
  await page.getByTestId("checkout-next").click();
  await page.getByTestId("checkout-step-payment").waitFor({ timeout: 15_000 });
  const paymentOptions = await page.getByRole("radio").evaluateAll((els) =>
    els.map((e) => ({
      name: e.getAttribute("aria-label") || e.closest("label")?.textContent?.trim() || e.parentElement?.textContent?.trim(),
      checked: e.getAttribute("aria-checked") === "true" || e.getAttribute("data-state") === "checked",
      disabled: e.hasAttribute("disabled") || e.getAttribute("aria-disabled") === "true" || e.hasAttribute("data-disabled"),
    })),
  );
  if (opts.payment) await page.getByRole("radio", { name: opts.payment }).click();
  await page.getByTestId("checkout-next").click();
  await page.getByTestId("checkout-step-review").waitFor({ timeout: 15_000 });
  if (opts.vin !== undefined) await page.getByLabel(/Broj šasije/).fill(opts.vin);
  if (opts.note !== undefined) await page.getByLabel(/^Napomena/).last().fill(opts.note);
  if (opts.terms !== false) await page.getByRole("checkbox", { name: /Prihvatam uslove kupovine/ }).click();
  const total = (await page.getByTestId("checkout-total").first().textContent())?.trim();
  if (opts.beforeSubmit) await opts.beforeSubmit(page);
  if (opts.submit === false) return { total, paymentOptions, shippingOnDelivery };
  const wait = 3300 - (Date.now() - started);
  if (wait > 0) await page.waitForTimeout(wait);
  await page.getByTestId("checkout-submit").click();
  await page.waitForURL(/\/porudzbina\/hvala\//, { timeout: 45_000 });
  const url = page.url();
  const token = url.split("/porudzbina/hvala/")[1];
  const number = (await page.getByTestId("order-number").first().textContent())?.trim() ?? "";
  return { number, token, url, total, paymentOptions, shippingOnDelivery };
}

export function probeOrder(number) {
  try {
    return convexRun("testing:orderProbe", { number });
  } catch (e) {
    return { error: String(e).slice(0, 300) };
  }
}

/** Sign in without waiting for networkidle (live Convex subscriptions keep the network busy). */
export async function signIn(page, email, password, next = "/nalog") {
  await page.goto(`${BASE}/prijava?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("auth-email").waitFor({ timeout: 30_000 });
  await page.waitForFunction(() => {
    const b = document.querySelector('[data-testid="auth-submit"]');
    return b && Object.keys(b).some((k) => k.startsWith("__react"));
  }, null, { timeout: 45_000 });
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith(next), { timeout: 150_000 });
}

/** Cart lines on /korpa (waits for lines or the empty state). */
export async function cartLines(page) {
  await page.goto(`${BASE}/korpa`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.querySelector('[data-testid="cart-line"]') || /Korpa je prazna/.test(document.body.innerText), null, { timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  return page.getByTestId("cart-line").evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ").slice(0, 160)));
}
