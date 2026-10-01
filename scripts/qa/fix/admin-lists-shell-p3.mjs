/**
 * admin-lists-shell (step 22): P3 checks — VIS-39 top bar aligned with the 1680 px workspace at
 * 2560, A11Y-20 bell popover name, FLOW-32 bell label, VIS-34 status icons, VIS-40 KPI trend.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/admin-lists-shell-p3.mjs
 */
import { writeFileSync } from "node:fs";

import { BASE, launch, loginAdmin, newContext } from "../audit/kit.mjs";

const browser = await launch("chromium");
const out = {};
try {
  const ctx = await newContext(browser, { width: 2560, height: 1440 });
  const page = await ctx.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main h1", { timeout: 30000 });
  await page.waitForTimeout(2500);
  out.align = await page.evaluate(() => {
    const bar = document.querySelector("header > div").getBoundingClientRect();
    const main = document.querySelector("main").getBoundingClientRect();
    return { barInner: [Math.round(bar.left), Math.round(bar.right)], main: [Math.round(main.left), Math.round(main.right)] };
  });
  out.trend = await page.evaluate(() =>
    [...document.querySelectorAll("main span")]
      .map((s) => s.textContent.trim())
      .filter((t) => /prethodnih 7 dana|prošle nedelje/.test(t))
      .slice(0, 2),
  );
  const bell = page.getByTestId("admin-notification-bell");
  out.bellLabel = await bell.getAttribute("aria-label");
  await bell.click();
  const dialog = page.getByRole("dialog", { name: "Obaveštenja" });
  await dialog.waitFor({ timeout: 10000 });
  out.popover = await dialog.evaluate((d) => {
    const id = d.getAttribute("aria-labelledby");
    const t = id ? document.getElementById(id) : null;
    return { labelledby: Boolean(id), tag: t?.tagName, text: t?.textContent };
  });
  await page.keyboard.press("Escape");
  await page.goto(`${BASE}/admin/porudzbine?status=sve`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main table tbody tr[data-row]", { timeout: 30000 });
  out.statusIcons = await page.evaluate(() => {
    const seen = {};
    for (const b of document.querySelectorAll("main table tbody td span svg")) {
      const label = b.parentElement?.textContent?.trim();
      if (label && /Čeka deo|Završena/i.test(label)) seen[label] = b.outerHTML.length;
    }
    return seen;
  });
  await ctx.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify(out));
writeFileSync("docs/qa/fix/admin-lists-shell/p3.json", JSON.stringify(out, null, 2));
