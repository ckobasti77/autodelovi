/**
 * xbrowser-01 verification: /prijava visually keeps text typed before hydration — does the
 * form state have it? Types a wrong e-mail/password pre-hydration (JS chunks delayed 6 s), waits
 * for hydration, submits, and records the validation/server message.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { AUDIT_DIR, BASE, launch, newContext, shot } from "./kit.mjs";

const OUT = path.join(AUDIT_DIR, "verify", "xbrowser");
mkdirSync(OUT, { recursive: true });
const browser = await launch("chromium");
const ctx = await newContext(browser, { width: 390, height: 844, tag: "v01auth" });
const page = await ctx.newPage();
page.setDefaultTimeout(60_000);
await page.route("**/_next/static/chunks/**", async (rt) => {
  if (!/\.js(\?|$)/.test(rt.request().url())) return rt.continue();
  await new Promise((res) => setTimeout(res, 6000));
  await rt.continue().catch(() => {});
});
const r = {};
await page.goto(`${BASE}/prijava`, { waitUntil: "commit" });
const email = page.getByTestId("auth-email");
await email.waitFor({ state: "visible" });
r.hydratedBeforeTyping = await email.evaluate((e) => Object.keys(e).some((k) => k.startsWith("__reactProps")));
await email.click();
await page.keyboard.type("nepostoji-verify@primer.rs", { delay: 15 });
await page.getByTestId("auth-password").click();
await page.keyboard.type("pogresna-lozinka-123", { delay: 15 });
await page.waitForFunction(
  () => {
    const e = document.querySelector("[data-testid=auth-email]");
    return !!e && Object.keys(e).some((k) => k.startsWith("__reactProps"));
  },
  null,
  { timeout: 60_000, polling: 50 },
);
await page.waitForTimeout(2000);
r.domAfterHydration = { email: await email.inputValue(), passwordLen: (await page.getByTestId("auth-password").inputValue()).length };
await page.getByTestId("auth-submit").click();
await page.waitForTimeout(5000);
r.afterSubmit = {
  url: page.url().replace(BASE, ""),
  email: await email.inputValue(),
  messages: await page.evaluate(() =>
    [...document.querySelectorAll('[role="alert"], [id$="-error"], [aria-invalid="true"]')]
      .map((e) => (e.getAttribute("aria-invalid") ? `invalid:${e.getAttribute("name") || e.id}` : e.textContent.trim().slice(0, 140)))
      .filter(Boolean),
  ),
};
await shot(page, "verify/xbrowser/xbrowser-01-reproduce-prijava-after-submit");
console.log(JSON.stringify(r));
writeFileSync(path.join(OUT, "xbrowser-01-reproduce-prijava.json"), JSON.stringify(r, null, 2));
await ctx.close();
await browser.close();
