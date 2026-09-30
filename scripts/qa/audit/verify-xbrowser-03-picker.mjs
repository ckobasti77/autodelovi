/**
 * Verify xbrowser-03 — vehicle picker dialog top edge across steps (1440x900 and 1024x768).
 * Samples the dialog's top every animation frame for 1.5 s after each click, per engine.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, shot } from "./kit.mjs";
import { xctx } from "./xbrowser-lib.mjs";
const engines = (process.env.XB_ENGINES ?? "chromium,firefox,webkit").split(",");
const width = Number(process.env.XB_W ?? 1440), height = Number(process.env.XB_H ?? 900);
const route = process.env.XB_ROUTE ?? "/delovi/kocioni-diskovi";
const out = { width, height, route, engines: {} };
mkdirSync("docs/qa/audit/verify/xbrowser", { recursive: true });
for (const engine of engines) {
  const res = { steps: [] };
  const browser = await launch(engine);
  try {
    const ctx = await xctx(browser, engine, { width, height, tag: "vpick" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 120_000 });
    await page.waitForTimeout(3000);
    const sample = async (label, action) => {
      await page.evaluate(() => {
        window.__tops = [];
        const t0 = performance.now();
        const tick = () => {
          const d = document.querySelector('[role="dialog"]');
          const h = d?.querySelector("h2");
          const crumb = d ? [...d.querySelectorAll("p")].find((p) => /\d\/4/.test(p.textContent)) : null;
          if (d) {
            const r = d.getBoundingClientRect();
            window.__tops.push({ t: Math.round(performance.now() - t0), top: Math.round(r.top), h: Math.round(r.height), title: h ? Math.round(h.getBoundingClientRect().top) : null, crumb: crumb ? Math.round(crumb.getBoundingClientRect().top) : null, skel: !!d.querySelector('[aria-busy="true"], .skeleton, [data-skeleton]') });
          }
          if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      await action();
      await page.waitForTimeout(1700);
      const tops = await page.evaluate(() => window.__tops);
      // compress: keep distinct top values
      const distinct = [];
      for (const s of tops) if (!distinct.length || distinct.at(-1).top !== s.top || distinct.at(-1).skel !== s.skel) distinct.push(s);
      const last = tops.at(-1);
      res.steps.push({ label, final: last, distinct: distinct.slice(0, 12) });
      console.log(engine, label, "final", JSON.stringify(last), "distinct", distinct.length);
      await shot(page, `verify/xbrowser/xbrowser-03-reproduce-${engine}-${width}-${label}`);
    };
    const trigger = page.getByRole("button", { name: /Izaberite vozilo/ }).first();
    await sample("0-brand", () => trigger.click());
    const dlg = page.getByRole("dialog", { name: "Izaberite vozilo" });
    await sample("1-model", () => dlg.getByRole("button", { name: "Volkswagen", exact: true }).click());
    await sample("2-generation", () => dlg.getByRole("button", { name: /^Golf$/ }).first().click());
    await sample("3-engine", () => dlg.getByRole("button", { name: /Golf VII/ }).first().click());
    await ctx.close();
  } catch (e) { res.error = String(e).slice(0, 300); console.log(engine, res.error); }
  await browser.close();
  out.engines[engine] = res;
}
writeFileSync(`docs/qa/audit/verify/xbrowser/xbrowser-03-reproduce-${width}.json`, JSON.stringify(out, null, 2));
