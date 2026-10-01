/**
 * VIS-02 re-verification extras (package cart-mechanic-overlays, step 22):
 *  - accessible name + visible size of the bar buttons at 390 (inquiry is icon-only below sm);
 *  - reverse keyboard walk (Shift+Tab from the bar) — no stop fully under the bar;
 *  - reduced motion: same forward walk;
 *  - html scroll-padding-bottom / --bottom-inset removed after „Očisti“ and after client navigation;
 *  - no console errors.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/cart-mechanic-overlays-verify-vis02-extra.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, watch } from "../audit/kit.mjs";
import { loginMechanic } from "../audit/flows-import-mech-lib.mjs";

const OUT = "docs/qa/fix/cart-mechanic-overlays/verify";
const SHOT = "../fix/cart-mechanic-overlays/verify";
mkdirSync(OUT, { recursive: true });
const LINES = ["5Q0 615 505 R 2", "036 121 959 P", "038 121 662 1", "1K0 615 868 F x2", "1K0 615 540 Q", "1K0 413 165 G", "1K0 698 406 F 4", "3C0 413 232", "5Q0 121 200 E", "03L 115 549 DA 3", "ZZ9999999 3", "1K0 121 753 QN", "04L 105 204 K"];
const BAR = `document.querySelector('[data-testid="mechanic-quick-order-add-all"]')?.closest('.sticky')`;
const results = {};

async function check(page) {
  await page.goto(`${BASE}/majstor/brza-porudzbina`, { waitUntil: "load", timeout: 120000 });
  await page.getByTestId("mechanic-quick-order-input").waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.getByTestId("mechanic-quick-order-input").fill(LINES.join("\n"));
  await page.getByTestId("mechanic-quick-order-check").click();
  await page.waitForFunction(
    () => document.querySelectorAll('[data-testid="mechanic-quick-order-row"]').length > 0 && !document.querySelector('[data-testid="mechanic-quick-order-row"][data-status="pending"]'),
    null,
    { timeout: 60000 },
  );
  await page.getByTestId("mechanic-quick-order-add-all").waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
}

const probe = (page) =>
  page.evaluate((barJs) => {
    const a = document.activeElement;
    if (!a || a === document.body) return { body: true };
    const bar = eval(barJs);
    const r = a.getBoundingClientRect();
    const inBar = !!bar?.contains(a);
    const pts = [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2], [r.left + r.width / 2, r.top + r.height / 2]];
    let byBar = 0;
    for (const [x, y] of pts) {
      if (y < 0 || y > innerHeight - 1 || x < 0 || x > innerWidth - 1) continue;
      const t = document.elementFromPoint(x, y);
      if (bar && !inBar && t && bar.contains(t)) byBar++;
    }
    const inRows = !!a.closest('[data-testid="mechanic-quick-order-row"]');
    return { inBar, inRows, byBar, label: (a.getAttribute("aria-label") || a.textContent || a.tagName).trim().replace(/\s+/g, " ").slice(0, 40) };
  }, BAR);

const html = (page) =>
  page.evaluate(() => ({
    spb: document.documentElement.style.scrollPaddingBottom || "(none)",
    inset: document.documentElement.style.getPropertyValue("--bottom-inset") || "(none)",
    computedSpb: getComputedStyle(document.documentElement).scrollPaddingBottom,
  }));

const browser = await launch();
try {
  for (const [w, h, reduce] of [[390, 844, false], [1440, 900, true], [390, 844, true]]) {
    const key = `${w}${reduce ? "-reduce" : ""}`;
    const ctx = await newContext(browser, { width: w, height: h, tag: `vfyvis${key}`, reducedMotion: reduce ? "reduce" : "no-preference" });
    const page = await ctx.newPage();
    const log = watch(page);
    const r = (results[key] = {});
    try {
      await loginMechanic(page, "/majstor");
      await check(page);
      r.htmlWithResults = await html(page);

      // Bar buttons: accessible names and boxes.
      r.barButtons = await page.evaluate((barJs) => {
        const bar = eval(barJs);
        return [...bar.querySelectorAll("button")].map((b) => {
          const box = b.getBoundingClientRect();
          const visibleText = [...b.querySelectorAll("span")].filter((s) => getComputedStyle(s).position !== "absolute" && s.textContent.trim()).map((s) => s.textContent.trim()).join(" ");
          return { testid: b.getAttribute("data-testid"), ariaLabel: b.getAttribute("aria-label"), text: b.textContent.trim(), visibleText, w: Math.round(box.width), h: Math.round(box.height), title: b.getAttribute("title") };
        });
      }, BAR);
      const inquire = page.getByTestId("mechanic-quick-order-inquire");
      r.inquireAccessibleName = (await inquire.count()) ? await inquire.evaluate((el) => el.textContent.trim()) : null;
      r.inquireRoleMatch = (await inquire.count()) ? await page.getByRole("button", { name: /Pošalji upit za nepronađene/ }).count() : null;
      r.barH = await page.evaluate((barJs) => Math.round(eval(barJs).getBoundingClientRect().height), BAR);

      // Forward walk (reduced motion) and reverse walk from the bar.
      for (const dir of ["forward", "reverse"]) {
        if (dir === "forward") await page.getByTestId("mechanic-quick-order-check").focus();
        else {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForTimeout(300);
          await page.getByTestId("mechanic-quick-order-add-all").focus();
        }
        let stops = 0, hidden = 0, partly = 0;
        const hiddenList = [];
        for (let i = 0; i < 90; i++) {
          await page.keyboard.press(dir === "forward" ? "Tab" : "Shift+Tab");
          await page.waitForTimeout(100);
          const p = await probe(page);
          if (p.body) break;
          if (!p.inRows) {
            if (dir === "reverse" && !p.inBar) break; // left the result list upwards
            if (dir === "forward" && !p.inBar && stops > 0) break;
            continue;
          }
          stops++;
          if (p.byBar === 5) {
            hidden++;
            hiddenList.push(p.label);
          } else if (p.byBar > 0) partly++;
        }
        r[dir] = { stops, hidden, partly, hiddenList };
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      if (!reduce) r.shot = await shot(page, `${SHOT}/vis02-extra-${key}-top`);

      // „Očisti“ → bar gone → inset removed.
      const clear = page.getByRole("button", { name: /^Očisti/ }).first();
      if (await clear.count()) {
        await clear.click();
        await page.waitForTimeout(1200);
        r.htmlAfterClear = await html(page);
        r.barAfterClear = await page.evaluate((barJs) => !!eval(barJs), BAR);
      }
      // Re-check, then client-navigate to „Pregled“ → inset removed.
      await check(page);
      r.htmlBeforeNav = await html(page);
      const nav = page.getByRole("link", { name: "Pregled" }).first();
      if (await nav.count()) {
        await nav.click();
        await page.waitForURL((u) => u.pathname === "/majstor", { timeout: 60000 });
        await page.waitForTimeout(1500);
        r.htmlAfterClientNav = await html(page);
      }
    } catch (e) {
      r.error = String(e).slice(0, 300);
    } finally {
      r.console = log.console.slice(0, 5);
      r.pageErrors = log.pageErrors.slice(0, 5);
      console.log(key, JSON.stringify(r));
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/vis02-extra.json`, JSON.stringify(results, null, 1));
