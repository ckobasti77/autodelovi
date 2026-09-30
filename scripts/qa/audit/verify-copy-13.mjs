/**
 * Independent verification of copy-13 (format slips): cart/checkout „0 RSD“ space, predračun
 * column label, e-mail template subjects/preheaders/plain text (admin preview).
 *   node scripts/qa/audit/verify-copy-13.mjs
 * Output: docs/qa/audit/verify/copy/copy-13-reproduce.json + screenshots.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, shot, loginAdmin } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/copy";
mkdirSync(OUT, { recursive: true });
const b = await launch();
const res = {};

const codes = (s) => [...s].map((c) => (c === " " ? "[NBSP]" : c === " " ? "[SP]" : c)).join("");

// 1. Cart + checkout delivery step (anonymous, 1440)
{
  const ctx = await newContext(b, { width: 1440, height: 900, tag: "verify-copy13" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/deo/kocioni-disk-prednji-276-24-mm-demo-0004`, { waitUntil: "networkidle" });
  await page.getByTestId("product-add-to-cart").first().click();
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/korpa`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const cartDelivery = await page.evaluate(() => {
    const dt = [...document.querySelectorAll("dt")].find((e) => e.textContent.trim() === "Dostava");
    return dt?.nextElementSibling?.textContent ?? null;
  });
  const cartMoney = await page.evaluate(() => {
    const dt = [...document.querySelectorAll("dt")].find((e) => e.textContent.trim() === "Međuzbir");
    return dt?.nextElementSibling?.textContent ?? null;
  });
  res.cart = { delivery: cartDelivery, deliveryCodes: cartDelivery && codes(cartDelivery), subtotalCodes: cartMoney && codes(cartMoney) };
  const dd = page.locator("dt", { hasText: /^Dostava$/ }).first().locator("xpath=..");
  if (await dd.count()) await shot(page, "verify/copy/copy-13-reproduce-cart-1440", { locator: dd });

  await page.goto(`${BASE}/porudzbina`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.getByLabel("Ime", { exact: false }).first().fill("Marko");
  await page.getByLabel("Prezime", { exact: false }).first().fill("Marković");
  await page.getByLabel("Telefon", { exact: false }).first().fill("064 123 4567");
  await page.getByLabel("E-pošta", { exact: false }).first().fill(`audit-verify-copy-${Date.now()}@primer.rs`);
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(1200);
  const opts = await page.evaluate(() =>
    [...document.querySelectorAll("[role=radio], label")]
      .map((e) => e.textContent)
      .filter((t) => t && /RSD|besplatno/.test(t))
      .slice(0, 8),
  );
  res.checkoutDelivery = opts.map((t) => ({ text: t, codes: codes(t) }));
  await shot(page, "verify/copy/copy-13-reproduce-checkout-delivery-1440", { clip: { x: 0, y: 0, width: 1440, height: 900 } });
  await ctx.close();
}

// 2. Predračun column header
{
  const ctx = await newContext(b, { width: 1440, height: 900, tag: "verify-copy13-pred" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/porudzbina/GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw/predracun`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  res.predracunHeaders = await page.evaluate(() => [...document.querySelectorAll("th")].map((e) => e.textContent.trim()));
  const table = page.locator("table").first();
  if (await table.count()) await shot(page, "verify/copy/copy-13-reproduce-predracun-1440", { locator: table });
  await ctx.close();
}

// 3. E-mail templates (admin preview, plain text)
{
  const ctx = await newContext(b, { width: 1440, height: 900, tag: "verify-copy13-admin" });
  const page = await ctx.newPage();
  await loginAdmin(page);
  res.emails = {};
  for (const key of ["quote_ready", "quote_expiring", "back_in_stock", "staff_low_stock", "staff_order_new", "order_received", "staff_inquiry_new"]) {
    await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=${key}&prikaz=tekst`, { waitUntil: "networkidle" });
    await page.waitForSelector("[data-testid=template-preview] pre", { timeout: 30000 });
    await page.waitForTimeout(500);
    res.emails[key] = await page.evaluate(() => {
      const root = document.querySelector("[data-testid=template-preview]");
      const dds = [...root.querySelectorAll("dl dd")].map((e) => e.textContent);
      return { subject: dds[0], preheader: dds[1], text: root.querySelector("pre")?.textContent };
    });
    if (key === "quote_ready" || key === "back_in_stock" || key === "staff_low_stock") {
      await shot(page, `verify/copy/copy-13-reproduce-email-${key}`, { locator: page.getByTestId("template-preview") });
    }
  }
  await ctx.close();
}

writeFileSync(`${OUT}/copy-13-reproduce.json`, JSON.stringify(res, null, 2));
await b.close();
console.log("done");
