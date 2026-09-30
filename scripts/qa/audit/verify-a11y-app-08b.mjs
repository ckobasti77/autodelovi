import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, loginWith } from "./kit.mjs";

const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const browser = await launch("chromium");
const ctx = await newContext(browser, { width: 390, height: 844, tag: "v08b" });
const page = await ctx.newPage();
await loginWith(page, acc.mechanic.email, acc.mechanic.password, "/majstor");
await page.goto(`${BASE}/majstor/cenovnik`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.locator("h1").first().click();
let info;
for (let i = 0; i < 40; i++) {
  await page.keyboard.press("Tab");
  await page.waitForTimeout(80);
  info = await page.evaluate(() => {
    const a = document.activeElement;
    const r = a.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return {
      label: a.getAttribute("aria-label") || a.textContent.trim().slice(0, 40),
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      scrollY: Math.round(scrollY),
      topmostAtCenter: hit ? `${hit.tagName.toLowerCase()}.${String(hit.className).slice(0, 80)}` : null,
      topmostIsFocused: hit === a || a.contains(hit),
    };
  });
  if (info.label === "Brizgaljke i pumpa goriva") break;
}
await shot(page, "verify/a11y-app/a11y-app-08-reproduce-390-focused");
// Close-up of the bar region
await shot(page, "verify/a11y-app/a11y-app-08-reproduce-390-bar-crop", { clip: { x: 0, y: 640, width: 390, height: 204 } });
writeFileSync("docs/qa/audit/verify/a11y-app/a11y-app-08-reproduce-focused.json", JSON.stringify(info, null, 2));
console.log(info);
await browser.close();
