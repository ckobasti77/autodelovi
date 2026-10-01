// FLOW-05 gate check: client-side title and h1 of page-thrown 404s on the production build.
import { chromium } from "@playwright/test";
const base = process.env.AUDIT_BASE ?? "http://localhost:3100";
const urls = ["/deo/nepostojeci", "/delovi/nepostojeca", "/upit/nepostojeci-token", "/porudzbina/nepostojeci-token", "/porudzbina/hvala/nepostojeci-token", "/vozila/nepostojeca", "/ponuda/ne-postoji"];
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ storageState: ".playwright/consent-state.json" });
  const page = await ctx.newPage();
  for (const u of urls) {
    const resp = await page.goto(base + u);
    const h1 = await page.getByRole("heading", { level: 1 }).first().textContent({ timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(500);
    console.log(JSON.stringify({ u, status: resp?.status(), title: await page.title(), h1: h1?.trim() }));
  }
} finally {
  await browser.close();
}
