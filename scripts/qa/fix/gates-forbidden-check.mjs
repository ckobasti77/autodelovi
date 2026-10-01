import { chromium } from "@playwright/test";
import fs from "node:fs";
const acc = JSON.parse(fs.readFileSync(".playwright/audit-accounts.json", "utf8")).customer;
const base = "http://localhost:3100";
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ storageState: ".playwright/consent-state.json", viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base + "/prijava");
  await page.getByTestId("auth-email").fill(acc.email);
  await page.getByTestId("auth-password").fill(acc.password);
  await page.getByTestId("auth-submit").click();
  // The sign-in page stays put and shows the session (auth.spec.ts).
  await page.locator('[data-testid="auth-viewer"][data-role]').waitFor({ timeout: 30000 });
  console.log("signed in as", await page.locator('[data-testid="auth-viewer"]').getAttribute("data-role"));
  const raw = await ctx.request.get(base + "/admin");
  const html = await raw.text();
  const resp = await page.goto(base + "/admin");
  const h1 = await page.getByRole("heading", { level: 1 }).first().textContent({ timeout: 15000 }).catch(() => null);
  console.log(JSON.stringify({
    rawStatus: raw.status(),
    rawTitle: html.match(/<title>([^<]*)<\/title>/)?.[1] ?? null,
    rawHasH1: /<h1/.test(html),
    rawNoindex: /<meta name="robots" content="noindex/.test(html),
    pageStatus: resp?.status(),
    title: await page.title(),
    h1,
    errors,
  }));
} finally {
  await browser.close();
}
