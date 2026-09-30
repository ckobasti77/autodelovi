// motion-3d (second reviewer): WebGL context loss → poster fallback, and the low tier (?3d=low)
// poster mode at 1440 and 390: status, which layer is visible, GLB requests, explode poster
// crossfade while scrolling, console errors.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/motion-3d";
const browser = await launch();
const rows = [];
const rec = (k, v) => {
  rows.push({ k, v });
  console.log(k, JSON.stringify(v));
};
const layers = (page) =>
  page.evaluate(() => {
    const track = document.querySelector('[data-testid="hero-track"]');
    const canvas = track?.querySelector("canvas");
    const imgs = [...(track?.querySelectorAll("picture img, img") ?? [])].map((i) => {
      let el = i;
      let op = 1;
      while (el && el !== track) {
        op *= parseFloat(getComputedStyle(el).opacity);
        el = el.parentElement;
      }
      return { src: (i.currentSrc || i.src).split("/").pop()?.slice(0, 40), op: +op.toFixed(2) };
    });
    return {
      state: window.__sklop3d?.getState?.() ?? null,
      canvas: canvas ? { op: getComputedStyle(canvas).opacity, vis: getComputedStyle(canvas).visibility } : null,
      imgs,
      status: track?.querySelector('[role="status"]')?.textContent?.trim().slice(0, 80) ?? null,
    };
  });

// 1) Context loss at 1440.
{
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "m3d-ctxloss" });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(1500);
  await page.mouse.move(900, 450);
  await page.mouse.move(950, 480);
  await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 150_000 });
  await page.waitForTimeout(1200);
  rec("ctx ready", await layers(page));
  const lost = await page.evaluate(() => {
    const c = document.querySelector('[data-testid="hero-track"] canvas');
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    const ext = gl?.getExtension("WEBGL_lose_context");
    if (!ext) return "no-ext";
    ext.loseContext();
    return "lost";
  });
  await page.waitForTimeout(2000);
  rec("ctx after loseContext", { lost, ...(await layers(page)) });
  await shot(page, "motion-3d/v2-ctxloss-1440", {});
  await page.mouse.wheel(0, 1200);
  await page.waitForTimeout(1500);
  rec("ctx after loss + scroll 1200", { scrollY: await page.evaluate(() => scrollY), ...(await layers(page)) });
  await shot(page, "motion-3d/v2-ctxloss-1440-scrolled", {});
  rec("ctx errors", log);
  await ctx.close();
}

// 2) Low tier at 390 (touch) and 1440.
for (const [w, h] of [
  [390, 844],
  [1440, 900],
]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `m3d-low-${w}` });
  const page = await ctx.newPage();
  const log = watch(page);
  const glb = [];
  page.on("request", (r) => {
    if (/\.glb|\.hdr/.test(r.url())) glb.push(r.url().split("/").pop());
  });
  await page.goto(`${BASE}/?3d=low`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(2000);
  if (w < 1024) await page.touchscreen.tap(195, 700);
  else await page.mouse.move(900, 450);
  await page.waitForTimeout(4000);
  rec(`low ${w} idle`, { glb: [...glb], ...(await layers(page)) });
  const trackTop = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="hero-track"]');
    return { top: Math.round(t.getBoundingClientRect().top + scrollY), h: t.offsetHeight };
  });
  await page.evaluate((y) => window.scrollTo(0, y), trackTop.top + trackTop.h * 0.5);
  await page.waitForTimeout(1500);
  rec(`low ${w} mid-track`, { trackTop, scrollY: await page.evaluate(() => scrollY), glb: [...glb], ...(await layers(page)) });
  await shot(page, `motion-3d/v2-low-${w}-midtrack`, {});
  rec(`low ${w} errors`, log);
  await ctx.close();
}
writeFileSync(`${OUT}/v2-fallback.json`, JSON.stringify(rows, null, 2));
await browser.close();
