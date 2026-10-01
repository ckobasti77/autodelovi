/**
 * Textarea counter after hydration (XB-01 fix-up): typing, deleting and a register() default.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/forms-auth-textarea-counter.mjs
 */
import { BASE, launch, newContext, watch } from "../audit/kit.mjs";

const browser = await launch("chromium");
try {
  const ctx = await newContext(browser, { width: 390, height: 844 });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/upit?q=${encodeURIComponent("turbina golf 7")}`, { waitUntil: "load" });
  const hydrated = () => {
    const e = document.querySelector("#iq-message");
    return !!e && Object.keys(e).some((k) => k.startsWith("__reactProps"));
  };
  await page.waitForFunction(hydrated, null, { timeout: 120_000, polling: 100 });
  // __reactProps lands in the hydration render; give the commit a moment.
  await page.waitForTimeout(500);
  const counter = () => page.locator("#iq-message-count").textContent();
  const out = { prefill: await counter() };
  await page.locator("#iq-message").click();
  await page.keyboard.press("End");
  await page.keyboard.type(", dizel");
  out.typed = await counter();
  for (let i = 0; i < 6; i++) await page.keyboard.press("Backspace");
  out.deleted = await counter();
  out.value = await page.locator("#iq-message").inputValue();
  out.consoleErrors = log.console.filter((m) => !/Failed to load resource/.test(m));
  console.log(JSON.stringify(out));
} finally {
  await browser.close();
}
