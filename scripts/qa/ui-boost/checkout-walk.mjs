/**
 * Checkout walk (step 27): every delivery × payment combination, the confirmation and the
 * tracking page, at 390 and 1440 px.
 *   node scripts/qa/ui-boost/checkout-walk.mjs <outDir> [--base=http://localhost:3000] [--widths=390,1440]
 *
 * For each viewport: puts a part in the cart, captures the cart, then for each combination
 * (pickup · pay at pickup, pickup · bank transfer as a company, courier · cash on delivery,
 * courier · bank transfer as a company) walks the four steps and captures every step. The last
 * combination is sent, so the thank-you page and the order status page are captured too. An
 * order per viewport is created in the development database (demo data, like the e2e suite).
 * Prints per step: horizontal overflow, elements left hidden, console errors.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import { PRODUCT, VIEWPORTS, launch, newContext, parseArgs } from "./kit.mjs";

const args = parseArgs();
const outDir = path.resolve(args.positional[0] ?? "docs/qa/screens/step-27/checkout");
const widths = args.flag("widths")?.split(",");
mkdirSync(outDir, { recursive: true });

const COMBOS = [
  { name: "pickup-cash", delivery: /Lično preuzimanje/, payment: /preuzimanju/i, company: false },
  {
    name: "pickup-transfer",
    delivery: /Lično preuzimanje/,
    payment: /Virman|predračun/i,
    company: true,
  },
  { name: "courier-cod", delivery: /Kurirska služba/, payment: /Pouzećem/, company: false },
  {
    name: "courier-transfer",
    delivery: /Kurirska služba/,
    payment: /Virman|predračun/i,
    company: true,
  },
];

async function shot(page, name, viewport) {
  const report = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    hidden: [...document.querySelectorAll("*")].filter(
      (e) => e.offsetParent && e.textContent.trim() && getComputedStyle(e).opacity === "0",
    ).length,
  }));
  const file = path.join(outDir, `${name}-${viewport.tag}.webp`);
  // A full-page capture resizes the viewport; an element that is `hidden lg:block` is laid out
  // anew and would replay its eager entrance into the picture. Entrances are over by now.
  await page.addStyleTag({ content: "*{animation:none!important}" });
  const buffer = await page.screenshot({ type: "png", fullPage: true });
  const image = sharp(buffer);
  const meta = await image.metadata();
  // Keep a readable size: full pages of a form are short enough at 1× up to ~2400 px.
  await image
    .extract({ left: 0, top: 0, width: meta.width, height: Math.min(meta.height, 2600) })
    .webp({ quality: 80 })
    .toFile(file);
  console.log(`${name}@${viewport.tag}: overflowX=${report.overflow} hidden=${report.hidden}`);
}

async function chooseRadio(page, pattern) {
  const radio = page.getByRole("radio", { name: pattern }).first();
  if (!(await radio.count())) return false;
  await radio.click();
  return true;
}

const browser = await launch();
for (const viewport of VIEWPORTS.filter((v) => !widths || widths.includes(v.tag))) {
  const context = await newContext(browser, args.base, viewport, { tag: "checkout" });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`));

  await page.goto(`${args.base}${PRODUCT}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.locator("#buy-box").getByTestId("product-add-to-cart").click();
  await page.getByText("Dodato").first().waitFor({ timeout: 30_000 });
  await page.goto(`${args.base}/korpa`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.getByTestId("cart-line").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(700);
  await shot(page, "cart", viewport);

  for (const [index, combo] of COMBOS.entries()) {
    const last = index === COMBOS.length - 1;
    await page.goto(`${args.base}/porudzbina`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.getByTestId("checkout-step-contact").waitFor({ timeout: 30_000 });
    await page.getByLabel("Ime", { exact: true }).fill("Nikola");
    await page.getByLabel("Prezime").fill("Stanković");
    await page.getByLabel("Telefon", { exact: true }).fill("064 123 4567");
    await page.getByLabel("E-pošta").fill(`uiboost-${Date.now()}@primer.rs`);
    const company = page.getByRole("checkbox", { name: /Kupujem kao firma/ });
    if (combo.company && !(await company.isChecked())) await company.click();
    if (!combo.company && (await company.isChecked())) await company.click();
    if (combo.company) {
      await page.getByLabel(/Naziv firme/).fill("Auto servis Stanković d.o.o.");
      await page.getByLabel("PIB").fill("100000024");
      const mb = page.getByLabel(/Matični broj/);
      if (await mb.count()) await mb.fill("20000007");
      const address = page.getByLabel(/Adresa firme|Sedište/);
      if (await address.count()) await address.first().fill("Bulevar oslobođenja 12, Novi Sad");
    }
    await page.waitForTimeout(300);
    await shot(page, `${combo.name}-1-contact`, viewport);
    await page.getByTestId("checkout-next").click();
    if (
      !(await page
        .getByTestId("checkout-step-delivery")
        .isVisible()
        .catch(() => false))
    ) {
      await page.waitForTimeout(600);
      await shot(page, `${combo.name}-1-contact-errors`, viewport);
      console.log(`${combo.name}@${viewport.tag}: contact step did not pass (see -errors capture)`);
      continue;
    }
    await chooseRadio(page, combo.delivery);
    if (/Kurir/.test(String(combo.delivery))) {
      await page.getByLabel("Ulica i broj").fill("Bulevar oslobođenja 12");
      await page.getByLabel("Poštanski broj").fill("21000");
      await page.getByLabel("Mesto").fill("Novi Sad");
    }
    await page.waitForTimeout(300);
    await shot(page, `${combo.name}-2-delivery`, viewport);
    await page.getByTestId("checkout-next").click();
    await page.getByTestId("checkout-step-payment").waitFor({ timeout: 15_000 });
    const chosen = await chooseRadio(page, combo.payment);
    if (!chosen) console.log(`${combo.name}@${viewport.tag}: payment option not offered`);
    await page.waitForTimeout(300);
    await shot(page, `${combo.name}-3-payment`, viewport);
    await page.getByTestId("checkout-next").click();
    await page.getByTestId("checkout-step-review").waitFor({ timeout: 15_000 });
    await page.waitForTimeout(300);
    await shot(page, `${combo.name}-4-review`, viewport);
    if (!last) continue;

    const terms = page.getByRole("checkbox", { name: /Prihvatam|uslove/i });
    if ((await terms.count()) && !(await terms.first().isChecked())) await terms.first().click();
    await page.getByTestId("checkout-submit").click();
    await page.waitForURL(/\/porudzbina\/hvala\//, { timeout: 60_000 });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(900);
    await shot(page, "thanks", viewport);
    const statusLink = page
      .locator('a[href^="/porudzbina/"]:not([href*="hvala"]):not([href*="predracun"])')
      .first();
    if (await statusLink.count()) {
      await page.goto(new URL(await statusLink.getAttribute("href"), args.base).href, {
        waitUntil: "networkidle",
        timeout: 120_000,
      });
      await page.waitForTimeout(900);
      await shot(page, "status", viewport);
    } else {
      console.log(`status@${viewport.tag}: no status link on the thank-you page`);
    }
  }
  console.log(
    `errors@${viewport.tag}: ${errors.length}${errors.length ? ` → ${errors.slice(0, 3).join(" | ")}` : ""}`,
  );
  await context.close();
}
await browser.close();
