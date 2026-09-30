// vis-commerce (2nd reviewer): empty-submit state of the auth forms at 360 (text + one capture each).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";
import { OUT, harden, settle } from "./vis-commerce-lib.mjs";
const res = {};
const browser = await launch();
for (const [name, url] of [["prijava", "/prijava"], ["registracija", "/registracija"], ["zaboravljena", "/zaboravljena-lozinka"]]) {
  const ctx = await newContext(browser, { width: 360, height: 780, tag: `viscom2-auth-${name}` });
  const page = harden(await ctx.newPage());
  const log = watch(page);
  await page.goto(`${BASE}${url}`);
  await settle(page, 1500);
  const submit = page.locator('main form button[type="submit"]').first();
  const t0 = Date.now();
  await submit.click();
  const states = [];
  for (const ms of [300, 1500, 6000]) {
    await page.waitForTimeout(ms - (Date.now() - t0) > 0 ? ms - (Date.now() - t0) : 0);
    states.push(await page.evaluate(() => ({
      invalid: [...document.querySelectorAll('main [aria-invalid="true"]')].map((e) => e.id || e.name),
      alerts: [...document.querySelectorAll('main [role="alert"], main [id$="-error"], main .text-danger')].map((e) => e.textContent.trim().slice(0, 120)).filter(Boolean),
      busy: document.querySelector('main form button[type="submit"]')?.getAttribute("aria-busy") ?? null,
      btnText: document.querySelector('main form button[type="submit"]')?.textContent.trim(),
      focused: document.activeElement?.id || document.activeElement?.tagName,
    })));
  }
  await shot(page, `vis-commerce/v2/360-${name}-empty-submit-6s`);
  res[name] = { states, badResponses: log.badResponses, console: log.console };
  await ctx.close();
}
writeFileSync(`${OUT}/v2-auth-empty.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 1));
await browser.close();
