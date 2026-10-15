// Checks the built logo kit (step 33: the star arc). Exits non-zero if any check fails.
// Usage: node scripts/brand/logo/verify.mjs   (after build.mjs)
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";
import sharp from "sharp";
import { assertClean } from "./lib/export.mjs";
import { svgToPng } from "./lib/render.mjs";
import { opticalGaps } from "./lib/spacing.mjs";
import {
  ARCS,
  HINTED,
  PIXEL_STARS,
  STACKED,
  STAR,
  THEMES,
  arcStars,
  lockupSvg,
  star,
  starByStroke,
  wordBlock,
} from "./logo.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const PUBLIC = path.join(ROOT, "public/brand");
const EXPORT = path.join(ROOT, "docs/brand/export");
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const raw = async (png) => sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const VARIANTS = ["night", "paper", "navy", "black", "white"];

// 1. SVG hygiene: only <svg>, <title>, <path>; viewBox present; no text, fonts, raster, styles.
{
  const files = (await readdir(PUBLIC)).filter((f) => f.endsWith(".svg"));
  let bad = "";
  let bytes = 0;
  for (const f of files) {
    const svg = await readFile(path.join(PUBLIC, f), "utf8");
    bytes += svg.length;
    try {
      assertClean(svg, f);
      const tags = new Set([...svg.matchAll(/<([a-zA-Z]+)/g)].map((m) => m[1]));
      for (const t of tags)
        if (!["svg", "title", "path"].includes(t)) throw new Error(`${f}: unexpected <${t}>`);
    } catch (e) {
      bad += `${e.message}; `;
    }
  }
  check(`SVG hygiene (${files.length} files, ${(bytes / 1024).toFixed(0)} KB in total)`, !bad, bad);
}

// 2. One ink per file, the variant's own; the orange accent appears in no logo file.
{
  let bad = "";
  for (const f of (await readdir(PUBLIC)).filter((x) =>
    /-(night|paper|navy|black|white)\.svg$/.test(x),
  )) {
    const svg = await readFile(path.join(PUBLIC, f), "utf8");
    const variant = f.match(/-(night|paper|navy|black|white)\.svg$/)[1];
    const fills = [...svg.matchAll(/fill="(#[0-9a-f]{3,6})"/gi)].map((m) => m[1].toLowerCase());
    const ink = THEMES[variant].ink.toLowerCase();
    const short = ink.replace(/^#(.)\1(.)\2(.)\3$/, "#$1$2$3");
    const paths = (svg.match(/<path /g) ?? []).length;
    // SVGO drops fill="#000" (the default fill), so the black variant carries no fill at all
    const own =
      variant === "black"
        ? fills.length === 0
        : fills.length === 1 && (fills[0] === ink || fills[0] === short);
    if (paths !== 1 || !own) bad += `${f}: ${paths} paths, fills ${fills.join(",") || "none"}; `;
    if (/ff6b1a/i.test(svg)) bad += `${f}: orange; `;
  }
  check(
    "one ink per file, no accent",
    !bad,
    bad || "every lockup is a single path in its variant's ink",
  );
}

// 3. Optimised SVG renders like the unoptimised source (SVGO did not move anything).
{
  let worst = 0;
  let worstName = "";
  for (const [kind, file] of [
    ["stacked", "logo-stacked-night.svg"],
    ["horizontal", "logo-horizontal-paper.svg"],
    ["wordmark", "logo-wordmark-white.svg"],
    ["mark", "mark-navy.svg"],
    ["markSmall", "mark-small-night.svg"],
    ["oemParts", "oem-parts-black.svg"],
  ]) {
    const variant = file.match(/-(night|paper|navy|black|white)\.svg$/)[1];
    const source = lockupSvg(kind, THEMES[variant]).svg;
    const optimised = await readFile(path.join(PUBLIC, file), "utf8");
    const a = await raw(svgToPng(source, 1600, "#808080"));
    const b = await raw(svgToPng(optimised, 1600, "#808080"));
    let diff = 0;
    for (let i = 0; i < a.data.length; i += 4) if (Math.abs(a.data[i] - b.data[i]) > 24) diff++;
    const share = diff / (a.info.width * a.info.height);
    if (share > worst) {
      worst = share;
      worstName = file;
    }
  }
  check(
    "optimised SVG = source artwork",
    worst < 0.0005,
    `largest difference ${(worst * 100).toFixed(4)} % of pixels (${worstName})`,
  );
}

// 4. The star: the exact outline equals the polygon with a round-join hairline (Skia's stroke).
{
  const doc = (d) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path fill="#000" fill-rule="evenodd" d="${d}"/></svg>`;
  let worst = 0;
  for (const tip of [-90, -50, 17, 133, 222]) {
    const [x, y] = await Promise.all(
      [star(50, 50, 40, tip), starByStroke(50, 50, 40, tip)].map((d) =>
        sharp(svgToPng(doc(d), 1000, "#FFFFFF"))
          .raw()
          .toBuffer(),
      ),
    );
    let off = 0;
    for (let i = 0; i < x.length; i += 4) if (Math.abs(x[i] - y[i]) > 64) off++;
    worst = Math.max(worst, off);
  }
  check(
    "star outline exact",
    worst === 0,
    `inner ${STAR.inner}, round join ${STAR.join} R · ${worst} of 10⁶ pixels differ from the stroke expansion`,
  );
}

// 5. The arcs: counts, growth, every star turned to the arc, open on the right, no star touching
//    its neighbour, the text block right of the arc's centre.
{
  const detail = [];
  let ok = true;
  const expect = { stacked: 12, compact: 10, medium: 7, small: 5 };
  for (const [name, spec] of Object.entries(ARCS)) {
    const stars = arcStars(spec);
    const growth = spec.r0 / spec.r1;
    const grows = stars.every((s, i) => i === 0 || s.R > stars[i - 1].R);
    const turned = stars.every((s) => {
      const a =
        (Math.atan2((s.y - spec.cy) / (spec.ry ?? spec.rx), (s.x - spec.cx) / spec.rx) * 180) /
        Math.PI;
      return Math.abs(((((a - s.tip) % 360) + 540) % 360) - 180) < 1e-6;
    });
    const gap = Math.min(
      ...stars.slice(1).map((s, i) => {
        const p = stars[i];
        return Math.hypot(s.x - p.x, s.y - p.y) - (s.R + p.R) * (1 + STAR.join / 2);
      }),
    );
    // the opening: the sweep left over, against the largest step between neighbours
    const steps = stars.slice(1).map((s, i) => Math.abs(s.tip - stars[i].tip));
    const opening = 360 - spec.sweep;
    const open = opening > 1.2 * Math.max(...steps);
    if (stars.length !== expect[name] || !grows || !turned || gap <= 0 || !open) ok = false;
    detail.push(
      `${name}: ${stars.length} stars, ${growth.toFixed(2)}→1, opening ${opening}° vs step ≤ ${Math.max(...steps).toFixed(0)}°, closest gap ${gap.toFixed(1)}`,
    );
  }
  const offset = STACKED.x - ARCS.stacked.cx;
  if (offset <= 0) ok = false;
  detail.push(`text block ${offset} units right of the arc's centre`);
  check("arc geometry", ok, detail.join(" · "));
}

// 6. Optical spacing of the name: every pair within ±1.2 % of the cap height of the mean.
{
  const wm = wordBlock(0, 0);
  const report = [];
  let worst = 0;
  for (const [run, base] of [
    [wm.euro, wm.base1],
    [wm.plus, wm.base2],
  ]) {
    const gaps = await opticalGaps(run, base);
    const mean = gaps.reduce((s, g) => s + g.gap, 0) / gaps.length;
    for (const g of gaps) {
      const dev = (g.gap - mean) * 100;
      worst = Math.max(worst, Math.abs(dev));
      report.push(`${g.pair} ${dev >= 0 ? "+" : ""}${dev.toFixed(1)}`);
    }
  }
  check("name spacing even", worst <= 1.2, report.join(" · "));
}

// 7. Tab icons: each star a separate shape, each still a star (not a dot) at 16, 32 and 48 px.
//    16 px is drawn pixel by pixel: exact pixel count and not one blended pixel inside the tile.
{
  const ink = rgb(THEMES.night.ink);
  const bg = rgb(THEMES.night.bg);
  const detail = [];
  let ok = true;
  for (const size of [16, 32, 48]) {
    const { data, info } = await raw(await readFile(path.join(PUBLIC, `favicon-${size}.png`)));
    const at = (x, y) => (y * info.width + x) * 4;
    // share of the way from ground to ink, per pixel
    const level = (x, y) => {
      const i = at(x, y);
      return (data[i] - bg[0]) / (ink[0] - bg[0]);
    };
    const on = (x, y) => level(x, y) > 0.5;
    // 16 px is drawn pixel by pixel: corner contact would merge two stars, so it counts (8-way)
    const seen = new Set();
    const shapes = [];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        if (!on(x, y) || seen.has(`${x},${y}`)) continue;
        const queue = [[x, y]];
        seen.add(`${x},${y}`);
        const px = [];
        while (queue.length) {
          const [cx, cy] = queue.pop();
          px.push([cx, cy]);
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1],
          ]) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
            if (on(nx, ny) && !seen.has(`${nx},${ny}`)) {
              seen.add(`${nx},${ny}`);
              queue.push([nx, ny]);
            }
          }
        }
        const xs = px.map((p) => p[0]);
        const ys = px.map((p) => p[1]);
        const box =
          (Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1);
        shapes.push({ n: px.length, fillRatio: px.length / box });
      }
    const want = size === 48 ? ARCS.medium.n : ARCS.small.n;
    // a five-point star fills about half of its box; a dot or a disc fills three quarters or more
    const starry = shapes.every((s) => s.fillRatio < 0.7 && s.n >= 10);
    let extra = "";
    if (size === 16) {
      const expected = HINTED[16].pixels.reduce(
        (sum, [mask]) => sum + PIXEL_STARS[mask].join("").split("#").length - 1,
        0,
      );
      let inked = 0;
      let blended = 0;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const l = level(x, y);
          if (l > 0.98) inked++;
          // the tile's rounded corners are the only soft pixels: they are not fully opaque
          else if (l > 0.02 && data[at(x, y) + 3] === 255) blended++;
        }
      if (inked !== expected || blended) ok = false;
      extra = `, ${inked}/${expected} ink pixels, ${blended} blended`;
    }
    if (shapes.length !== want || !starry || info.width !== size) ok = false;
    detail.push(
      `${size}px: ${shapes.length}/${want} stars, fill ${shapes.map((s) => s.fillRatio.toFixed(2)).join(" ")}${extra}`,
    );
  }
  check("tab icons read as a ring of stars", ok, detail.join(" · "));
}

// 8. favicon.ico holds 16 / 32 / 48 PNG entries.
{
  const buf = await readFile(path.join(PUBLIC, "favicon.ico"));
  const count = buf.readUInt16LE(4);
  const sizes = [];
  let ok = buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1;
  for (let i = 0; i < count; i++) {
    const at = 6 + i * 16;
    const offset = buf.readUInt32LE(at + 12);
    sizes.push(buf.readUInt8(at));
    if (buf.readUInt32BE(offset) !== 0x89504e47) ok = false;
  }
  check(
    "favicon.ico",
    ok && sizes.join() === "16,32,48",
    `${count} entries: ${sizes.join(", ")} · ${buf.length} bytes`,
  );
}

// 9. Icon and image sizes; opaque where required; maskable safe zone; e-mail pair.
{
  const expect = {
    "apple-touch-icon.png": [180, 180, true],
    "icon-192.png": [192, 192, false],
    "icon-512.png": [512, 512, false],
    "icon-maskable-192.png": [192, 192, true],
    "icon-maskable-512.png": [512, 512, true],
    "social-avatar.png": [1000, 1000, true],
    "email-header@2x.png": [672, 176, true],
    "email-header-dark@2x.png": [672, 176, false],
  };
  let bad = "";
  for (const [f, [w, h, opaque]] of Object.entries(expect)) {
    const m = await sharp(path.join(PUBLIC, f)).metadata();
    const stats = await sharp(path.join(PUBLIC, f)).stats();
    const isOpaque = !m.hasAlpha || stats.channels[3].min === 255;
    if (m.width !== w || m.height !== h || opaque !== isOpaque)
      bad += `${f} ${m.width}×${m.height} opaque=${isOpaque}; `;
  }
  // the light e-mail header carries the heritage navy, the dark one the warm ink
  const darkest = async (f) => {
    const { data } = await raw(await readFile(path.join(PUBLIC, f)));
    let best = [255, 255, 255];
    for (let i = 0; i < data.length; i += 4)
      if (data[i + 3] === 255 && data[i] + data[i + 1] + data[i + 2] < best[0] + best[1] + best[2])
        best = [data[i], data[i + 1], data[i + 2]];
    return best;
  };
  const navy = rgb(THEMES.navy.ink);
  const d = await darkest("email-header@2x.png");
  if (Math.abs(d[0] - navy[0]) + Math.abs(d[1] - navy[1]) + Math.abs(d[2] - navy[2]) > 6)
    bad += `email header ink ${d}; `;
  check(
    "icon and e-mail image sizes",
    !bad,
    bad || "e-mail header 672 × 176 (shown at 336 × 88), light in navy, dark in warm ink",
  );

  const { data, info } = await raw(await readFile(path.join(PUBLIC, "icon-maskable-512.png")));
  const bg = rgb(THEMES.night.bg);
  let far = 0;
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (
        Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) >
        30
      )
        far = Math.max(far, Math.hypot(x - 255.5, y - 255.5));
    }
  check(
    "maskable safe zone",
    far <= 0.4 * 512,
    `farthest star pixel ${far.toFixed(1)} px from the centre, safe radius ${(0.4 * 512).toFixed(1)} px`,
  );
}

// 10. PDFs are vector: no image object, and the page content draws paths.
{
  const dir = path.join(EXPORT, "pdf");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".pdf"));
  let bad = "";
  for (const f of files) {
    const buf = await readFile(path.join(dir, f));
    const text = buf.toString("latin1");
    if (/\/Subtype\s*\/Image/.test(text)) bad += `${f}: contains an image; `;
    if (/\/Font\s/.test(text) && /\/BaseFont/.test(text)) bad += `${f}: contains a font; `;
    let paths = 0;
    for (const m of text.matchAll(/stream\r?\n/g)) {
      const start = m.index + m[0].length;
      const end = text.indexOf("endstream", start);
      try {
        const s = inflateSync(buf.subarray(start, end)).toString("latin1");
        paths += (s.match(/\s(?:f\*?|B\*?)\s/g) ?? []).length;
      } catch {
        // not a deflated content stream
      }
    }
    if (!paths) bad += `${f}: no filled path found; `;
  }
  check(`PDF vector (${files.length} files)`, !bad && files.length === 30, bad);
}

// 11. PNG sets: every lockup in every variant at 1×, 2×, 4×.
{
  const files = await readdir(path.join(EXPORT, "png"));
  const bases = files.filter((f) => !f.includes("@"));
  const missing = bases.filter(
    (f) =>
      !files.includes(f.replace(".png", "@2x.png")) ||
      !files.includes(f.replace(".png", "@4x.png")),
  );
  check(
    `PNG sets (${bases.length} artworks × 3 scales)`,
    missing.length === 0 && bases.length === 6 * VARIANTS.length,
    missing.join(", "),
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
