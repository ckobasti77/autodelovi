/**
 * xbrowser — text-reveal contract per engine, polled over time after an end-to-end scroll so
 * transient (mid-animation) states are separated from stuck ones. Routes: home, category,
 * product, /za-majstore, /upit.
 */
import { BASE, revealCheck, scrollThrough, shot } from "./kit.mjs";
import { ENGINES, VIEWS, launch, saveJson, xctx } from "./xbrowser-lib.mjs";

const ROUTES = (process.env.XB_ROUTES ?? "/,/delovi/kocioni-diskovi,/deo/kocioni-disk-prednji-276-24-mm-demo-0004,/za-majstore,/upit").split(",");
const out = {};
for (const engine of ENGINES) {
  const browser = await launch(engine);
  for (const v of VIEWS) {
    const context = await xctx(browser, engine, { width: v.width, height: v.height, tag: `rv${v.tag}` });
    const page = await context.newPage();
    for (const route of ROUTES) {
      const key = `${engine}-${v.tag}-${route}`;
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 90_000 });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(1200);
        await scrollThrough(page);
        const polls = [];
        for (let i = 0; i < 6; i++) {
          const r = await revealCheck(page);
          const detail = await page.evaluate(() => {
            const words = [...document.querySelectorAll(".reveal-word")];
            const parents = [...new Set(words.map((w) => w.parentElement))].slice(0, 6);
            return parents.map((p) => {
              const b = p.getBoundingClientRect();
              return `${p.tagName.toLowerCase()}[${p.getAttribute("data-reveal-state") ?? ""}] top=${Math.round(b.top + scrollY)} "${p.textContent.trim().slice(0, 50)}" op=${getComputedStyle(words.find((w) => w.parentElement === p)).opacity}`;
            });
          });
          polls.push({ t: i * 1500, stuck: r.stuck.length, stuckSample: r.stuck.slice(0, 5), pending: r.pending, words: r.words, detail });
          if (!r.stuck.length && !r.pending && !r.words) break;
          await page.waitForTimeout(1500);
        }
        out[key] = polls;
        const last = polls.at(-1);
        console.log(key, JSON.stringify({ polls: polls.length, last: { stuck: last.stuck, pending: last.pending, words: last.words }, first: polls[0].detail.slice(0, 2) }));
        if (last.stuck || last.pending || last.words) await shot(page, `xbrowser/reveal-stuck-${engine}-${v.tag}-${route.replaceAll("/", "_") || "home"}`);
      } catch (e) {
        out[key] = { error: String(e).slice(0, 300) };
        console.log(key, "ERR", String(e).slice(0, 200));
      }
    }
    await context.close();
  }
  await browser.close();
}
saveJson("reveal.json", out);
