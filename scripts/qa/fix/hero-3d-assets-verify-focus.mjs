// Step 22 verifier (hero-3d-assets, MOT-01): part focus with the new tablet/phone cameras
// (FOCUS_FILL per crop). Selects a category through the test hook at p = 1 and screenshots the
// viewport so the focused part can be checked against the panel/bottom sheet.
// Usage: AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/hero-3d-assets-verify-focus.mjs
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "../audit/kit.mjs";

const browser = await launch();
const out = [];
try {
  for (const [w, h] of [
    [390, 844],
    [768, 1024],
    [1023, 768],
  ]) {
    const ctx = await newContext(browser, { width: w, height: h, tag: `vfy-m01-focus-${w}` });
    try {
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
      await page.goto(`${BASE}/?3d=mid`, { waitUntil: "networkidle" });
      await page.waitForTimeout(800);
      const y = await page.evaluate(() => {
        const t = document.querySelector('[data-testid="hero-track"]');
        const hh = document.querySelector("header")?.getBoundingClientRect().height ?? 64;
        return Math.round(t.getBoundingClientRect().top + scrollY - hh);
      });
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.evaluate(() =>
        document.querySelector('[data-testid="home-hero"]').dispatchEvent(new FocusEvent("focusin", { bubbles: true })),
      );
      await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
      await page.waitForTimeout(1200);
      for (const slug of ["kocione-plocice", "turbina"]) {
        const ok = await page.evaluate((s) => window.__sklop3d.selectPart(s), slug);
        await page.waitForTimeout(2200);
        const st = await page.evaluate(() => {
          const s = window.__sklop3d.getState();
          const dialog = document.querySelector('[role="dialog"]');
          const r = dialog?.getBoundingClientRect();
          return { selected: s.selected, progress: +s.progress.toFixed(2), panel: r ? [Math.round(r.top), Math.round(r.bottom)] : null };
        });
        await shot(page, `../fix/hero-3d-assets/verify/focus-${w}x${h}-${slug}`);
        out.push({ viewport: `${w}x${h}`, slug, ok, ...st, errors: [...errors] });
        console.log(`${w}x${h} ${slug}: ok ${ok} ${JSON.stringify(st)} errors ${errors.length}`);
        await page.keyboard.press("Escape");
        await page.waitForTimeout(1200);
      }
    } finally {
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync("docs/qa/fix/hero-3d-assets/verify/focus.json", JSON.stringify(out, null, 2));
