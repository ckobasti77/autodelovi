// Verifier: copy-16 (form labels/hints/errors) and copy-17 (ambiguous microcopy)
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, loginWith } from "./kit.mjs";

const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const out = {};
const browser = await launch("chromium");
const fresh = async (tag, width = 1440, height = 900) => {
  const ctx = await newContext(browser, { width, height, tag });
  const page = await ctx.newPage();
  const log = watch(page);
  return { ctx, page, log };
};
const slug = (r) => r.split("/").join("-");
const textHas = (page, re) =>
  page.evaluate((src) => {
    const r = new RegExp(src, "i");
    const els = [...document.querySelectorAll("p, span, label, button, li, dd, div, a, h2, h3")].filter(
      (e) => r.test(e.textContent || "") && [...e.children].every((c) => !r.test(c.textContent || "")),
    );
    return els.slice(0, 4).map((e) => (e.innerText || e.textContent).replace(/\s+/g, " ").trim());
  }, re.source);

// ---- copy-16 /upit
{
  const { ctx, page, log } = await fresh("vc16-upit");
  await page.goto(`${BASE}/upit`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  out.upit_vinLabel = await page.locator('label[for="iq-vin"]').innerText().catch(() => null);
  out.upit_selects = await page.evaluate(() =>
    ["iq-brandSlug", "iq-modelSlug", "iq-generationSlug"].map((id) => {
      const s = document.getElementById(id);
      return { id, tag: s?.tagName, disabled: s?.disabled, shown: s?.options?.[s.selectedIndex]?.text };
    }),
  );
  const vin = page.locator('label[for="iq-vin"]');
  await vin.scrollIntoViewIfNeeded();
  await page.waitForTimeout(1200);
  const box = await vin.boundingBox();
  await shot(page, "verify/copy/copy-16-reproduce-upit-vin-1440", {
    clip: { x: Math.max(0, box.x - 20), y: Math.max(0, box.y - 60), width: 1100, height: 260 },
  });
  out.upit_log = log;
  await ctx.close();
}
// ---- copy-16 checkout review VIN label (no order submitted)
{
  const { ctx, page, log } = await fresh("vc16-checkout");
  await page.goto(`${BASE}/deo/kocioni-disk-prednji-276-24-mm-demo-0004`, { waitUntil: "networkidle" });
  const add = page.locator("#buy-box").getByTestId("product-add-to-cart");
  await add.click();
  await page.getByTestId("cart-count").filter({ hasText: "1" }).waitFor({ timeout: 20000 });
  await page.goto(`${BASE}/porudzbina`, { waitUntil: "networkidle" });
  await page.getByTestId("checkout-step-contact").waitFor({ timeout: 20000 });
  await page.getByTestId("checkout-next").click();
  await page.waitForTimeout(700);
  out.checkout_emptyEmail = await page.evaluate(() => {
    const inp = document.querySelector('input[type="email"]');
    return (inp?.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
  });
  await page.getByLabel("Ime", { exact: true }).fill("Verifikator");
  await page.getByLabel("Prezime").fill("Kopija");
  await page.getByLabel("Telefon", { exact: true }).fill("064 123 4567");
  await page.getByLabel("E-pošta").fill(`audit-verify-copy-1-${Date.now()}@primer.rs`);
  await page.getByTestId("checkout-next").click();
  await page.getByTestId("checkout-step-delivery").waitFor();
  await page.getByRole("radio", { name: /Kurirska služba/ }).click();
  await page.getByLabel("Ulica i broj").fill("Bulevar oslobođenja 12");
  await page.getByLabel("Poštanski broj").fill("21000");
  await page.getByLabel("Mesto").fill("Novi Sad");
  await page.getByTestId("checkout-next").click();
  await page.getByTestId("checkout-step-payment").waitFor();
  await page.getByTestId("checkout-next").click();
  await page.getByTestId("checkout-step-review").waitFor();
  await page.waitForTimeout(800);
  out.checkout_vinLabel = await page.locator('label[for="co-vin"]').innerText().catch(() => null);
  const l = page.locator('label[for="co-vin"]');
  await l.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const b = await l.boundingBox();
  await shot(page, "verify/copy/copy-16-reproduce-checkout-review-vin-1440", {
    clip: { x: Math.max(0, b.x - 20), y: Math.max(0, b.y - 40), width: 900, height: 220 },
  });
  out.checkout_log = log;
  await ctx.close();
}
// ---- copy-16 empty submits: e-mail error on auth forms
for (const route of ["/registracija", "/zaboravljena-lozinka", "/za-majstore/registracija", "/prijava"]) {
  const { ctx, page, log } = await fresh(`vc16${slug(route)}`);
  await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.locator('main form button[type="submit"]').last().click();
  await page.waitForTimeout(900);
  out[`empty${route}`] = await page.evaluate(() => {
    const inp = document.querySelector('main input[type="email"]');
    const msgs = (inp?.getAttribute("aria-describedby") ?? "")
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim())
      .filter(Boolean);
    const alerts = [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent.trim()).filter(Boolean);
    return { emailValue: inp?.value, invalid: inp?.getAttribute("aria-invalid"), describedBy: msgs, alerts: alerts.slice(0, 6) };
  });
  const inp = page.locator('main input[type="email"]').first();
  await inp.scrollIntoViewIfNeeded().catch(() => {});
  const bb = await inp.boundingBox();
  if (bb)
    await shot(page, `verify/copy/copy-16-reproduce-empty${slug(route)}-1440`, {
      clip: { x: Math.max(0, bb.x - 20), y: Math.max(0, bb.y - 70), width: Math.min(900, bb.width + 60), height: 200 },
    });
  out[`empty${route}_log`] = log;
  await ctx.close();
}

// ---- copy-17 anonymous pages
{
  const { ctx, page, log } = await fresh("vc17-anon");
  const checks = [
    ["/za-majstore/registracija", /menja se pri svakoj/],
    ["/za-majstore", /otpremite CSV/],
    ["/zaboravljena-lozinka", /Pošaljite adresu naloga/],
    ["/uslovi-koriscenja", /Nalog je opcion/],
  ];
  for (const [route, re] of checks) {
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    out[`c17${route}`] = await textHas(page, re);
    const loc = page.getByText(re).first();
    if (await loc.count()) {
      await loc.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1600);
      const bb = await loc.boundingBox();
      await shot(page, `verify/copy/copy-17-reproduce${slug(route)}-1440`, {
        clip: { x: 0, y: Math.max(0, bb.y - 120), width: 1440, height: 300 },
      });
    }
  }
  out.c17_anon_log = log;
  await ctx.close();
}
// ---- copy-17 customer /nalog/profil
{
  const { ctx, page, log } = await fresh("vc17-customer");
  await loginWith(page, acc.customer.email, acc.customer.password, "/nalog");
  await page.goto(`${BASE}/nalog/profil`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  out.c17_profil = await textHas(page, /Adresa naloga se ne menja/);
  const loc = page.getByText(/Adresa naloga se ne menja/).first();
  if (await loc.count()) {
    const bb = await loc.boundingBox();
    await shot(page, "verify/copy/copy-17-reproduce-nalog-profil-1440", {
      clip: { x: 0, y: Math.max(0, bb.y - 200), width: 1440, height: 320 },
    });
  }
  out.c17_profil_actions = await page.evaluate(() =>
    [...document.querySelectorAll("main a, main button")].map((a) => a.textContent.trim()).filter(Boolean).slice(0, 30),
  );
  out.c17_customer_log = log;
  await ctx.close();
}
// ---- copy-17 mechanic /majstor/brza-porudzbina
{
  const { ctx, page, log } = await fresh("vc17-mechanic");
  await loginWith(page, acc.mechanic.email, acc.mechanic.password, "/majstor");
  await page.goto(`${BASE}/majstor/brza-porudzbina`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  out.c17_quick = await textHas(page, /Otpremi CSV/);
  const loc = page.getByText(/Otpremi CSV/).first();
  if (await loc.count()) {
    const bb = await loc.boundingBox();
    await shot(page, "verify/copy/copy-17-reproduce-majstor-brza-porudzbina-1440", {
      clip: { x: 0, y: Math.max(0, bb.y - 160), width: 1440, height: 300 },
    });
  }
  out.c17_mechanic_log = log;
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/verify/copy/copy-16-17-reproduce.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
