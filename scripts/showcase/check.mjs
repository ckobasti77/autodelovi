// Checks docs/showcase/index.html the way the client opens it: from disk, without a server.
//
//   node scripts/showcase/check.mjs [--shots <dir>]
//
// At 1440 and 390 px it scrolls the page end to end and fails on: a request that is not a local
// file, a console message or page error, an image that did not load, a link whose target is
// missing, horizontal overflow, or a lightbox that does not open, step and hand focus back.
// `--shots` also saves the page in viewport-high pieces for a look.
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const shotsDir = args.includes("--shots") ? resolve(args[args.indexOf("--shots") + 1]) : null;
if (shotsDir) mkdirSync(shotsDir, { recursive: true });

const file = resolve("docs/showcase/index.html");
const url = pathToFileURL(file).href;
const problems = [];

const browser = await chromium.launch();
for (const [tag, viewport] of [
  ["1440", { width: 1440, height: 900 }],
  ["390", { width: 390, height: 844 }],
]) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: tag === "390",
    hasTouch: tag === "390",
    locale: "sr-Latn-RS",
  });
  const page = await context.newPage();
  const requests = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("requestfailed", (r) => problems.push(`${tag}: request failed ${r.url()}`));
  page.on("console", (m) => problems.push(`${tag}: console ${m.type()} ${m.text().slice(0, 160)}`));
  page.on("pageerror", (e) => problems.push(`${tag}: pageerror ${e.message}`));

  await page.goto(url, { waitUntil: "load" });
  // Lazy images load as they come near the viewport: walk the whole page.
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += Math.round(viewport.height * 0.8)) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(120);
  }
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);

  const external = requests.filter((r) => !r.startsWith("file:") && !r.startsWith("data:"));
  if (external.length)
    problems.push(`${tag}: external requests ${external.slice(0, 5).join(", ")}`);

  const state = await page.evaluate(() => ({
    images: [...document.images].map((img) => ({
      src: img.getAttribute("src"),
      ok: img.complete && img.naturalWidth > 0,
      ratioOff:
        img.naturalWidth > 0 &&
        Math.abs(img.naturalWidth / img.naturalHeight - img.width / img.height) > 0.02 &&
        !img.closest(".tall"),
    })),
    links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")),
    overflow: document.documentElement.scrollWidth - window.innerWidth,
    fonts: [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family),
    square: [
      ...document.querySelectorAll(".frame, .btn, .titleblock, .compare, .icon-btn, .news li"),
    ].filter((el) => parseFloat(getComputedStyle(el).borderTopLeftRadius) === 0).length,
  }));
  for (const img of state.images) {
    if (!img.src || img.src.startsWith("data:")) continue;
    if (!img.ok) problems.push(`${tag}: image did not load ${img.src}`);
    if (img.ratioOff) problems.push(`${tag}: image shown at the wrong ratio ${img.src}`);
    if (!existsSync(resolve(dirname(file), img.src)))
      problems.push(`${tag}: image missing ${img.src}`);
  }
  for (const href of state.links) {
    if (href.startsWith("#")) {
      if (!(await page.locator(`[id="${href.slice(1)}"]`).count()))
        problems.push(`${tag}: anchor without a target ${href}`);
    } else if (/^[a-z]+:/i.test(href)) {
      problems.push(`${tag}: link leaves the folder ${href}`);
    } else if (!existsSync(resolve(dirname(file), href.split("#")[0]))) {
      problems.push(`${tag}: link target missing ${href}`);
    }
  }
  if (state.overflow > 0) problems.push(`${tag}: horizontal overflow ${state.overflow}px`);
  if (state.square) problems.push(`${tag}: ${state.square} box(es) with square corners`);

  // Lightbox: open on the first frame, step forward, close, focus back on the opener.
  await page.evaluate(() => window.scrollTo(0, 0));
  const first = page.locator(".frame").first();
  await first.scrollIntoViewIfNeeded();
  await first.click();
  const dialog = page.locator("dialog#lb");
  if (!(await dialog.evaluate((d) => d.open))) problems.push(`${tag}: lightbox did not open`);
  const before = await page.locator("#lb-img").getAttribute("src");
  await page.keyboard.press("ArrowRight");
  const after = await page.locator("#lb-img").getAttribute("src");
  if (before === after) problems.push(`${tag}: lightbox did not step`);
  await page.keyboard.press("Escape");
  const focusBack = await first.evaluate((el) => document.activeElement === el);
  if (!focusBack) problems.push(`${tag}: focus did not return to the opener`);

  if (shotsDir) {
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const piece = tag === "1440" ? 2700 : 3376;
    await page.setViewportSize({ width: viewport.width, height: piece });
    for (let i = 0, y = 0; y < total; i += 1, y += piece) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(500);
      await page.screenshot({
        path: resolve(shotsDir, `showcase-${tag}-${String(i).padStart(2, "0")}.png`),
      });
    }
  }
  console.log(
    `${tag}: ${state.images.length} images, ${state.links.length} links, ${requests.length} requests (${external.length} external), fonts ${[...new Set(state.fonts)].join(" / ")}, overflow ${state.overflow}px`,
  );
  await context.close();
}
await browser.close();

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(
  `\n${fileURLToPath(url)}: no external requests, no console messages, every image and link resolves`,
);
