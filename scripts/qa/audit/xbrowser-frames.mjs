/**
 * xbrowser — frame pacing per engine while the hero 3D is live vs forced low tier (?3d=low):
 * rAF intervals during a scripted scroll through the hero track, and how long after the scroll
 * stops the hero stage/progress and the page reveal settle.
 */
import { BASE, revealCheck } from "./kit.mjs";
import { ENGINES, launch, saveJson, xctx } from "./xbrowser-lib.mjs";

const out = {};
for (const engine of ENGINES) {
  const browser = await launch(engine);
  for (const mode of ["live", "low"]) {
    const key = `${engine}-1440-${mode}`;
    const context = await xctx(browser, engine, { width: 1440, height: 900, tag: `fr${mode}` });
    const page = await context.newPage();
    try {
      await page.goto(`${BASE}/${mode === "low" ? "?3d=low" : ""}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
      await page.waitForFunction(() => Boolean(window.__sklop3d), null, { timeout: 120_000 });
      await page.evaluate(() => window.scrollTo(0, 80));
      await page.waitForFunction(() => window.__sklop3d?.ready === true || window.__sklop3d?.getState().tier === "low", null, { timeout: 120_000 });
      await page.waitForTimeout(1500);
      const res = await page.evaluate(async () => {
        const gaps = [];
        let last = performance.now();
        let run = true;
        const loop = (t) => {
          gaps.push(t - last);
          last = t;
          if (run) requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
        const H = window.innerHeight;
        for (let y = 80; y <= H * 3; y += 60) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 50));
        }
        const target = window.__sklop3d.getState();
        const tStop = performance.now();
        const settle = [];
        for (let i = 0; i < 40; i++) {
          await new Promise((r) => setTimeout(r, 250));
          const s = window.__sklop3d.getState();
          settle.push([Math.round(performance.now() - tStop), s.stage, Math.round(s.progress * 1000) / 1000]);
        }
        run = false;
        gaps.sort((a, b) => a - b);
        const q = (p) => Math.round(gaps[Math.floor(gaps.length * p)] ?? 0);
        return { frames: gaps.length, p50: q(0.5), p90: q(0.9), max: Math.round(gaps.at(-1) ?? 0), over500: gaps.filter((g) => g > 500).length, stateAtStop: { stage: target.stage, progress: target.progress }, settle };
      });
      const st = await page.evaluate(() => window.__sklop3d.getState());
      out[key] = { ...res, tier: st.tier, status: st.status, reveal: await revealCheck(page) };
      console.log(key, JSON.stringify({ tier: st.tier, frames: res.frames, p50: res.p50, p90: res.p90, max: res.max, over500: res.over500, stop: res.stateAtStop, settleFirst: res.settle[0], settleLast: res.settle.at(-1) }));
    } catch (e) {
      out[key] = { error: String(e).slice(0, 300) };
      console.log(key, "ERR", String(e).slice(0, 200));
    }
    await context.close();
  }
  await browser.close();
}
saveJson(`frames-${ENGINES.join("_")}.json`, out);
