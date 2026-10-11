// Step 24 — checks the built logo kit. Exits non-zero on the first failed group.
// Usage: node scripts/brand/logo/verify.mjs   (after build.mjs)
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";
import sharp from "sharp";
import { assertClean } from "./lib/export.mjs";
import { svgToPng } from "./lib/render.mjs";
import { opticalGaps } from "./lib/spacing.mjs";
import { samplePoints } from "./lib/geo.mjs";
import { wordAt } from "./lib/parts.mjs";
import { ARM, C, HAIR, HINTED, LOCKUPS, MARK, STEM, THEMES, TYPE, U, lockupSvg, wordmark } from "./logo.mjs";

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
      for (const t of tags) if (!["svg", "title", "path"].includes(t)) throw new Error(`${f}: unexpected <${t}>`);
    } catch (e) {
      bad += `${e.message}; `;
    }
  }
  check(`SVG hygiene (${files.length} files, ${(bytes / 1024).toFixed(0)} KB in total)`, !bad, bad);
}

// 2. Optimised SVG renders like the unoptimised source (SVGO did not move anything).
{
  let worst = 0;
  let worstName = "";
  for (const [kind, file] of [
    ["horizontal", "logo-horizontal-night.svg"],
    ["stacked", "logo-stacked-paper.svg"],
    ["dual", "logo-dual-night.svg"],
    ["mark", "mark-night.svg"],
    ["oemParts", "oem-parts-black.svg"],
  ]) {
    const variant = file.match(/-(night|paper|black|white|orange)\.svg$/)[1];
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
  check("optimised SVG = source artwork", worst < 0.0005, `largest difference ${(worst * 100).toFixed(4)} % of pixels (${worstName})`);
}

// 3. Stroke logic: the mark's strokes are the letter's strokes.
{
  const E = wordAt("E", TYPE.euro, 100, 0, 100);
  const pts = samplePoints(E.d, 0.2);
  const span = (list) => Math.max(...list) - Math.min(...list);
  const stem = span(pts.filter(([, y]) => y > 28 && y < 34).map((p) => p[0]));
  const ys = pts.filter(([x]) => x > 70 && x < 74).map((p) => p[1]).sort((a, b) => a - b);
  const arm = ys.find((y) => y > 5); // lower edge of the top arm
  const spine = (MARK.spine * U) / C;
  const armMark = (MARK.arm * U) / C;
  check(
    "mark strokes = letter strokes",
    Math.abs(stem / 100 - STEM) < 0.003 && Math.abs(arm / 100 - ARM) < 0.004 && Math.abs(spine - STEM) < 0.003 && Math.abs(armMark - ARM) < 0.003,
    `letter stem ${(stem / 100).toFixed(4)} C, arm ${(arm / 100).toFixed(4)} C · bracket spine ${spine.toFixed(4)} C, arms ${armMark.toFixed(4)} C · hairline ${(HAIR / C).toFixed(4)} C`,
  );
}

// 4. Optical spacing of the wordmark: every pair within ±1.2 % of the cap height of the mean.
{
  const wm = wordmark(0, 0);
  const report = [];
  let worst = 0;
  for (const [run, base] of [
    [wm.euro, wm.base1],
    [wm.plusWord, wm.base2],
  ]) {
    const gaps = await opticalGaps(run, base);
    const mean = gaps.reduce((s, g) => s + g.gap, 0) / gaps.length;
    for (const g of gaps) {
      const dev = (g.gap - mean) * 100;
      worst = Math.max(worst, Math.abs(dev));
      report.push(`${g.pair} ${dev >= 0 ? "+" : ""}${dev.toFixed(1)}`);
    }
  }
  check("wordmark spacing even", worst <= 1.2, report.join(" · "));
}

// 5. The mark spans the wordmark block; lockup sizes.
{
  const wm = wordmark(0, 0);
  const ratios = Object.fromEntries(Object.keys(LOCKUPS).map((k) => [k, LOCKUPS[k]()]).map(([k, a]) => [k, `${a.w}×${a.h}`]));
  check("mark height = wordmark block", Math.abs(wm.h - MARK.h * U) < 0.01, `block ${wm.h.toFixed(2)} · mark ${MARK.h * U} · ${JSON.stringify(ratios)}`);
}

// 6. Favicons: pixel-exact (no blended pixel inside the mark), colours as specified.
{
  const ink = rgb(THEMES.night.ink);
  const accent = rgb(THEMES.night.accent);
  const bg = rgb(THEMES.night.bg);
  const near = (p, c) => Math.abs(p[0] - c[0]) + Math.abs(p[1] - c[1]) + Math.abs(p[2] - c[2]) <= 6;
  const detail = [];
  let ok = true;
  for (const size of [16, 32, 48]) {
    const { data, info } = await raw(await readFile(path.join(PUBLIC, `favicon-${size}.png`)));
    const g = HINTED[size];
    let blended = 0;
    let orange = 0;
    let inked = 0;
    for (let y = g.y; y < g.y + g.h; y++) {
      for (let x = g.x; x < g.x + g.w; x++) {
        const i = (y * info.width + x) * 4;
        const p = [data[i], data[i + 1], data[i + 2]];
        if (near(p, accent)) orange++;
        else if (near(p, ink)) inked++;
        else if (!near(p, bg)) blended++;
      }
    }
    const expectOrange = 2 * g.plus.span * g.plus.t - g.plus.t * g.plus.t;
    const expectInk = g.s * g.h + 2 * (g.w - g.s) * g.a;
    if (blended || orange !== expectOrange || inked !== expectInk || info.width !== size) ok = false;
    detail.push(`${size}px: ink ${inked}/${expectInk}, orange ${orange}/${expectOrange}, blended ${blended}`);
  }
  check("favicons pixel-exact", ok, detail.join(" · "));
}

// 7. favicon.ico holds 16 / 32 / 48 PNG entries.
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
  check("favicon.ico", ok && sizes.join() === "16,32,48", `${count} entries: ${sizes.join(", ")} · ${buf.length} bytes`);
}

// 8. Icon and image sizes; opaque where required.
{
  const expect = {
    "apple-touch-icon.png": [180, 180, true],
    "icon-192.png": [192, 192, false],
    "icon-512.png": [512, 512, false],
    "icon-maskable-192.png": [192, 192, true],
    "icon-maskable-512.png": [512, 512, true],
    "social-avatar.png": [1000, 1000, true],
  };
  let bad = "";
  for (const [f, [w, h, opaque]] of Object.entries(expect)) {
    const m = await sharp(path.join(PUBLIC, f)).metadata();
    const stats = await sharp(path.join(PUBLIC, f)).stats();
    const isOpaque = !m.hasAlpha || stats.channels[3].min === 255;
    if (m.width !== w || m.height !== h || (opaque && !isOpaque)) bad += `${f} ${m.width}×${m.height} opaque=${isOpaque}; `;
  }
  const mail = await sharp(path.join(PUBLIC, "email-header@2x.png")).metadata();
  check("icon set sizes", !bad, bad || `e-mail header ${mail.width}×${mail.height} (shown at ${mail.width / 2}×${mail.height / 2})`);

  // maskable: the mark stays inside the 80 % safe circle
  const { data, info } = await raw(await readFile(path.join(PUBLIC, "icon-maskable-512.png")));
  const bg = rgb(THEMES.night.bg);
  let far = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 30) {
        far = Math.max(far, Math.hypot(x - 255.5, y - 255.5));
      }
    }
  }
  check("maskable safe zone", far <= 0.4 * 512, `farthest mark pixel ${far.toFixed(1)} px from the centre, safe radius ${(0.4 * 512).toFixed(1)} px`);
}

// 9. PDFs are vector: no image object, and the page content draws paths.
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
  check(`PDF vector (${files.length} files)`, !bad, bad);
}

// 10. PNG sets: every lockup at 1×, 2×, 4×.
{
  const files = await readdir(path.join(EXPORT, "png"));
  const bases = files.filter((f) => !f.includes("@"));
  const missing = bases.filter((f) => !files.includes(f.replace(".png", "@2x.png")) || !files.includes(f.replace(".png", "@4x.png")));
  check(`PNG sets (${bases.length} artworks × 3 scales)`, missing.length === 0 && bases.length === 35, missing.join(", "));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
