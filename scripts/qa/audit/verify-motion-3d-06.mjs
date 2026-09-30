import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
const browser = await launch();
const runs = [];
const read = (page) => page.evaluate(() => {
  const s = window.__sklop3d?.getState();
  const cur = document.querySelector('[aria-current="step"]');
  const cap = document.querySelector('[data-testid="stage-caption"]') ;
  return { path: location.pathname, scrollY: Math.round(window.scrollY), progress: s?.progress, stage: s?.stage, status: s?.status, ariaCurrent: cur?.getAttribute("aria-label") ?? null, phone: document.querySelector("nav + div p")?.textContent ?? null };
});
async function run(i, { from = "/delovi", scroll = 1500, width = 1440, height = 900 } = {}) {
  const ctx = await newContext(browser, { width, height, tag: `v06-${i}` });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${from}`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  await page.evaluate((y) => window.scrollTo(0, y), scroll);
  await page.waitForTimeout(800);
  const startY = await page.evaluate(() => window.scrollY);
  await page.getByRole("link", { name: /SKLOP — početna/ }).first().click();
  await page.waitForURL((u) => u.pathname === "/", { timeout: 20000 });
  const samples = [];
  for (const t of [500, 2500, 8000]) {
    await page.waitForTimeout(t - (samples.at(-1)?.t ?? 0));
    samples.push({ t, ...(await read(page)) });
  }
  if (i === 0 || (width === 390 && i >= 10)) await shot(page, `verify/motion-3d/motion-3d-06-reproduce-${width}-run${i}`);
  runs.push({ i, from, scroll, width, startY, samples });
  await ctx.close();
}
for (let i = 0; i < 4; i++) await run(i);
await run(4, { from: "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", scroll: 1200 });
await run(5, { from: "/delovi", scroll: 0 });
await run(10, { from: "/delovi", scroll: 1500, width: 390, height: 844 });
await browser.close();
writeFileSync("docs/qa/audit/verify/motion-3d/motion-3d-06-reproduce.json", JSON.stringify(runs, null, 1));
for (const r of runs) console.log(r.i, r.from, r.width, "startY", r.startY, r.samples.map((s) => `${s.t}ms y${s.scrollY} p${s.progress} st${s.stage} ${s.status} [${s.ariaCurrent ?? s.phone}]`).join(" || "));
