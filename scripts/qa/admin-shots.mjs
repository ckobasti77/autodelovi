/**
 * Admin screenshots (docs/qa/ADMIN.md): signs in as the seeded owner (SEED_ADMIN_EMAIL /
 * SEED_ADMIN_PASSWORD), then captures the given admin paths at 1440 and 1024 into
 * docs/qa/screens/step-15/. Console errors are printed per page.
 *   node scripts/qa/admin-shots.mjs [baseUrl] [path ...]
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3000";
const paths = process.argv.slice(3);
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
if (!email || !password) throw new Error("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");
const outDir = path.resolve("docs/qa/screens/step-15");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: `Mozilla/5.0 SklopQA-admin/${Date.now()}`,
  locale: "sr-Latn-RS",
  timezoneId: "Europe/Belgrade",
});
const page = await context.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${base}/prijava?next=%2Fadmin`, { waitUntil: "networkidle" });
await page.getByTestId("auth-email").fill(email);
await page.getByTestId("auth-password").fill(password);
await page.getByTestId("auth-submit").click();
await page.waitForURL(/\/admin/, { timeout: 60_000 });

const name = (p) =>
  (p.replace(/^\/admin\/?/, "").replace(/[/?=&]+/g, "_") || "pregled").slice(0, 60);
for (const width of [1440, 1024]) {
  await page.setViewportSize({ width, height: 900 });
  for (const p of paths.length ? paths : ["/admin"]) {
    errors.length = 0;
    await page.goto(`${base}${p}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const file = path.join(outDir, `${name(p)}-${width}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(
      `${width} ${p} → ${path.relative(process.cwd(), file)}${errors.length ? `  ERRORS: ${errors.join(" | ")}` : ""}`,
    );
  }
}
await browser.close();
