/**
 * Step 19 screenshots (docs/qa/SEO-ADS.md): the consent banner (first visit, granular view,
 * reopened from the footer), a programmatic landing (intro, generations, FAQ, links), the ads
 * landing `/ponuda/…` and the admin pages (Izvori, Podešavanja → SEO / Praćenje / Oglasne
 * strane) at 1440 and 390 (admin at 1440).
 *   node scripts/qa/seo-shots.mjs [baseUrl] [landingPath]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3100";
const landingPath = process.argv[3] ?? "/delovi/amortizeri-opruge/volkswagen/golf";
const outDir = path.resolve("docs/qa/screens/step-19");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const errors = [];

async function shoot(width, height, name, fn, { fullPage = false, context: ctxOpts = {} } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: width < 500 ? 2 : 1,
    ...ctxOpts,
  });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`${name}@${width}: ${m.text()}`));
  page.on("pageerror", (e) => errors.push(`${name}@${width}: ${e.message}`));
  await fn(page);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(outDir, `${name}-${width}.png`), fullPage });
  await context.close();
}

for (const [w, h] of [
  [1440, 900],
  [390, 844],
]) {
  await shoot(w, h, "banner-home", async (p) => {
    await p.goto(`${base}/`, { waitUntil: "networkidle" });
  });
  await shoot(w, h, "banner-settings", async (p) => {
    await p.goto(`${base}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
    await p.getByTestId("consent-banner").getByRole("button", { name: "Podešavanja" }).click();
  });
  await shoot(
    w,
    h,
    "landing",
    async (p) => {
      await p.goto(`${base}${landingPath}`, { waitUntil: "networkidle" });
      await p.getByTestId("consent-banner").getByRole("button", { name: "Odbij sve" }).click();
      for (let y = 0; y < 12000; y += 700) {
        await p.mouse.wheel(0, 700);
        await p.waitForTimeout(120);
      }
    },
    { fullPage: true },
  );
  await shoot(
    w,
    h,
    "ponuda",
    async (p) => {
      await p.goto(`${base}/ponuda/kocione-plocice-golf`, { waitUntil: "networkidle" });
      await p.getByTestId("consent-banner").getByRole("button", { name: "Odbij sve" }).click();
      for (let y = 0; y < 6000; y += 700) {
        await p.mouse.wheel(0, 700);
        await p.waitForTimeout(120);
      }
    },
    { fullPage: true },
  );
}

// Admin (owner) at 1440.
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (email && password) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(`admin: ${m.text()}`));
  await page.goto(`${base}/prijava?next=%2Fadmin`, { waitUntil: "networkidle" });
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL(/\/admin$/, { timeout: 60_000 });
  for (const [name, url] of [
    ["admin-izvori", "/admin/izvori?"],
    ["admin-seo", "/admin/podesavanja?tab=seo"],
    ["admin-pracenje", "/admin/podesavanja?tab=pracenje"],
    ["admin-oglasne-strane", "/admin/podesavanja?tab=oglasne-strane"],
    ["admin-upiti", "/admin/upiti?status=sve"],
  ]) {
    await page.goto(`${base}${url}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, `${name}-1440.png`), fullPage: true });
  }
  await page.goto(`${base}/admin/podesavanja?tab=oglasne-strane`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Izmeni" }).first().click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, `admin-oglasna-strana-editor-1440.png`), fullPage: true });
  await context.close();
} else {
  console.log("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — admin shots skipped");
}

await browser.close();
console.log(errors.length ? `console errors:\n${errors.join("\n")}` : "no console errors");
