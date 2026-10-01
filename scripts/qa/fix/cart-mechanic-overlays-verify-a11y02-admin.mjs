/**
 * A11Y-02 re-verification, admin (a11y-app-03): command palette focus return.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/cart-mechanic-overlays-verify-a11y02-admin.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "../audit/kit.mjs";
import { loginAdminSafe } from "../audit/flows-import-mech-lib.mjs";

const OUT = "docs/qa/fix/cart-mechanic-overlays/verify";
mkdirSync(OUT, { recursive: true });
const results = [];
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const label = (el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    let fv = false;
    try {
      fv = el.matches(":focus-visible");
    } catch {}
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${label}"${el.getAttribute("data-vfy") === "opener" ? " (OPENER)" : ""}${fv ? " :focus-visible" : ""}`;
  });

const browser = await launch();
try {
  for (const [w, h] of [[1440, 900], [390, 844]]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: `vfy02a${w}` });
    const page = await ctx.newPage();
    try {
      await loginAdminSafe(page);
      await page.goto(`${BASE}/admin/porudzbine`, { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(3000);

      // a) Ctrl+K from a focused link in <main>.
      const link = page.locator("main a:visible, main button:visible, main input:visible").first();
      if (await link.count()) {
        await link.focus();
        await link.evaluate((el) => el.setAttribute("data-vfy", "opener"));
        const rec = { w, case: "Ctrl+K from main link", before: await act(page) };
        await page.keyboard.press("Control+k");
        await page.waitForTimeout(1500);
        rec.dialogOpen = await page.locator("[role=dialog]:visible").count();
        rec.afterOpen = await act(page);
        await page.keyboard.type("SK-", { delay: 50 });
        await page.waitForTimeout(800);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
        if (await page.locator("[role=dialog]:visible").count()) await page.keyboard.press("Escape");
        await page.waitForTimeout(1000);
        rec.after = await act(page);
        await page.keyboard.press("Tab");
        await page.waitForTimeout(300);
        rec.afterNextTab = await act(page);
        results.push(rec);
        console.log(JSON.stringify(rec));
        await link.evaluate((el) => el.removeAttribute("data-vfy")).catch(() => {});
      }

      // b) Top-bar palette button (Enter), then Escape.
      const trig = page.locator("button:visible").filter({ hasText: /Broj porudžbine, OEM/ }).first();
      const trigAlt = page.locator("header button[aria-label*='Pretraga' i]:visible, header button[aria-keyshortcuts]:visible").first();
      const t = (await trig.count()) ? trig : trigAlt;
      if (await t.count()) {
        await t.focus();
        await t.evaluate((el) => el.setAttribute("data-vfy", "opener"));
        const rec = { w, case: "top-bar palette button", before: await act(page) };
        await page.keyboard.press("Enter");
        await page.waitForTimeout(1500);
        rec.dialogOpen = await page.locator("[role=dialog]:visible").count();
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1000);
        rec.after = await act(page);
        results.push(rec);
        console.log(JSON.stringify(rec));
      } else results.push({ w, case: "top-bar palette button", skipped: "not found" });

      // c) Ctrl+K with nothing focused (fresh load, focus on <body>): fallback.
      await page.goto(`${BASE}/admin`, { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(3000);
      {
        const rec = { w, case: "Ctrl+K from body", before: await act(page) };
        await page.keyboard.press("Control+k");
        await page.waitForTimeout(1500);
        rec.dialogOpen = await page.locator("[role=dialog]:visible").count();
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1000);
        rec.after = await act(page);
        results.push(rec);
        console.log(JSON.stringify(rec));
      }
    } catch (e) {
      results.push({ w, error: String(e).slice(0, 300) });
      console.log("ERR", String(e).slice(0, 300));
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/a11y02-admin-palette.json`, JSON.stringify(results, null, 1));
