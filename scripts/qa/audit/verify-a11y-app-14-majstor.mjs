// Variant check for a11y-app-14: do mechanic portal sub-pages have their own headings?
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "./kit.mjs";
const ACC = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const browser = await launch("chromium");
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-a11y-14m" });
const page = await ctx.newPage();
await page.goto(`${BASE}/prijava?next=%2Fmajstor`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForFunction(() => { const f = document.querySelector("[data-testid=auth-email]")?.closest("form"); return !!f && Object.keys(f).some((k) => k.startsWith("__reactProps")); }, null, { timeout: 180000 });
await page.getByTestId("auth-email").fill(ACC.mechanic.email);
await page.getByTestId("auth-password").fill(ACC.mechanic.password);
await page.getByTestId("auth-submit").click();
await page.waitForURL((u) => u.pathname.startsWith("/majstor"), { timeout: 180000 });
const out = {};
for (const r of ["/majstor", "/majstor/porudzbine", "/majstor/upiti", "/majstor/vozila", "/majstor/profil", "/majstor/cenovnik", "/majstor/omiljeno", "/majstor/brza-porudzbina"]) {
  await page.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator("h1").first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(3500);
  out[r] = await page.evaluate(() => [...document.querySelectorAll("main h1, main h2, main h3")].map((h) => `${h.tagName}:${h.textContent.trim().slice(0, 40)}`));
}
writeFileSync("docs/qa/audit/verify/a11y-app/a11y-app-14-reproduce-majstor.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
await browser.close();
