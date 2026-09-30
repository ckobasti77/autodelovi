/**
 * Step 18 screenshots (docs/qa/NOTIFICATIONS.md): admin outbox, message sheet, template
 * gallery (desktop / phone / text), Podešavanja → Obaveštenja, Korisnici → Obaveštenja at
 * 1440 and 1024; the order status notices and the unsubscribe page at 1440 and 390.
 *   SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… node scripts/qa/notifications-shots.mjs [baseUrl] [orderToken]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3100";
const orderToken = process.argv[3];
const outDir = path.resolve("docs/qa/screens/step-18");
mkdirSync(outDir, { recursive: true });
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password) throw new Error("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD required");

const browser = await chromium.launch();
const errors = [];

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900);
}

async function adminContext(width) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.on(
    "console",
    (m) => m.type() === "error" && errors.push(`${width} ${page.url()}: ${m.text()}`),
  );
  await page.goto(`${base}/prijava?next=%2Fadmin`);
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL(/\/admin$/, { timeout: 60_000 });
  return { context, page };
}

for (const width of [1440, 1024]) {
  const { context, page } = await adminContext(width);
  await page.goto(`${base}/admin/mejlovi`);
  await page.getByRole("table").getByRole("row").nth(2).waitFor({ timeout: 30_000 });
  await settle(page);
  await page.screenshot({ path: path.join(outDir, `admin-outbox-${width}.png`) });
  if (width === 1440) {
    await page.getByRole("table").getByRole("row").nth(1).click();
    await page.getByRole("dialog", { name: "Poruka" }).waitFor();
    await settle(page);
    await page.screenshot({ path: path.join(outDir, `admin-outbox-message-${width}.png`) });
    await page.keyboard.press("Escape");
  }
  for (const [query, tag] of [
    ["sablon=order_confirmed", "desktop"],
    ["sablon=staff_daily_digest&prikaz=telefon", "phone"],
    ["sablon=quote_ready&prikaz=tekst", "text"],
  ]) {
    await page.goto(`${base}/admin/mejlovi/sabloni?${query}`);
    await page.getByTestId("template-preview").waitFor({ timeout: 30_000 });
    await settle(page);
    await page.screenshot({
      path: path.join(outDir, `admin-templates-${tag}-${width}.png`),
      fullPage: tag !== "text",
    });
  }
  await page.goto(`${base}/admin/podesavanja?tab=obavestenja`);
  await page.getByRole("radiogroup", { name: "Režim slanja" }).waitFor({ timeout: 30_000 });
  await settle(page);
  await page.screenshot({
    path: path.join(outDir, `admin-settings-notifications-${width}.png`),
    fullPage: true,
  });
  await page.goto(`${base}/admin/korisnici`);
  await page.getByRole("table").getByRole("button", { name: "Obaveštenja" }).first().click();
  await page.getByRole("dialog").getByRole("table").waitFor({ timeout: 30_000 });
  await settle(page);
  await page.screenshot({ path: path.join(outDir, `admin-users-prefs-${width}.png`) });
  await context.close();
}

for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: width < 500 ? 2 : 1,
    isMobile: width < 500,
    hasTouch: width < 500,
  });
  const page = await context.newPage();
  page.on(
    "console",
    (m) => m.type() === "error" && errors.push(`${width} ${page.url()}: ${m.text()}`),
  );
  if (orderToken) {
    await page.goto(`${base}/porudzbina/${orderToken}`);
    await page.getByTestId("order-notices").waitFor({ timeout: 30_000 });
    await settle(page);
    await page.getByTestId("order-notices").scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(outDir, `order-status-notices-${width}.png`) });
  }
  await page.goto(`${base}/obavestenja/odjava/nepostojeci-token-aaaaaaaaaaaaaaaaaaaaaaaa`);
  await settle(page);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(outDir, `unsubscribe-${width}.png`) });
  await context.close();
}

await browser.close();
console.log(JSON.stringify({ errors }, null, 2));
