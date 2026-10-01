// Step 22 · shell-perf: styleguide checks (text reveal contract, lazy toast viewport, tooltip provider).
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, scrollThrough, revealCheck } from "../audit/kit.mjs";

const browser = await launch();
const result = {};
try {
  const context = await newContext(browser, { width: 1440, height: 900, tag: "sg" });
  const page = await context.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/styleguide`, { waitUntil: "networkidle" });
  await scrollThrough(page);
  await page.waitForTimeout(1500);
  result.reveal = await revealCheck(page);
  result.toastViewportBefore = await page.locator("ol[tabindex='-1']").count();
  await page.getByRole("button", { name: "Info", exact: true }).first().click();
  await page.getByText("OEM broj kopiran", { exact: true }).waitFor({ timeout: 15000 });
  result.toastShown = true;
  const tip = page.getByRole("button", { name: "Šta znači Original VAG?" });
  await tip.scrollIntoViewIfNeeded();
  await tip.hover();
  await page.getByRole("tooltip").first().waitFor({ timeout: 5000 });
  result.tooltipShown = true;
  result.errors = [...log.console, ...log.pageErrors];
  await context.close();
} finally {
  await browser.close();
}
writeFileSync("docs/qa/fix/shell-perf/verify-styleguide.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
