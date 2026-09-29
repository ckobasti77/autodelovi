// Builds the SKLOP favicon / app icons from the brand files in docs/design/brand/ (DESIGN-SYSTEM §2.2).
// Usage: node scripts/brand/build-icons.mjs
//
// Sources: mark.svg (24-unit mark), app-icon.svg (512 master tile: radius 22 %, mark box 62 %),
// favicon-16.svg (pixel-snapped 16 px variant). Rendering: Chromium via Playwright, deviceScaleFactor 1.
// Outputs:
//   app/icon.svg            512 master tile, explicit colours; size-adaptive (see HINTED below)
//   app/favicon.ico         16 + 32 + 48, PNG payloads (ICONDIR + ICONDIRENTRY written here)
//   app/apple-icon.png      180, opaque, full-bleed graphite (iOS applies its own mask)
//   public/icons/icon-{192,512}.png       purpose "any": rounded tile, transparent corners
//   public/icons/maskable-{192,512}.png   purpose "maskable": full-bleed, mark box 50 % (inside the 80 % safe zone)
//   docs/design/brand/icons-built-preview.png   contact sheet of every output on dark and light
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { crc32, deflateSync, inflateSync } from "node:zlib";

const ROOT = path.resolve(import.meta.dirname, "../..");
const BRAND = path.join(ROOT, "docs/design/brand");
const COLOR = { tile: "#0D0F11", ink: "#F1ECE3", part: "#FF6B1A" };
const TILE_RADIUS = 113 / 512; // 22 %
const MARK_BOX = 0.62; // 24-unit mark box relative to the tile (app icon, apple icon)
const MASKABLE_MARK_BOX = 0.5; // keeps the mark well inside the 80 % safe-zone circle

// ---------------------------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------------------------

/** Self-closing <rect>/<path> elements of a brand SVG, comments removed. */
const shapesOf = (svg) =>
  svg.replace(/<!--[\s\S]*?-->/g, "").match(/<(?:rect|path)\b[^>]*\/>/g) ?? [];

const markSvg = await readFile(path.join(BRAND, "mark.svg"), "utf8");
const favicon16Svg = await readFile(path.join(BRAND, "favicon-16.svg"), "utf8");
const appIconSvg = await readFile(path.join(BRAND, "app-icon.svg"), "utf8");

/** The 24-unit mark with explicit ink (no currentColor, so the file is self-contained). */
const MARK = shapesOf(markSvg)
  .map((s) => s.replaceAll('"currentColor"', `"${COLOR.ink}"`))
  .join("");
if (!MARK.includes(COLOR.part) || MARK.includes("currentColor")) {
  throw new Error("mark.svg: unexpected structure (expected the orange part and currentColor ink)");
}

/**
 * Pixel-hinted marks for the small sizes, each on its own pixel grid (drawn on a tile of that size).
 * g16 is favicon-16.svg (part 6×4, slot 6, no axis). g32 / g48 snap the master proportions to whole
 * pixels: slot width = part width, walls ≈ 4 units, the dashed axis becomes two 2×2 dots. Rendering
 * the master directly at 32/48 puts every edge on a half pixel (grey fringes).
 */
const HINTED = {
  16: shapesOf(favicon16Svg)
    .filter((s) => !/width="16" height="16"/.test(s)) // drop the tile, keep part + base
    .join(""),
  32:
    `<rect x="12" y="7" width="8" height="4" fill="${COLOR.part}"/>` +
    `<rect x="15" y="12" width="2" height="2" fill="${COLOR.ink}"/>` +
    `<rect x="15" y="15" width="2" height="2" fill="${COLOR.ink}"/>` +
    `<path d="M9 18h3v2h8v-2h3v6H9z" fill="${COLOR.ink}"/>`,
  48:
    `<rect x="18" y="12" width="12" height="6" fill="${COLOR.part}"/>` +
    `<rect x="23" y="19" width="2" height="2" fill="${COLOR.ink}"/>` +
    `<rect x="23" y="22" width="2" height="2" fill="${COLOR.ink}"/>` +
    `<path d="M13 26h5v3h12v-3h5v9H13z" fill="${COLOR.ink}"/>`,
};

const fmt = (n) => String(Math.round(n * 10000) / 10000);

/** The 24-unit mark scaled so its box is `box` of a `size` canvas, centred. */
const placedMark = (size, box) => {
  const scale = (size * box) / 24;
  const offset = (size - size * box) / 2;
  return `<g transform="translate(${fmt(offset)} ${fmt(offset)}) scale(${fmt(scale)})">${MARK}</g>`;
};

/** An SVG document with a `grid`-unit viewBox, rendered at `px` (defaults to the grid size). */
const svgDoc = (grid, body, px = grid) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${grid} ${grid}" width="${px}" height="${px}">${body}</svg>`;

const tile = (size, rounded) =>
  `<rect width="${size}" height="${size}"${rounded ? ` rx="${fmt(size * TILE_RADIUS)}"` : ""} fill="${COLOR.tile}"/>`;

/** Master tile (rounded, transparent corners) = app-icon.svg. */
const masterSvg = (px = 512) => svgDoc(512, tile(512, true) + placedMark(512, MARK_BOX), px);
/** Full-bleed square (apple-icon, maskable). */
const fullBleedSvg = (box, px) => svgDoc(512, tile(512, false) + placedMark(512, box), px);
/** Small favicon sizes: rounded tile on the size's own pixel grid + the hinted mark. */
const hintedSvg = (px) => svgDoc(px, tile(px, true) + HINTED[px]);

// app-icon.svg is the reviewed master; make sure the composition above still matches it.
const expectedTransform = /translate\(97\.28 97\.28\) scale\(13\.2267\)/;
if (!expectedTransform.test(appIconSvg) || !expectedTransform.test(masterSvg())) {
  throw new Error("master tile no longer matches docs/design/brand/app-icon.svg (translate/scale)");
}

/**
 * app/icon.svg — the vector master for browsers that take SVG favicons. SVG-as-image evaluates media
 * queries against its rendered size, so tab-sized renders switch to the pixel-hinted marks (same tile).
 * Without media-query support the master mark shows, which is the correct fallback.
 */
const iconSvg = () => {
  const hinted = (px) => `<g class="h${px}" transform="scale(${fmt(512 / px)})">${HINTED[px]}</g>`;
  const style =
    `.h16,.h32,.h48{display:none}` +
    `@media (max-width:56px){.m{display:none}.h48{display:inline}}` +
    `@media (max-width:40px){.h48{display:none}.h32{display:inline}}` +
    `@media (max-width:24px){.h32{display:none}.h16{display:inline}}`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">`,
    `  <!-- Generated by scripts/brand/build-icons.mjs from docs/design/brand. Do not edit. -->`,
    `  <style>${style}</style>`,
    `  ${tile(512, true)}`,
    `  ${placedMark(512, MARK_BOX).replace("<g ", '<g class="m" ')}`,
    `  ${hinted(16)}`,
    `  ${hinted(32)}`,
    `  ${hinted(48)}`,
    `</svg>`,
    ``,
  ].join("\n");
};

// ---------------------------------------------------------------------------------------------
// PNG codec (8-bit, non-interlaced RGB/RGBA) — enough to verify renders and re-encode compactly.
// ---------------------------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function decodePng(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error("not a PNG");
  let pos = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("latin1", pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const [depth, colorType, , , interlace] = data.subarray(8, 13);
      if (depth !== 8 || interlace !== 0 || (colorType !== 6 && colorType !== 2)) {
        throw new Error(`unsupported PNG (depth ${depth}, color type ${colorType})`);
      }
      channels = colorType === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? out[y * stride + x - channels] : 0;
      const b = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels] : 0;
      out[y * stride + x] = (line[x] + unfilter(filter, a, b, c)) & 0xff;
    }
  }
  // Always hand back RGBA.
  if (channels === 4) return { width, height, data: out };
  const rgba = Buffer.alloc(width * height * 4, 255);
  for (let i = 0; i < width * height; i++) out.copy(rgba, i * 4, i * 3, i * 3 + 3);
  return { width, height, data: rgba };
}

function unfilter(filter, a, b, c) {
  switch (filter) {
    case 0:
      return 0;
    case 1:
      return a;
    case 2:
      return b;
    case 3:
      return (a + b) >> 1;
    case 4:
      return paeth(a, b, c);
    default:
      throw new Error(`bad PNG filter ${filter}`);
  }
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** Encodes RGBA pixels; drops the alpha channel (colour type 2) when `opaque`. Adaptive filtering. */
function encodePng({ width, height, data }, { opaque }) {
  const channels = opaque ? 3 : 4;
  const stride = width * channels;
  const px = Buffer.alloc(stride * height);
  for (let i = 0; i < width * height; i++) {
    for (let k = 0; k < channels; k++) px[i * channels + k] = data[i * 4 + k];
  }
  const raw = Buffer.alloc((stride + 1) * height);
  const candidate = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    let best = null;
    let bestScore = Infinity;
    for (let filter = 0; filter <= 4; filter++) {
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const a = x >= channels ? px[y * stride + x - channels] : 0;
        const b = y > 0 ? px[(y - 1) * stride + x] : 0;
        const c = x >= channels && y > 0 ? px[(y - 1) * stride + x - channels] : 0;
        const v = (px[y * stride + x] - unfilter(filter, a, b, c)) & 0xff;
        candidate[x] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) {
        bestScore = score;
        best = [filter, Buffer.from(candidate)];
      }
    }
    raw[y * (stride + 1)] = best[0];
    best[1].copy(raw, y * (stride + 1) + 1);
  }
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, "latin1");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = opaque ? 2 : 6; // colour type RGB / RGBA
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------------------------
// ICO container: ICONDIR (6 bytes) + one ICONDIRENTRY (16 bytes) per image + PNG payloads.
// PNG-compressed entries are valid since Windows Vista and decoded by every current browser.
// ---------------------------------------------------------------------------------------------

function buildIco(entries /* [{ size, png }] ascending */) {
  const dir = Buffer.alloc(6 + 16 * entries.length);
  dir.writeUInt16LE(0, 0); // reserved
  dir.writeUInt16LE(1, 2); // type 1 = icon
  dir.writeUInt16LE(entries.length, 4);
  let offset = dir.length;
  entries.forEach(({ size, png }, i) => {
    const e = 6 + 16 * i;
    dir[e] = size >= 256 ? 0 : size; // width (0 = 256)
    dir[e + 1] = size >= 256 ? 0 : size; // height
    dir[e + 2] = 0; // palette colours
    dir[e + 3] = 0; // reserved
    dir.writeUInt16LE(1, e + 4); // colour planes
    dir.writeUInt16LE(32, e + 6); // bits per pixel
    dir.writeUInt32LE(png.length, e + 8); // payload size
    dir.writeUInt32LE(offset, e + 12); // payload offset
    offset += png.length;
  });
  return Buffer.concat([dir, ...entries.map((e) => e.png)]);
}

function readIco(buf) {
  const count = buf.readUInt16LE(4);
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) throw new Error("bad ICONDIR");
  return Array.from({ length: count }, (_, i) => {
    const e = 6 + 16 * i;
    const size = buf.readUInt32LE(e + 8);
    const offset = buf.readUInt32LE(e + 12);
    const png = decodePng(buf.subarray(offset, offset + size));
    return { declared: buf[e] || 256, width: png.width, height: png.height };
  });
}

// ---------------------------------------------------------------------------------------------
// Verification helpers
// ---------------------------------------------------------------------------------------------

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const TILE_RGB = hexRgb(COLOR.tile);

/** Bounding box / extent of "mark" pixels (visible and clearly different from the tile colour). */
function measureMark({ width, height, data }) {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let maxRadius = 0;
  let transparent = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 255) transparent++;
      if (data[i + 3] < 128) continue;
      const d = Math.max(...[0, 1, 2].map((k) => Math.abs(data[i + k] - TILE_RGB[k])));
      if (d < 48) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      // Farthest pixel corner from the canvas centre.
      const dx = Math.max(Math.abs(x - width / 2), Math.abs(x + 1 - width / 2));
      const dy = Math.max(Math.abs(y - height / 2), Math.abs(y + 1 - height / 2));
      maxRadius = Math.max(maxRadius, Math.hypot(dx, dy));
    }
  }
  return {
    box: [minX, minY, maxX + 1, maxY + 1],
    // Offset of the mark's bbox centre from the canvas centre, in px (+x right, +y down).
    offset: [(minX + maxX + 1) / 2 - width / 2, (minY + maxY + 1) / 2 - height / 2],
    radiusRatio: maxRadius / width,
    transparent,
  };
}

// ---------------------------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------------------------

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

async function render(svg, size) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${svg}</body></html>`,
  );
  const shot = await page.screenshot({
    omitBackground: true,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  return decodePng(shot);
}

const jobs = [
  { file: "app/apple-icon.png", size: 180, svg: fullBleedSvg(MARK_BOX, 180), opaque: true },
  { file: "public/icons/icon-192.png", size: 192, svg: masterSvg(192), opaque: false },
  { file: "public/icons/icon-512.png", size: 512, svg: masterSvg(512), opaque: false },
  {
    file: "public/icons/maskable-192.png",
    size: 192,
    svg: fullBleedSvg(MASKABLE_MARK_BOX, 192),
    opaque: true,
    maskable: true,
  },
  {
    file: "public/icons/maskable-512.png",
    size: 512,
    svg: fullBleedSvg(MASKABLE_MARK_BOX, 512),
    opaque: true,
    maskable: true,
  },
];
await mkdir(path.join(ROOT, "public/icons"), { recursive: true });
const report = [];
const written = {};
let failed = false;
const check = (ok, message) => {
  if (!ok) {
    failed = true;
    console.error(`FAIL ${message}`);
  }
};

for (const job of jobs) {
  const img = await render(job.svg, job.size);
  const m = measureMark(img);
  check(img.width === job.size && img.height === job.size, `${job.file}: size ${img.width}`);
  if (job.opaque) check(m.transparent === 0, `${job.file}: ${m.transparent} non-opaque pixels`);
  else check(m.transparent > 0, `${job.file}: expected transparent tile corners`);
  check(
    Math.abs(m.offset[0]) <= 1 && Math.abs(m.offset[1]) <= Math.max(1, job.size * 0.01),
    `${job.file}: mark off-centre ${m.offset}`,
  );
  if (job.maskable) check(m.radiusRatio <= 0.4, `${job.file}: mark leaves the safe zone`);
  const png = encodePng(img, { opaque: job.opaque });
  await writeFile(path.join(ROOT, job.file), png);
  written[job.file] = png;
  report.push({ file: job.file, px: job.size, bytes: png.length, ...m });
}

// favicon.ico: 16 (favicon-16.svg), 32 and 48 (hinted master).
const icoEntries = [];
for (const size of [16, 32, 48]) {
  const img = await render(hintedSvg(size), size);
  const m = measureMark(img);
  check(Math.abs(m.offset[0]) <= 0.5 && Math.abs(m.offset[1]) <= 0.5, `ico ${size}: off-centre`);
  const png = encodePng(img, { opaque: false });
  icoEntries.push({ size, png });
  written[`favicon-${size}`] = png;
  report.push({ file: `app/favicon.ico [${size}]`, px: size, bytes: png.length, ...m });
}
const ico = buildIco(icoEntries);
await writeFile(path.join(ROOT, "app/favicon.ico"), ico);
const parsed = readIco(ico);
check(
  parsed.every((e, i) => e.declared === [16, 32, 48][i] && e.width === e.declared),
  `favicon.ico directory ${JSON.stringify(parsed)}`,
);
report.push({ file: "app/favicon.ico", px: "16/32/48", bytes: ico.length });

const icon = iconSvg();
await writeFile(path.join(ROOT, "app/icon.svg"), icon);
check(!icon.includes("currentColor"), "icon.svg must not use currentColor");
report.push({ file: "app/icon.svg", px: "vector", bytes: Buffer.byteLength(icon) });

// ---------------------------------------------------------------------------------------------
// Contact sheet: every output at 1:1 on dark and light, small sizes also magnified.
// ---------------------------------------------------------------------------------------------

const dataUri = (buf, type) => `data:${type};base64,${buf.toString("base64")}`;
const pngUri = (key) => dataUri(written[key], "image/png");
const svgUri = dataUri(Buffer.from(icon), "image/svg+xml");
const icoUri = dataUri(ico, "image/x-icon");

const cell = (label, html) =>
  `<figure><div class="art">${html}</div><figcaption>${label}</figcaption></figure>`;
const img = (src, size, extra = "") =>
  `<img src="${src}" width="${size}" height="${size}" alt="" ${extra}>`;
const zoom = (src, size, factor) => img(src, size * factor, 'style="image-rendering:pixelated"');
/** Lays the SVG out at `size` (its media queries see that size) and magnifies the result. */
const magnify = (src, size, factor) =>
  `<div style="width:${size * factor}px;height:${size * factor}px">` +
  img(src, size, `style="transform:scale(${factor});transform-origin:0 0"`) +
  `</div>`;
const maskedCircle = (src, size) =>
  `<div style="position:relative;width:${size}px;height:${size}px">${img(src, size, 'style="border-radius:50%"')}` +
  `<div style="position:absolute;inset:${size * 0.1}px;border:1px dashed #FF6B1A;border-radius:50%"></div></div>`;

const band = (theme) => `
<section class="${theme}">
  <h2>${theme === "dark" ? "Dark UI (#202124)" : "Light UI (#F1F3F4)"}</h2>
  <div class="row">
    ${cell("favicon.ico 16 · 32 · 48 (1:1)", [16, 32, 48].map((s) => img(pngUri(`favicon-${s}`), s)).join(""))}
    ${cell("ico 16 ×8", zoom(pngUri("favicon-16"), 16, 8))}
    ${cell("ico 32 ×4", zoom(pngUri("favicon-32"), 32, 4))}
    ${cell("ico 48 ×3", zoom(pngUri("favicon-48"), 48, 3))}
    ${cell("favicon.ico decoded by Chromium", img(icoUri, 48, 'id="ico-' + theme + '"'))}
  </div>
  <div class="row">
    ${cell("icon.svg @16 · 32 · 48 · 64 (size-adaptive)", [16, 32, 48, 64].map((s) => img(svgUri, s)).join(""))}
    ${cell("icon.svg laid out @16, ×8", magnify(svgUri, 16, 8))}
    ${cell("icon.svg laid out @32, ×4", magnify(svgUri, 32, 4))}
    ${cell("apple-icon 180", img(pngUri("app/apple-icon.png"), 180))}
    ${cell("apple-icon, iOS-style mask", img(pngUri("app/apple-icon.png"), 180, 'style="border-radius:40px"'))}
  </div>
  <div class="row">
    ${cell("icon-192 (any)", img(pngUri("public/icons/icon-192.png"), 192))}
    ${cell("icon-512 (any) at 50 %", img(pngUri("public/icons/icon-512.png"), 256))}
    ${cell("maskable-192", img(pngUri("public/icons/maskable-192.png"), 192))}
    ${cell("maskable-512, circle mask + 80 % safe zone", maskedCircle(pngUri("public/icons/maskable-512.png"), 256))}
  </div>
</section>`;

const sheet = `<!doctype html><html><head><style>
  body{margin:0;font:13px/1.4 ui-monospace,Consolas,monospace}
  section{padding:24px 32px 12px}
  .dark{background:#202124;color:#BDC1C6}.light{background:#F1F3F4;color:#3C4043}
  h2{font:600 14px/1 ui-monospace,Consolas,monospace;margin:0 0 16px;letter-spacing:.04em}
  .row{display:flex;gap:32px;align-items:flex-end;margin-bottom:20px;flex-wrap:wrap}
  figure{margin:0;display:grid;gap:8px;justify-items:start}
  .art{display:flex;gap:12px;align-items:flex-end}
  img{display:block}
</style></head><body>${band("dark")}${band("light")}</body></html>`;

await page.setViewportSize({ width: 1280, height: 800 });
await page.setContent(sheet);
await page.evaluate(() => Promise.all([...document.images].map((i) => i.decode())));
const icoDecoded = await page.evaluate(() => document.getElementById("ico-dark").naturalWidth);
check(icoDecoded > 0, "Chromium could not decode favicon.ico");
await page.screenshot({ path: path.join(BRAND, "icons-built-preview.png"), fullPage: true });
await browser.close();

// ---------------------------------------------------------------------------------------------

for (const r of report) {
  const extra = r.box
    ? `  mark box ${r.box.join(",")}  offset ${r.offset.map((v) => v.toFixed(1)).join("/")}` +
      `  extent r=${(r.radiusRatio * 100).toFixed(1)} %`
    : "";
  console.log(
    `${r.file.padEnd(34)} ${String(r.px).padEnd(9)} ${String(r.bytes).padStart(6)} B${extra}`,
  );
}
console.log(
  `Chromium decoded favicon.ico to ${icoDecoded} px; preview → docs/design/brand/icons-built-preview.png`,
);
if (failed) process.exitCode = 1;
