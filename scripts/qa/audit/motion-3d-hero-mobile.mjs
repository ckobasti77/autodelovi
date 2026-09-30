// motion-3d: 3D explorer on a 390 px touch phone (Chromium mobile emulation + CDP touch gestures).
// idle → touch intent; page scroll over the canvas (never trapped); tap a part → bottom sheet;
// drag the sheet (peek → full → dismiss); parts list; Rasklopi; orientation change.
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

const out = [];
const note = (k, v) => {
  out.push({ k, v });
  console.log(k, typeof v === "string" ? v : JSON.stringify(v));
};
const browser = await launch();
const ctx = await newContext(browser, { width: 390, height: 844, tag: "m3d-hero-m" });
const page = await ctx.newPage();
const log = watch(page);
const cdp = await ctx.newCDPSession(page);
const glb = [];
page.on("request", (r) => {
  if (/\.glb|\.hdr/.test(r.url())) glb.push(r.url().replace(BASE, ""));
});
const st = () => page.evaluate(() => window.__sklop3d?.getState());
const swipe = async (x, y, dy, speed = 800) => {
  await cdp.send("Input.synthesizeScrollGesture", {
    x, y, yDistance: dy, gestureSourceType: "touch", speed, repeatCount: 1,
  });
  await page.waitForTimeout(500);
};
const touchDrag = async (x, y0, y1, steps = 12, stepMs = 16) => {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + ((y1 - y0) * i) / steps }] });
    await page.waitForTimeout(stepMs);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
};

await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 90_000 });
await page.waitForTimeout(6500);
note("idle 6.5 s on touch", { state: await st(), glb: glb.length, canvases: await page.locator('[data-testid="hero-canvas"] canvas').count() });

// Touch swipe on the copy → scroll intent.
await swipe(195, 600, -300);
note("after first swipe", { scrollY: await page.evaluate(() => scrollY), status: (await st()).status });
await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 150_000 });
await page.waitForTimeout(1500);
const trackTop = await page.evaluate(() => {
  const t = document.querySelector('[data-testid="hero-track"]');
  const h = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 56;
  return Math.round(t.getBoundingClientRect().top + scrollY - h);
});
await page.evaluate((y) => window.scrollTo(0, y), trackTop);
await page.waitForTimeout(1200);
note("ready at trackTop", { trackTop, state: await st() });

// Scroll gesture starting on the canvas: must scroll the page (pan-y) and explode the car.
const canvasBox = await page.locator('[data-testid="hero-canvas"] canvas').boundingBox();
note("canvas box", canvasBox);
const y0 = await page.evaluate(() => scrollY);
await swipe(195, 450, -350);
const y1 = await page.evaluate(() => scrollY);
await page.waitForTimeout(900);
note("swipe on canvas", { before: y0, after: y1, moved: y1 - y0, state: await st() });
await shot(page, "motion-3d/hero-m-after-canvas-swipe");
// Back to progress 0.
await page.evaluate((y) => window.scrollTo(0, y), trackTop);
await page.waitForTimeout(1500);

// Tap a part (scan a few points on the car).
let tapped = null;
for (const [fx, fy] of [[0.5, 0.62], [0.35, 0.66], [0.6, 0.58], [0.7, 0.66], [0.45, 0.7]]) {
  const x = Math.round(390 * fx);
  const y = Math.round(844 * fy);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(1800);
  const s = await st();
  if (s.selected) {
    tapped = { x, y, selected: s.selected };
    break;
  }
}
note("tap select", tapped);
if (tapped) {
  await page.waitForTimeout(1500);
  const sheet = await page.evaluate(() => {
    const p = document.querySelector('[data-testid="part-panel"]');
    const r = p?.getBoundingClientRect();
    return r ? { top: Math.round(r.top), height: Math.round(r.height), vh: innerHeight, visiblePct: +(((innerHeight - r.top) / innerHeight) * 100).toFixed(1) } : null;
  });
  note("sheet at open", sheet);
  note("products in sheet", await page.getByTestId("part-panel-product").count());
  await shot(page, "motion-3d/hero-m-sheet-peek");
  // Is page scroll still possible above the sheet (non-modal)?
  const ys = await page.evaluate(() => scrollY);
  await swipe(195, 200, -200);
  note("swipe above non-modal sheet", { before: ys, after: await page.evaluate(() => scrollY), selected: (await st()).selected });
  // Drag the handle up to full.
  const handle = page.locator('[data-testid="part-panel"] button[aria-label="Proširi panel"], [data-testid="part-panel"] button[aria-label="Smanji panel"]').first();
  const hb = await handle.boundingBox();
  note("handle box", hb);
  if (hb) {
    await touchDrag(hb.x + hb.width / 2, hb.y + hb.height / 2, 120, 14, 20);
    await page.waitForTimeout(1200);
    const full = await page.evaluate(() => {
      const p = document.querySelector('[data-testid="part-panel"]');
      const r = p.getBoundingClientRect();
      const h = p.querySelector('button[aria-label="Smanji panel"], button[aria-label="Proširi panel"]');
      return { top: Math.round(r.top), label: h?.getAttribute("aria-label") };
    });
    note("after drag up", full);
    await shot(page, "motion-3d/hero-m-sheet-full");
    // Fast flick down → dismiss.
    const hb2 = await handle.boundingBox();
    await touchDrag(hb2.x + hb2.width / 2, hb2.y + hb2.height / 2, 830, 6, 8);
    await page.waitForTimeout(1500);
    note("after flick down", {
      selected: (await st()).selected,
      panelVisible: await page.getByTestId("part-panel").isVisible().catch(() => false),
      url: page.url().replace(BASE, ""),
      active: await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.getAttribute("role")} ${document.activeElement?.getAttribute("aria-label")?.slice(0, 30)}`),
    });
    await shot(page, "motion-3d/hero-m-after-dismiss");
  }
}

// Parts list by tap.
await page.evaluate((y) => window.scrollTo(0, y), trackTop);
await page.waitForTimeout(1000);
await page.getByTestId("parts-list-trigger").tap();
await page.waitForTimeout(1200);
note("parts list open (tap)", await page.getByTestId("parts-list-dialog").isVisible().catch(() => false));
await shot(page, "motion-3d/hero-m-parts-list");
const item = page.getByTestId("parts-list-dialog").getByRole("button", { name: /^Akumulator/ }).first();
if (await item.isVisible().catch(() => false)) {
  await item.tap();
  await page.waitForTimeout(3500);
  const s = await st();
  note("picked Akumulator from list", { selected: s.selected, stage: s.stage, progress: +s.progress.toFixed(3), scrollY: await page.evaluate(() => scrollY) });
  await shot(page, "motion-3d/hero-m-list-akumulator");
  // Close with the close button.
  await page.locator('[data-testid="part-panel"] button[aria-label="Zatvori"]').first().tap().catch(() => {});
  await page.waitForTimeout(1200);
  note("after close button", { selected: (await st()).selected, active: await page.evaluate(() => `${document.activeElement?.tagName} ${document.activeElement?.getAttribute("data-testid")}`) });
}

// Rasklopi toggle.
await page.evaluate((y) => window.scrollTo(0, y), trackTop);
await page.waitForTimeout(1200);
const toggle = page.getByRole("button", { name: /^Rasklopi$|^Sklopi$/ }).first();
note("toggle label before", await toggle.textContent());
await toggle.tap();
await page.waitForTimeout(2500);
note("after Rasklopi tap", { state: await st(), scrollY: await page.evaluate(() => scrollY), label: await toggle.textContent().catch(() => null) });
await shot(page, "motion-3d/hero-m-rasklopi");

// Orientation change: portrait → landscape → portrait.
await page.evaluate((y) => window.scrollTo(0, y), trackTop);
await page.waitForTimeout(1200);
await page.setViewportSize({ width: 844, height: 390 });
await page.waitForTimeout(2500);
const land = await page.evaluate(() => {
  const c = document.querySelector('[data-testid="hero-canvas"] canvas');
  const m = document.querySelector('[data-testid="hero-track"] [role="img"]');
  const cr = c?.getBoundingClientRect();
  const mr = m?.getBoundingClientRect();
  return {
    canvasCss: cr && [Math.round(cr.width), Math.round(cr.height)],
    canvasBuf: c && [c.width, c.height],
    media: mr && [Math.round(mr.width), Math.round(mr.height)],
    frameH: Math.round(document.querySelector('[data-testid="hero-track"] .hero-frame').getBoundingClientRect().height),
    state: window.__sklop3d?.getState(),
    scrollY,
  };
});
note("landscape 844x390", land);
await shot(page, "motion-3d/hero-m-landscape");
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(2500);
note("back to portrait", await page.evaluate(() => {
  const c = document.querySelector('[data-testid="hero-canvas"] canvas');
  const cr = c?.getBoundingClientRect();
  return { canvasCss: cr && [Math.round(cr.width), Math.round(cr.height)], canvasBuf: c && [c.width, c.height], state: window.__sklop3d?.getState() };
}));
await shot(page, "motion-3d/hero-m-portrait-again");
note("errors", log);
writeFileSync("docs/qa/audit/motion-3d/hero-mobile.json", JSON.stringify(out, null, 2));
await browser.close();
