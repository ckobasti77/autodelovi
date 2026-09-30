/**
 * xbrowser — pre-hydration typing on other server-rendered forms: /prijava (email + password),
 * home hero search. JS chunks delayed 6 s; types, waits for React, reads the DOM values.
 */
import { BASE, shot } from "./kit.mjs";
import { ENGINES, launch, saveJson, xctx } from "./xbrowser-lib.mjs";
const CASES = [
  { route: "/prijava", fields: [["[data-testid=auth-email] input, input[data-testid=auth-email]", "kupac@primer.rs"], ["[data-testid=auth-password] input, input[data-testid=auth-password]", "lozinka12345"]] },
  { route: "/", fields: [["[data-testid=hero-search-input] input, input[data-testid=hero-search-input]", "5Q0615505R"]] },
];
const out = {};
for (const engine of ENGINES) {
  const browser = await launch(engine);
  for (const c of CASES) {
    const key = `${engine}-390-${c.route}`;
    const context = await xctx(browser, engine, { width: 390, height: 844, tag: "prehydf" });
    const page = await context.newPage();
    await page.route("**/_next/static/chunks/**", async (route) => { await new Promise((r) => setTimeout(r, 6000)); await route.continue().catch(() => {}); });
    try {
      await page.goto(`${BASE}${c.route}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      const r = { typed: [], after: [] };
      for (const [sel, text] of c.fields) {
        const el = page.locator(sel).first();
        await el.waitFor({ timeout: 30_000 });
        r.hydratedAtType = await el.evaluate((e) => Object.keys(e).some((k) => k.startsWith("__reactProps")));
        await el.click();
        await page.keyboard.type(text, { delay: 15 });
        r.typed.push(await el.inputValue());
      }
      const first = c.fields[0][0];
      await page.waitForFunction((s) => { const e = document.querySelector(s.split(", ")[1]) ?? document.querySelector(s.split(", ")[0]); return e && Object.keys(e).some((k) => k.startsWith("__reactProps")); }, first, { timeout: 90_000 });
      await page.waitForTimeout(2500);
      for (const [sel] of c.fields) r.after.push(await page.locator(sel).first().inputValue());
      await shot(page, `xbrowser/prehydf-${engine}-390${c.route === "/" ? "_home" : c.route.replaceAll("/", "_")}`);
      out[key] = r;
    } catch (e) { out[key] = { error: String(e).slice(0, 200) }; }
    console.log(key, JSON.stringify(out[key]));
    await context.close();
  }
  await browser.close();
}
saveJson(`prehydration-forms-${ENGINES.join("_")}.json`, out);
