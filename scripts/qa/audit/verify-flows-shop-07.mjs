// Verifier (flows-shop-07): quote acceptance form error handling (no valid submission is made).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
const TOKEN = process.env.TOKEN ?? "3UMmrdzw1RNGw5ToQh06cANjxl8c_-Ajvp7eBwA1ayI";
const out = { token: TOKEN.slice(0, 6) + "…" };
const browser = await launch("chromium");
for (const width of [390, 1440]) {
  const ctx = await newContext(browser, { width, height: width === 390 ? 844 : 900, tag: `v07-${width}` });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/upit/${TOKEN}`, { waitUntil: "networkidle" });
  const acceptBtn = page.getByRole("button", { name: /Prihvati ponudu/i });
  out[`${width} hasAccept`] = await acceptBtn.count();
  if (!out[`${width} hasAccept`]) { out[`${width} pageText`] = (await page.locator("main").innerText()).slice(0, 400); await ctx.close(); continue; }
  await acceptBtn.first().click();
  const form = page.locator("form", { has: page.getByText("Podaci za porudžbinu") });
  await form.waitFor({ timeout: 10000 });
  const submit = form.getByRole("button", { name: /Pošalji porudžbinu po ponudi/i });
  const state = async (label) => {
    const s = await page.evaluate(() => {
      const f = [...document.querySelectorAll("form")].find((x) => x.textContent.includes("Podaci za porudžbinu"));
      const alerts = [...f.querySelectorAll('[role="alert"], [aria-live]')].map((a) => a.textContent.trim()).filter(Boolean);
      const invalid = f.querySelectorAll('[aria-invalid="true"]').length;
      const described = [...f.querySelectorAll("input")].map((i) => ({ label: i.labels?.[0]?.textContent?.trim() ?? i.type, describedby: i.getAttribute("aria-describedby"), invalid: i.getAttribute("aria-invalid"), value: i.type === "checkbox" ? i.checked : i.value }));
      const a = document.activeElement;
      return { alerts, invalid, inputs: described, focus: `${a.tagName} ${a.textContent?.trim().slice(0, 40) ?? ""}` };
    });
    out[`${width} ${label}`] = s;
  };
  await state("beforeSubmit");
  await submit.click();
  await page.waitForTimeout(600);
  await state("emptySubmit");
  if (width === 390) {
    const alert = form.locator('[role="alert"]').first();
    if (await alert.count()) await alert.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    out["390 shotEmpty"] = await shot(page, "verify/flows-shop/flows-shop-07-reproduce-empty-390");
    const phone = form.getByLabel("Telefon");
    await phone.scrollIntoViewIfNeeded();
    out["390 shotFields"] = await shot(page, "verify/flows-shop/flows-shop-07-reproduce-fields-390");
  }
  await form.getByLabel("Telefon").fill("064 123 4567");
  await submit.click();
  await page.waitForTimeout(600);
  await state("afterPhoneFix");
  await form.getByLabel("E-pošta").fill("audit-verify-07@primer.rs");
  await submit.click();
  await page.waitForTimeout(600);
  await state("afterEmailFix(terms still unchecked)");
  if (width === 390) out["390 shotTerms"] = await shot(page, "verify/flows-shop/flows-shop-07-reproduce-terms-390");
  out[`${width} errors`] = log.console.slice(0, 3);
  await ctx.close();
}
await browser.close();
writeFileSync("docs/qa/audit/verify/flows-shop/flows-shop-07-reproduce.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
