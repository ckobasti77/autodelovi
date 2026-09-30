// Skeptic verification of motion-3d-04: stage jumps / deep links landing on the next stage label.
// Tests DPR 1/2/3, several widths, WebKit, reduced motion, the desktop index and the phone stepper.
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/motion-3d";
mkdirSync(OUT, { recursive: true });
const results = [];
const only = process.argv[2] ?? "all";

async function read(page) {
  return page.evaluate(() => {
    const s = window.__sklop3d?.getState?.();
    const cur = document.querySelector('nav [aria-current="step"]');
    const phone = document.querySelector(".lg\\:hidden p.truncate");
    return {
      scrollY: window.scrollY,
      dpr: window.devicePixelRatio,
      progress: s?.progress,
      stage: s?.stage,
      selected: s?.selected,
      timeline: s?.timeline,
      reducedMotion: s?.reducedMotion,
      ariaCurrent: cur?.getAttribute("aria-label") ?? null,
      phoneLabel: phone?.textContent?.trim() ?? null,
    };
  });
}

async function waitHooks(page) {
  await page.waitForFunction(() => !!window.__sklop3d, null, { timeout: 60000 });
}

async function deepLink(browser, { width, height, dpr = 1, reducedMotion = "no-preference", slug = "kocioni-diskovi", tag, engine = "chromium", capture = false }) {
  const ctx = await newContext(browser, { width, height, deviceScaleFactor: dpr, reducedMotion, tag: "v04s", engine });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/?deo=${slug}`, { waitUntil: "domcontentloaded" });
  await waitHooks(page);
  await page.waitForTimeout(5000);
  const r = await read(page);
  const r2 = await (async () => { await page.waitForTimeout(1500); return read(page); })();
  let img = null;
  if (capture) img = await shot(page, `verify/motion-3d/motion-3d-04-skeptic-${tag}`);
  results.push({ scenario: `deeplink ${slug}`, tag, width, height, dpr, reducedMotion, engine, first: r, settled: r2, img });
  await ctx.close();
}

async function desktopIndex(browser, { width, height, dpr = 1, buttons, tag }) {
  const ctx = await newContext(browser, { width, height, deviceScaleFactor: dpr, tag: "v04s" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await waitHooks(page);
  await page.waitForTimeout(3000);
  for (const b of buttons) {
    const btn = page.locator(`nav[aria-label="Faze rasklapanja"] button[aria-label^="${b} "]`);
    await btn.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);
    const r = await read(page);
    let img = null;
    if (b === "03") img = await shot(page, `verify/motion-3d/motion-3d-04-skeptic-${tag}-btn03`);
    results.push({ scenario: `index button ${b}`, tag, width, dpr, state: r, img });
  }
  await ctx.close();
}

async function phoneStepper(browser, { width, height, dpr, tag, engine = "chromium" }) {
  const ctx = await newContext(browser, { width, height, deviceScaleFactor: dpr, mobile: true, tag: "v04s", engine });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await waitHooks(page);
  await page.waitForTimeout(3000);
  const seq = [];
  seq.push({ step: "start", ...(await read(page)) });
  const next = page.getByRole("button", { name: "Sledeća faza" });
  const prev = page.getByRole("button", { name: "Prethodna faza" });
  for (let i = 1; i <= 4; i++) {
    await next.click();
    await page.waitForTimeout(3000);
    seq.push({ step: `next#${i}`, ...(await read(page)) });
  }
  let img = await shot(page, `verify/motion-3d/motion-3d-04-skeptic-${tag}-after-next`);
  for (let i = 1; i <= 3; i++) {
    await prev.click();
    await page.waitForTimeout(3000);
    seq.push({ step: `prev#${i}`, ...(await read(page)) });
  }
  const img2 = await shot(page, `verify/motion-3d/motion-3d-04-skeptic-${tag}-after-prev`);
  results.push({ scenario: "phone stepper", tag, width, dpr, engine, seq, img: [img, img2] });
  await ctx.close();
}

const browser = await launch("chromium");
try {
  if (only === "all" || only === "deep") {
    await deepLink(browser, { width: 1440, height: 900, dpr: 1, tag: "deeplink-1440-dpr1", capture: true });
    await deepLink(browser, { width: 1440, height: 900, dpr: 2, tag: "deeplink-1440-dpr2" });
    await deepLink(browser, { width: 1920, height: 1080, dpr: 1, tag: "deeplink-1920-dpr1" });
    await deepLink(browser, { width: 1280, height: 800, dpr: 1, tag: "deeplink-1280-dpr1" });
    await deepLink(browser, { width: 390, height: 844, dpr: 3, tag: "deeplink-390-dpr3", capture: true });
    await deepLink(browser, { width: 1440, height: 900, dpr: 1, reducedMotion: "reduce", tag: "deeplink-1440-reduced" });
    await deepLink(browser, { width: 1440, height: 900, dpr: 1, slug: "abs-senzori", tag: "deeplink-abs-1440" });
  }
  if (only === "all" || only === "index") {
    await desktopIndex(browser, { width: 1440, height: 900, buttons: ["03", "02", "05"], tag: "index-1440" });
  }
  if (only === "all" || only === "phone") {
    await phoneStepper(browser, { width: 390, height: 844, dpr: 3, tag: "phone-390-dpr3" });
  }
} finally {
  await browser.close();
}
if (only === "all" || only === "webkit") {
  const wk = await launch("webkit");
  try {
    await deepLink(wk, { width: 390, height: 844, dpr: 3, tag: "deeplink-390-webkit", engine: "webkit" });
    await deepLink(wk, { width: 1440, height: 900, dpr: 1, tag: "deeplink-1440-webkit", engine: "webkit" });
  } finally {
    await wk.close();
  }
}
const file = `${OUT}/motion-3d-04-skeptic-${only}.json`;
writeFileSync(file, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 1));
