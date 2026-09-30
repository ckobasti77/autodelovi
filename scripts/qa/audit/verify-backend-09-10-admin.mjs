/**
 * Step 21 audit — backend-09 / backend-10: what the owner sees on /admin and /admin/mejlovi.
 * Read-only: signs in as owner, captures the dashboard KPIs and the e-mail outbox, and lists
 * every heading / KPI label so the absence of an event-health view is recorded as text.
 * Output: docs/qa/audit/verify/backend/backend-09-reproduce-{dashboard,outbox}.webp + backend-09-10-admin.json
 */
import { writeFileSync } from "node:fs";

import { BASE, launch, loginAdmin, newContext, shot } from "./kit.mjs";

const browser = await launch("chromium");
const out = {};
try {
  const context = await newContext(browser, { width: 1440, height: 900, tag: "verify-b09" });
  const page = await context.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  out.dashboard = await page.evaluate(() => ({
    headings: [...document.querySelectorAll("main h1, main h2, main h3")].map((h) => h.textContent.trim()),
    text: document.querySelector("main")?.innerText.replace(/\s+/g, " ").slice(0, 2500),
  }));
  out.dashboardShot = await shot(page, "verify/backend/backend-09-reproduce-dashboard");
  await page.goto(`${BASE}/admin/mejlovi`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  out.outbox = await page.evaluate(() => ({
    headings: [...document.querySelectorAll("main h1, main h2, main h3")].map((h) => h.textContent.trim()),
    statusOptions: [...document.querySelectorAll("main select option, [role=option]")].map((o) => o.textContent.trim()),
    text: document.querySelector("main")?.innerText.replace(/\s+/g, " ").slice(0, 1200),
  }));
  out.outboxShot = await shot(page, "verify/backend/backend-09-reproduce-outbox");
  const mentions = (s) => /događaj|dogadjaj|neuspel|zaglavljen|dead|failed/i.test(s ?? "");
  out.mentionsEventHealth = { dashboard: mentions(out.dashboard.text), outbox: mentions(out.outbox.text) };
  await context.close();
} finally {
  await browser.close();
}
writeFileSync("docs/qa/audit/verify/backend/backend-09-10-admin.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
