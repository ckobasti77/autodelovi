// Independent verification of motion-3d-08: Back to "/" restores the wrong scrollY.
// Faithful steps x3, then variants to find the real cause/scope.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot, watch } from "./kit.mjs";

const engine = process.env.ENGINE ?? "chromium";
const width = Number(process.env.W ?? 1440);
const height = Number(process.env.H ?? 900);
const runs = Number(process.env.RUNS ?? 3);
const target = Number(process.env.TARGET ?? 1800);
const via = process.env.VIA ?? "/delovi"; // header link href to leave through
const out = [];
const browser = await launch(engine);

const st = (page) =>
  page.evaluate(() => {
    const s = window.__sklop3d?.getState?.();
    const track = document.querySelector('[data-testid="hero-track"]');
    return {
      path: location.pathname,
      y: Math.round(scrollY),
      docH: document.documentElement.scrollHeight,
      maxY: document.documentElement.scrollHeight - innerHeight,
      trackH: track ? Math.round(track.getBoundingClientRect().height) : null,
      p: s?.progress,
      stage: s?.stage,
      status: s?.status,
      cur: document.querySelector('[aria-current="step"]')?.textContent?.trim().slice(0, 22),
      restoration: history.scrollRestoration,
    };
  });

for (let r = 1; r <= runs; r++) {
  const ctx = await newContext(browser, { width, height, mobile: width < 1024, tag: `v-m3d08-${r}`, engine });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(2500);
  // wheel-scroll in 300 px steps to the target
  let guard = 0;
  while ((await page.evaluate(() => scrollY)) < target - 5 && guard++ < 60) {
    const y = await page.evaluate(() => scrollY);
    await page.mouse.move(width / 2, height / 2);
    await page.mouse.wheel(0, Math.min(300, target - y));
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1500);
  const before = await st(page);
  if (r === 1) await shot(page, `verify/motion-3d/motion-3d-08-reproduce-${engine}-${width}-${target}-a-before`);
  // leave through the header link (mobile: header link may be hidden -> use a[href] anywhere visible)
  let link = page.locator(`header a[href="${via}"]:visible`).first();
  if (!(await link.count())) link = page.locator(`a[href="${via}"]:visible`).first();
  await link.click();
  await page.waitForURL((u) => u.pathname === via, { timeout: 60_000 });
  await page.waitForTimeout(2500);
  const onVia = await st(page);
  await page.goBack();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 60_000 });
  const series = [];
  for (let i = 0; i < 12; i++) {
    series.push(await st(page));
    await page.waitForTimeout(500);
  }
  if (r === 1) await shot(page, `verify/motion-3d/motion-3d-08-reproduce-${engine}-${width}-${target}-b-after-back`);
  const row = { run: r, engine, width, height, target, via, before, onVia, afterBack: series[0], after6s: series.at(-1), errors: log };
  out.push(row);
  console.log(
    `run ${r}: before y=${before.y} stage=${before.stage} (${before.cur}) docH=${before.docH} | on ${via} maxY=${onVia.maxY} docH=${onVia.docH} restoration=${onVia.restoration} | back y=${series[0].y} stage=${series[0].stage} (${series[0].cur}) docH=${series[0].docH} trackH=${series[0].trackH} | +6s y=${series.at(-1).y} stage=${series.at(-1).stage} docH=${series.at(-1).docH}`,
  );
  await ctx.close();
}
writeFileSync(
  `docs/qa/audit/verify/motion-3d/motion-3d-08-reproduce-${engine}-${width}-${target}-${via.replaceAll("/", "_")}.json`,
  JSON.stringify(out, null, 2),
);
await browser.close();
