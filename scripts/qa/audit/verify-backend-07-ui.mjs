/**
 * Step 21 audit — backend-07: what a genuine visitor sees on /registracija while the global sign-up
 * bucket is empty. The bucket is NOT drained (other reviewers share it): the /api/auth sign-up POST
 * is fulfilled with the exact 400 body the Next proxy returns for a ConvexError thrown in
 * afterUserCreatedOrUpdated (shape verified live with WEAK_PASSWORD, backend-07-proxy-error.txt).
 * Output: docs/qa/audit/verify/backend/backend-07-reproduce-signup-{1440,390}.webp + -ui.json
 */
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext, shot } from "./kit.mjs";

const body = JSON.stringify({
  error:
    '[Request ID: 0000000000000000] Server Error\nUncaught ConvexError: {"code":"RATE_LIMITED","message":"Previše pokušaja. Pokušajte ponovo za nekoliko minuta.","retryAfterMs":60000}\n',
});
const browser = await launch("chromium");
const results = [];
try {
  for (const vp of [
    { tag: "1440", width: 1440, height: 900 },
    { tag: "390", width: 390, height: 844 },
  ]) {
    const context = await newContext(browser, { width: vp.width, height: vp.height, tag: `verify-b07-${vp.tag}` });
    const page = await context.newPage();
    let intercepted = 0;
    await page.route(`${BASE}/api/auth`, async (route) => {
      const post = route.request().postData() ?? "";
      if (route.request().method() === "POST" && post.includes('"signUp"')) {
        intercepted++;
        await route.fulfill({ status: 400, contentType: "application/json", body });
      } else await route.continue();
    });
    await page.goto(`${BASE}/registracija`, { waitUntil: "networkidle" });
    await page.locator('input[name="name"]').fill("Petar Petrović");
    await page.getByTestId("signup-email").fill(`verify-b07-${Date.now()}@primer.rs`);
    await page.getByTestId("signup-password").fill("Kocnice2026x");
    await page.getByRole("checkbox").first().click();
    await page.getByTestId("signup-submit").click();
    const alert = page.locator('form p[role="alert"]');
    await alert.waitFor({ timeout: 20_000 });
    const text = (await alert.textContent())?.trim();
    await alert.scrollIntoViewIfNeeded();
    const file = await shot(page, `verify/backend/backend-07-reproduce-signup-${vp.tag}`);
    results.push({ viewport: vp.tag, intercepted, alertText: text, screenshot: file });
    await context.close();
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/backend/backend-07-reproduce-ui.json", JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
