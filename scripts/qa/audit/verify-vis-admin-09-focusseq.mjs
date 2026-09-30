// verify vis-admin-09: record the focus sequence when the cancel dialog opens from the „Promeni status“ menu.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "./kit.mjs";
const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-va09-seq" });
const page = await ctx.newPage();
await page.goto(`${BASE}/prijava?next=%2Fadmin`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForFunction(() => { const f = document.querySelector("[data-testid=auth-email]")?.closest("form"); return !!f && Object.keys(f).some((k) => k.startsWith("__reactProps")); }, null, { timeout: 180000 });
await page.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
await page.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
await page.getByTestId("auth-submit").click();
await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 180000 });
await page.goto(`${BASE}/admin/porudzbine/SK-2026-000092`, { waitUntil: "domcontentloaded", timeout: 120000 });
const menuBtn = page.getByRole("button", { name: "Promeni status" });
await menuBtn.waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate(() => {
  window.__seq = [];
  document.addEventListener("focusin", (e) => {
    const t = e.target;
    window.__seq.push(`${Math.round(performance.now())} ${t.tagName}${t.getAttribute("aria-label") ? `[${t.getAttribute("aria-label")}]` : ""} ${(t.textContent || "").trim().slice(0, 25)}${t.closest("[role=alertdialog]") ? " (in dialog)" : ""}`);
  }, true);
});
await menuBtn.click();
await page.evaluate(() => window.__seq.push("--- menu open"));
await page.getByRole("menuitem", { name: /Otkaži/ }).click();
await page.waitForTimeout(1200);
const seq = await page.evaluate(() => window.__seq);
await page.getByRole("alertdialog").getByRole("button", { name: "Odustani" }).click();
await page.waitForTimeout(500);
writeFileSync("docs/qa/audit/verify/vis-admin/vis-admin-09-reproduce-focus-sequence.json", JSON.stringify(seq, null, 2));
console.log(seq.join("\n"));
await browser.close();
