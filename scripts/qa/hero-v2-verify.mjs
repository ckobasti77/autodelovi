// Independent check of the hero v2 (docs/3d/HERO-V2.md §18.5) on the real GPU: one real wheel
// scroll through the whole track and back in 40 px notches (every notch checked once the scene
// has caught up), then every stage at rest, at 1440×900 and 390×844.
//
//   node scripts/qa/hero-v2-verify.mjs [--base http://localhost:3100] [--out .playwright/hero-verify]
//        [--only desktop|mobile] [--shots docs/qa/screens/hero-v2/final]
//
// Measured from the pixels of the page, not from what the scene says about itself:
//   - every docked part against the night field: share of the cell it covers, luminance of its
//     pixels (median, 10th and 90th percentile) and the contrast of the median against the field;
//   - the honesty caption: pixels of the car or a part under its box (the caption is hidden for
//     that capture), at every stage and at every sample of the scroll, both directions;
//   - the car's roof: lit pixels on the first rows of the canvas (a clipped car reaches them);
//   - the navigator: every chip inside the row, the row not scrollable, no edge fade, at each
//     stage (the counts change the chips' text);
//   - label boxes against each other and against the cells of other slots.
// Exits 1 when a check fails or the console has an error.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const BASE = arg("--base", "http://localhost:3100");
const OUT = join(process.cwd(), arg("--out", ".playwright/hero-verify"));
const SHOTS = arg("--shots", null);
const ONLY = arg("--only", null);
mkdirSync(OUT, { recursive: true });
if (SHOTS) mkdirSync(join(process.cwd(), SHOTS), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Slots the owner named as too dark; the report marks them. */
const NAMED = ["akumulator", "kocione-plocice", "termostat-creva", "kocione-celjusti", "ulja-tecnosti"];
/** A part reads on the field when the median of its pixels has this contrast against it. */
const MIN_CONTRAST = 3;
/** Below this share of its cell a part counts as thin (see the contrast check). */
const THIN = 0.05;

const VIEWPORTS = [
  { name: "desktop", tier: "high", context: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
  {
    name: "mobile",
    tier: "mid",
    context: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  },
].filter((v) => !ONLY || v.name === ONLY);

const lin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;

/** Pixels of `rect` (CSS px) that differ from the field by more than `threshold` levels. */
function lit(image, rect, field, threshold = 14) {
  const { data, info, scale } = image;
  const x0 = Math.max(0, Math.round(rect.x * scale));
  const y0 = Math.max(0, Math.round(rect.y * scale));
  const x1 = Math.min(info.width, Math.round((rect.x + rect.w) * scale));
  const y1 = Math.min(info.height, Math.round((rect.y + rect.h) * scale));
  const lums = [];
  let total = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * info.width + x) * info.channels;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      total += 1;
      if (Math.max(Math.abs(r - field[0]), Math.abs(g - field[1]), Math.abs(b - field[2])) > threshold) {
        lums.push(luminance(r, g, b));
      }
    }
  }
  lums.sort((a, b) => a - b);
  return { count: lums.length, share: total ? lums.length / total : 0, lums };
}

async function capture(page, scale) {
  const png = await page.screenshot({ type: "png" });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  return { png, data, info, scale };
}

/** Layout of the hero as the DOM has it (CSS px, viewport coordinates). */
const readLayout = () => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };
  const visible = (el) => {
    if (!el) return false;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return cs.visibility !== "hidden" && cs.display !== "none" && r.width > 0 && r.height > 0;
  };
  // The boxes of the text itself, word by word: a paragraph's own box has empty corners.
  const words = (el) => {
    if (!el || !visible(el)) return [];
    const out = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        if (r.width > 0 && r.height > 0) out.push({ x: r.left, y: r.top, w: r.width, h: r.height });
      }
    }
    return out;
  };
  const canvas = document.querySelector('[data-testid="hero-canvas"]');
  const captions = [...document.querySelectorAll("[data-hero-honesty]")].filter(visible);
  // From 1440 px the assembled car carries the note in its title block instead.
  const titleBlock = visible(document.querySelector("[data-hero-title-block]"));
  const row = document.querySelector('[data-testid="hero-nav"] nav ol');
  const rowBox = box(row);
  const chips = [...document.querySelectorAll('[data-testid="hero-nav"] button[data-system]')].map((chip) => ({
    system: chip.dataset.system,
    text: chip.textContent.trim(),
    box: box(chip),
  }));
  const rowStyle = row ? getComputedStyle(row) : null;
  return {
    state: window.__sklop3d.getState(),
    canvas: box(canvas),
    band: box(document.querySelector("[data-hero-band]")),
    captions: captions.map(box),
    titleBlock,
    captionWords: captions.flatMap(words),
    introWords: words(document.querySelector("[data-hero-intro]")),
    headingWords: words(document.querySelector("[data-hero-grid] > p")),
    labelWords: [...document.querySelectorAll("[data-page-active] [data-label]")].flatMap(words),
    // The sticky frame is in place (past the end of the track it scrolls away with the page).
    pinned: (() => {
      const frame = document.querySelector(".hero-frame").getBoundingClientRect();
      const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64;
      return Math.abs(frame.top - header) < 1.5;
    })(),
    cells: [...document.querySelectorAll("[data-page-active] [data-cell]")].map((cell) => ({
      slug: cell.dataset.cell,
      box: box(cell),
      image: Boolean(cell.querySelector("img")),
    })),
    labels: [...document.querySelectorAll("[data-page-active] [data-slot]")].map((link) => {
      const label = link.querySelector("[data-label]");
      const cs = label ? getComputedStyle(label) : null;
      return {
        slug: link.dataset.slot,
        box: box(label),
        lines: label && cs ? Math.round(label.getBoundingClientRect().height / parseFloat(cs.lineHeight)) : 0,
      };
    }),
    nav: {
      row: rowBox,
      scrollable: row ? row.scrollWidth - row.clientWidth : 0,
      mask: rowStyle ? rowStyle.maskImage || rowStyle.webkitMaskImage : "",
      chips,
    },
    end: [...document.querySelectorAll('[data-testid="hero-end"] button, [data-testid="hero-end"] a')].map((el) => ({
      text: (el.textContent.trim() || el.getAttribute("aria-label")) ?? "",
      bg: getComputedStyle(el).backgroundColor,
      border: getComputedStyle(el).borderTopColor,
      box: box(el),
    })),
    slots: window.__sklop3d.slots(),
    car: window.__sklop3d.car ? window.__sklop3d.car() : null,
  };
};

const overlap = (a, b) =>
  a && b && a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
const failures = [];
const report = {};

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ ...vp.context, locale: "sr-Latn-RS" });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 240)));
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 240)));
  const scale = vp.context.deviceScaleFactor;
  const fail = (text) => failures.push(`${vp.name}: ${text}`);
  const out = (report[vp.name] = { stages: {}, scroll: {} });

  await page.goto(`${BASE}/?3d=${vp.tier}`, { waitUntil: "load" });
  await sleep(1200);
  const decline = page.getByRole("button", { name: "Odbij sve" });
  if (await decline.count()) await decline.first().click();
  await sleep(500);
  await page.evaluate(() => window.scrollTo(0, 0));
  if (vp.name === "desktop") await page.mouse.move(980, 620);
  else await page.touchscreen.tap(195, 150);
  await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120000 });
  await sleep(1600);
  const field = await page.evaluate(() => {
    // The first opaque background above the hero is the field the scene is drawn on.
    for (let el = document.querySelector('[data-testid="hero-track"]'); el; el = el.parentElement) {
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || Number(m[3]) === 1)) return m.slice(0, 3).map(Number);
    }
    return [13, 15, 17];
  });
  const fieldLum = luminance(...field);

  // Hides the DOM that sits over the canvas, so a capture shows only what the scene draws.
  const bare = await page.addStyleTag({
    content: `html.qa-bare [data-hero-honesty], html.qa-bare [data-hero-grid] [data-label],
      html.qa-bare [data-hero-grid] [data-tick], html.qa-bare [data-hero-grid] > p,
      html.qa-bare [data-hero-intro], html.qa-bare [data-testid="hero-end"] { visibility: hidden !important; }`,
  });
  void bare;
  const setBare = (on) => page.evaluate((v) => document.documentElement.classList.toggle("qa-bare", v), on);

  /** Car or parts under the caption, and lit pixels on the canvas's first rows. */
  const sceneChecks = async (label, where) => {
    const layout = await page.evaluate(readLayout);
    await setBare(true);
    await sleep(60);
    const image = await capture(page, scale);
    // The text must be where it was read: mid-scroll the note changes place with the page
    // (bottom of the stage at the assembled car, its own line once docked).
    await setBare(false);
    const after = await page.evaluate(readLayout);
    const same =
      after.state.page === layout.state.page &&
      JSON.stringify(after.captionWords.map((w) => Math.round(w.y))) === JSON.stringify(layout.captionWords.map((w) => Math.round(w.y))) &&
      after.introWords.length === layout.introWords.length;
    let under = 0;
    let top = 0;
    if (layout.pinned && same) {
      for (const word of [...layout.captionWords, ...layout.introWords]) under += lit(image, word, field).count;
      top = layout.canvas ? lit(image, { ...layout.canvas, h: 2 }, field, 18).count : 0;
    }
    const checked = layout.pinned && same;
    where[label] = { p: +layout.state.progress.toFixed(4), page: layout.state.page, captionPx: under, topPx: top, pinned: layout.pinned, checked };
    return { layout, image, under, top, checked };
  };

  /** Waits until the scene has caught up with the scroll: the store's progress stands still. */
  const settle = async () => {
    let last = -1;
    for (let i = 0; i < 40; i += 1) {
      const now = await page.evaluate(() => window.__sklop3d.getState().progress);
      if (Math.abs(now - last) < 1e-4) return now;
      last = now;
      await sleep(80);
    }
    return last;
  };
  const pinned = () =>
    page.evaluate(() => {
      const frame = document.querySelector(".hero-frame").getBoundingClientRect();
      const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64;
      return Math.abs(frame.top - header) < 1.5;
    });

  // ---------------------------------------------------------------- real scroll, forward and back
  const distance = await page.evaluate(() => {
    const track = document.querySelector('[data-testid="hero-track"]');
    return track.offsetHeight - track.querySelector(".hero-frame").offsetHeight;
  });
  // 40 px a notch: a part's flight is about 120 px of scroll on both widths, so every flight is
  // seen at three points or more. After each notch the scene is left to catch up, so a sample is
  // the picture of one progress — a pose is a pure function of it — and every sample is checked.
  const step = 40;
  let unchecked = 0;
  let worstCaption = 0;
  let worstTop = 0;
  const walk = async (direction) => {
    const samples = {};
    // Wheel until the page has stopped past the track's end (events are dropped under load).
    const count = Math.ceil((distance + 200) / step) * 3;
    let done = 0;
    for (let i = 0; i < count && done < 3; i += 1) {
      const before = await page.evaluate(() => window.scrollY);
      await page.mouse.wheel(0, direction * step);
      await sleep(90);
      const now = await page.evaluate(() => ({ y: window.scrollY, p: window.__sklop3d.getState().progress }));
      const past = direction > 0 ? now.p >= 0.9999 : now.p <= 0.0001;
      done = past || now.y === before ? done + 1 : 0;
      await settle();
      // Past the end of the track the frame scrolls away with the page: that is not a stage.
      if (!(await pinned())) continue;
      const label = `${direction > 0 ? "f" : "b"}${String(i).padStart(3, "0")}`;
      let result = await sceneChecks(label, samples);
      for (let attempt = 0; attempt < 3 && !result.checked; attempt += 1) {
        await settle();
        result = await sceneChecks(label, samples);
      }
      if (!result.checked) {
        unchecked += 1;
        fail(`scroll sample ${label} could not be checked`);
      }
      worstCaption = Math.max(worstCaption, result.under);
      worstTop = Math.max(worstTop, result.top);
    }
    await sleep(900);
    return samples;
  };
  out.scroll.forward = await walk(1);
  const atEnd = await page.evaluate(() => window.__sklop3d.getState());
  if (!atEnd.ended || atEnd.found !== 44) fail(`forward scroll ended at ${JSON.stringify(atEnd)}`);
  out.scroll.back = await walk(-1);
  const atStart = await page.evaluate(() => window.__sklop3d.getState());
  if (atStart.page !== 0 || atStart.found !== 0) fail(`backward scroll ended at ${JSON.stringify(atStart)}`);
  out.scroll.worst = { captionPx: worstCaption, topPx: worstTop };
  out.scroll.samples = {
    forward: Object.keys(out.scroll.forward).length,
    back: Object.keys(out.scroll.back).length,
    unchecked,
  };
  if (worstTop > 0) fail(`the car reaches the top edge of the canvas during the scroll (${worstTop} px lit)`);
  if (worstCaption > 0) fail(`${worstCaption} px of the car or a part under the caption or the intro during the scroll`);

  // ---------------------------------------------------------------- every stage at rest
  const stages = [
    ["0-assembled", () => window.__sklop3d.explode(0)],
    ...[1, 2, 3, 4, 5, 6].map((n) => [`${n}-page`, `window.__sklop3d.page(${n})`]),
    ["7-end", () => window.__sklop3d.explode(1)],
  ];
  for (const [name, action] of stages) {
    await page.evaluate(action);
    await sleep(1700);
    const stage = (out.stages[name] = {});
    const { layout, image, under, top } = await sceneChecks("scene", stage);
    if (under > 0) fail(`${name}: ${under} px of the car or a part under the caption`);
    if (top > 0) fail(`${name}: the car is clipped at the top (${top} px lit on the first rows)`);
    if (layout.captions.length + (layout.titleBlock ? 1 : 0) !== 1) {
      fail(`${name}: ${layout.captions.length} captions visible, title block ${layout.titleBlock}`);
    }

    // docked parts: do they read on the field?
    stage.parts = {};
    for (const cell of layout.cells) {
      const hit = lit(image, cell.box, field, 8);
      // A wiper blade or a sensor lead is a few pixels wide: most of its pixels are the edge's
      // blend with the field, so its upper quartile stands for the part itself.
      const thin = hit.share < THIN;
      const median = quantile(hit.lums, thin ? 0.75 : 0.5);
      const entry = {
        named: NAMED.includes(cell.slug),
        image: cell.image,
        thin,
        share: +hit.share.toFixed(3),
        contrast: +contrast(median, fieldLum).toFixed(2),
        p10: +contrast(quantile(hit.lums, 0.1), fieldLum).toFixed(2),
        p90: +contrast(quantile(hit.lums, 0.9), fieldLum).toFixed(2),
      };
      stage.parts[cell.slug] = entry;
      if (hit.share < 0.012) fail(`${name}: ${cell.slug} covers ${(hit.share * 100).toFixed(1)} % of its cell`);
      else if (entry.contrast < MIN_CONTRAST) fail(`${name}: ${cell.slug} median contrast ${entry.contrast}:1`);
    }

    // nothing of the scene under a name or under the page heading
    let underNames = 0;
    for (const word of [...layout.labelWords, ...layout.headingWords]) underNames += lit(image, word, field).count;
    stage.underNames = underNames;
    if (underNames > 0) fail(name + ": " + underNames + " px of the scene under a name or the page heading");

    // labels: two lines at most, no label on another label or on another slot's cell
    for (const [i, a] of layout.labels.entries()) {
      if (a.lines > 2) fail(`${name}: ${a.slug} name takes ${a.lines} lines`);
      for (const b of layout.labels.slice(i + 1)) if (overlap(a.box, b.box)) fail(`${name}: names ${a.slug} / ${b.slug} overlap`);
      for (const cell of layout.cells) if (cell.slug !== a.slug && overlap(a.box, cell.box)) fail(`${name}: name ${a.slug} on the cell of ${cell.slug}`);
    }
    for (const caption of layout.captions) {
      for (const cell of layout.cells) if (overlap(caption, cell.box)) fail(`${name}: the caption is on the cell of ${cell.slug}`);
      for (const label of layout.labels) if (overlap(caption, label.box)) fail(`${name}: the caption is on the name of ${label.slug}`);
    }
    // the scene's own report: drift and size
    // Part ↔ cell: where the scene rests a part against the cell the DOM has now (the float is a
    // ±3 px bob on top of that, reported apart).
    const live = new Map(layout.cells.map((cell) => [cell.slug, cell.box]));
    const off = (s, x, y) => {
      const cell = live.get(s.slug);
      return cell ? Math.hypot(x + layout.canvas.x - (cell.x + cell.w / 2), y + layout.canvas.y - (cell.y + cell.h / 2)) : 0;
    };
    stage.drift = Math.max(0, ...layout.slots.map((s) => off(s, s.rx, s.ry)));
    stage.driftDrawn = Math.max(0, ...layout.slots.map((s) => off(s, s.cx, s.cy)));
    stage.size = layout.slots.map((s) => Math.max(s.w, s.h));
    if (stage.drift > 4) fail(`${name}: part ↔ cell drift ${stage.drift.toFixed(1)} px`);
    if (stage.driftDrawn > 8) fail(`${name}: drawn part ${stage.driftDrawn.toFixed(1)} px from its cell`);
    stage.car = layout.car;

    // navigator
    const nav = layout.nav;
    stage.nav = { scrollable: nav.scrollable, mask: nav.mask === "none" ? "none" : "fade", chips: nav.chips.map((c) => c.text).join(" | ") };
    if (vp.name === "desktop") {
      if (nav.scrollable > 0) fail(`${name}: the navigator row scrolls (${nav.scrollable} px)`);
      if (nav.mask && nav.mask !== "none") fail(`${name}: the navigator row has an edge fade`);
      for (const chip of nav.chips) {
        if (chip.box.x < nav.row.x - 0.5 || chip.box.x + chip.box.w > nav.row.x + nav.row.w + 0.5) {
          fail(`${name}: chip ${chip.system} is outside the row`);
        }
      }
    }
    if (name === "7-end") stage.end = layout.end;

    const file = `${vp.name}-${name}.webp`;
    await sharp(await page.screenshot({ type: "png" })).webp({ quality: 84 }).toFile(join(OUT, file));
    if (SHOTS) await sharp(await page.screenshot({ type: "png" })).webp({ quality: 84 }).toFile(join(process.cwd(), SHOTS, file));
  }

  if (errors.length) fail(`console errors: ${errors.slice(0, 4).join(" · ")}`);
  out.errors = errors;
  await context.close();
}

await browser.close();
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 1));

for (const [name, vp] of Object.entries(report)) {
  console.log(
    `\n== ${name}: scroll ${vp.scroll.samples.forward} samples forward + ${vp.scroll.samples.back} back, ${vp.scroll.samples.unchecked} not checked · ` +
      `worst under the note or the intro ${vp.scroll.worst.captionPx} px · worst on the top rows ${vp.scroll.worst.topPx} px · console errors ${vp.errors.length}`,
  );
  for (const [stage, s] of Object.entries(vp.stages)) {
    const parts = Object.entries(s.parts ?? {});
    const low = parts.filter(([, p]) => p.contrast < MIN_CONTRAST).map(([slug, p]) => `${slug} ${p.contrast}`);
    const all = parts.map(([, p]) => p.contrast);
    console.log(
      `${stage}: caption ${s.scene.captionPx} px · top ${s.scene.topPx} px · drift ${s.drift?.toFixed(1)} px (drawn ${s.driftDrawn?.toFixed(1)})` +
        (all.length ? ` · contrast ${Math.min(...all)}–${Math.max(...all)}` : "") +
        (low.length ? ` · LOW ${low.join(", ")}` : "") +
        ` · nav scroll ${s.nav.scrollable} px, ${s.nav.mask}`,
    );
    const named = parts.filter(([, p]) => p.named).map(([slug, p]) => `${slug} ${p.p10}/${p.contrast}/${p.p90}`);
    if (named.length) console.log(`   named (p10/median/p90): ${named.join(" · ")}`);
    if (s.end) console.log(`   end: ${s.end.map((b) => `${b.text} [${b.bg}]`).join(" · ")}`);
  }
}
if (failures.length) {
  console.log(`\nFAILED (${failures.length})`);
  for (const f of failures) console.log(" - " + f);
  process.exit(1);
}
console.log("\nall checks passed");
