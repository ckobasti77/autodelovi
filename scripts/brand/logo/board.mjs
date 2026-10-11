// Step 24 — the brand board for the client: one self-contained HTML file (inline SVG, CSS and fonts,
// no external requests) and its PNG render at 1600 px.
// Usage: node scripts/brand/logo/board.mjs   (after build.mjs)
// Output: docs/brand/BRAND-BOARD.html, docs/brand/BRAND-BOARD.png
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { bounds, circle, rect, translate, union } from "./lib/geo.mjs";
import { fill, word } from "./lib/parts.mjs";
import { closeBrowser, getBrowser } from "./lib/render.mjs";
import {
  ARM,
  C,
  CLEAR,
  HAIR,
  LOCKUP,
  LOCKUPS,
  MARK,
  MIN,
  STEM,
  THEMES,
  U,
  hintedIconSvg,
  iconSvg,
  mark,
  wordmark,
} from "./logo.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT = path.join(ROOT, "docs/brand");
const N = THEMES.night;
const P = THEMES.paper;

// ---------------------------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------------------------
const fontFace = (family, file, weight, range) => {
  const data = readFileSync(path.join(ROOT, "scripts/showcase/fonts", file)).toString("base64");
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2")${range ? `;unicode-range:${range}` : ""}}`;
};
const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
const FONTS = [
  fontFace("Archivo Expanded", "archivo-expanded-700.woff2", 700),
  fontFace("Archivo Expanded", "archivo-expanded-600.woff2", 600),
  fontFace("Public Sans", "public-sans-latin.woff2", "100 900", LATIN),
  fontFace("Public Sans", "public-sans-latin-ext.woff2", "100 900", LATIN_EXT),
  fontFace("Martian Mono", "martian-mono-latin.woff2", "100 800", LATIN),
  fontFace("Martian Mono", "martian-mono-latin-ext.woff2", "100 800", LATIN_EXT),
].join("\n");

/** A lockup as inline SVG sized by CSS height (px). */
function art(kind, theme, height, { label, className = "" } = {}) {
  const a = LOCKUPS[kind]();
  const t = typeof theme === "string" ? THEMES[theme] : theme;
  const w = (a.w / a.h) * height;
  const aria = label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`;
  return `<svg class="art ${className}" ${aria} viewBox="0 0 ${a.w} ${a.h}" width="${w.toFixed(1)}" height="${height}">${fill(a.ink, t.ink)}${fill(a.accent, t.accent)}</svg>`;
}
const inline = (svg, size, cls = "") =>
  svg
    .replace(
      /<svg [^>]*viewBox="([^"]+)"[^>]*>/,
      `<svg class="${cls}" aria-hidden="true" viewBox="$1" width="${size}" height="${size}">`,
    )
    .replace(/<title>.*?<\/title>/, "");

const dataUri = async (file, width) => {
  const buf = await sharp(path.join(OUT, "source", file))
    .resize({ width })
    .jpeg({ quality: 82 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
};

const NAME = "Euromotors Plus by OEM Parts";

// ---------------------------------------------------------------------------------------------
// Construction drawings (computed from the same numbers as the logo)
// ---------------------------------------------------------------------------------------------
function markConstruction() {
  const k = 15; // px per unit
  const ox = 70;
  const oy = 46;
  const m = mark(0, 0, k);
  const W = MARK.w * k;
  const H = MARK.h * k;
  let grid = "";
  for (let i = 0; i <= MARK.w; i++) grid += `<line x1="${i * k}" y1="0" x2="${i * k}" y2="${H}"/>`;
  for (let j = 0; j <= MARK.h; j++) grid += `<line x1="0" y1="${j * k}" x2="${W}" y2="${j * k}"/>`;
  const dim = (x1, y1, x2, y2, label, lx, ly, anchor = "middle") =>
    `<g class="dim"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>` +
    (y1 === y2
      ? `<line x1="${x1}" y1="${y1 - 5}" x2="${x1}" y2="${y1 + 5}"/><line x1="${x2}" y1="${y2 - 5}" x2="${x2}" y2="${y2 + 5}"/>`
      : `<line x1="${x1 - 5}" y1="${y1}" x2="${x1 + 5}" y2="${y1}"/><line x1="${x2 - 5}" y1="${y2}" x2="${x2 + 5}" y2="${y2}"/>`) +
    `<text x="${lx}" y="${ly}" text-anchor="${anchor}">${label}</text></g>`;
  const px = (MARK.spine + MARK.seat) * k;
  const cy = H / 2;
  const span = MARK.plusSpan * k;
  return `<svg class="drawing" role="img" aria-label="Konstrukcija znaka na mreži 16 × 20 jedinica" viewBox="0 0 ${W + ox + 150} ${H + oy + 70}" width="${W + ox + 150}" height="${H + oy + 70}">
    <g transform="translate(${ox} ${oy})">
      <g class="grid">${grid}</g>
      <path fill="${N.ink}" fill-rule="evenodd" d="${m.bracket}"/><path fill="${N.accent}" fill-rule="evenodd" d="${m.sign}"/>
      ${dim(0, -18, W, -18, "16 u", W / 2, -26)}
      ${dim(-22, 0, -22, H, "20 u", -30, H / 2 + 4, "end")}
      ${dim(0, H + 20, MARK.spine * k, H + 20, "S = 3,2 u", MARK.spine * k + 10, H + 24, "start")}
      ${dim(W + 20, 0, W + 20, MARK.arm * k, "A = 2,33 u", W + 30, (MARK.arm * k) / 2 + 4, "start")}
      ${dim(px, cy + span / 2 + 16, px + span, cy + span / 2 + 16, "plus 9 u", px + span / 2, cy + span / 2 + 34)}
      ${dim(W + 20, cy - (MARK.plusH * k) / 2, W + 20, cy + (MARK.plusH * k) / 2, "A", W + 30, cy + 4, "start")}
      ${dim(MARK.spine * k, cy - span / 2 - 14, px, cy - span / 2 - 14, "1 u", px + 10, cy - span / 2 - 10, "start")}
    </g></svg>`;
}

function lockupConstruction() {
  const m = mark(0, 0);
  const wm = wordmark(m.w + LOCKUP.gapMark, 0);
  const pad = 110;
  const right = wm.x2;
  const W = right + pad * 2 + 520;
  const H = m.h + pad * 2;
  const guide = (y, label) =>
    `<line class="guide" x1="${-60}" y1="${y}" x2="${right + 120}" y2="${y}"/><text class="glabel" x="${right + 136}" y="${y + 8}">${label}</text>`;
  const clear = `<rect class="clear" x="${-CLEAR}" y="${-CLEAR}" width="${right + CLEAR * 2}" height="${m.h + CLEAR * 2}"/>`;
  const plusAt = (cx, cy) => {
    const s = MARK.plusSpan * U;
    return `<path class="ghost" d="${union(rect(cx - (MARK.plusV * U) / 2, cy - s / 2, MARK.plusV * U, s), rect(cx - s / 2, cy - (MARK.plusH * U) / 2, s, MARK.plusH * U))}"/>`;
  };
  return `<svg class="drawing wide" role="img" aria-label="Poravnanja i slobodan prostor osnovnog znaka" viewBox="${-pad} ${-pad} ${W} ${H}" width="100%">
    ${clear}
    ${plusAt(-CLEAR / 2, m.h / 2)}${plusAt(right + CLEAR / 2, m.h / 2)}${plusAt(right / 2, -CLEAR / 2)}${plusAt(right / 2, m.h + CLEAR / 2)}
    <path fill="${N.ink}" fill-rule="evenodd" d="${m.bracket + wm.d}"/><path fill="${N.accent}" fill-rule="evenodd" d="${m.sign}"/>
    ${guide(0, "linija verzala")}
    ${guide(wm.base1, "osnovna linija · visina C")}
    ${guide(wm.base2 - wm.c2, "razmak 0,30 C")}
    ${guide(wm.base2, "drugi red 0,56 C")}
    <line class="guide v" x1="${m.w}" y1="-40" x2="${m.w}" y2="${m.h + 40}"/><line class="guide v" x1="${wm.x1}" y1="-40" x2="${wm.x1}" y2="${m.h + 40}"/>
    <text class="glabel" x="${m.w + LOCKUP.gapMark / 2}" y="${m.h + 62}" text-anchor="middle">5 u</text>
  </svg>`;
}

function strokeLogic() {
  const k = 1.5;
  const E = word("E", { family: "archivo", axes: { wght: 800, wdth: 125 } }, C * k);
  const d = translate(E.d, 20 - E.bbox.x1, C * k + 20);
  const S = STEM * C * k;
  const A = ARM * C * k;
  const h = C * k + 40;
  return `<svg class="drawing" role="img" aria-label="Tri debljine poteza: S, A i petina S" viewBox="0 0 560 ${h}" width="560" height="${h}">
    <path fill="${N.ink}" fill-rule="evenodd" d="${d}"/>
    <rect x="20" y="20" width="${S}" height="${C * k}" fill="${N.accent}" opacity=".9"/>
    <rect x="${20 + S}" y="20" width="${E.bbox.x2 - E.bbox.x1 - S}" height="${A}" fill="${N.accent}" opacity=".45"/>
    <g class="legend">
      <rect x="230" y="34" width="${S}" height="46" fill="${N.ink}"/><text x="300" y="52">S — uspravni potez slova</text><text class="sub" x="300" y="72">kičma zagrade</text>
      <rect x="230" y="${98 + (46 - A) / 2}" width="46" height="${A}" fill="${N.ink}"/><text x="300" y="116">A — vodoravni potez slova</text><text class="sub" x="300" y="136">kraci zagrade, plus</text>
      <rect x="230" y="${162 + (46 - HAIR * k) / 2}" width="46" height="${HAIR * k}" fill="${N.ink}"/><text x="300" y="180">S ÷ 5 — tanka linija</text><text class="sub" x="300" y="200">linija, razdelnik, kontura reči Parts</text>
    </g></svg>`;
}

// ---------------------------------------------------------------------------------------------
// Do / don't artwork
// ---------------------------------------------------------------------------------------------
function rearranged(height) {
  const wm = wordmark(0, 0, { withSignature: false });
  const m = mark(wm.x2 + LOCKUP.gapMark, 0);
  const b = bounds(wm.d + m.bracket + m.sign);
  return `<svg class="art" aria-hidden="true" viewBox="${b.x1} ${b.y1} ${b.w} ${b.h}" width="${((b.w / b.h) * height).toFixed(1)}" height="${height}">${fill(wm.d + m.bracket, N.ink)}${fill(m.sign, N.accent)}</svg>`;
}
function plusInCircle(size) {
  const s = MARK.plusSpan * U;
  const d = union(
    rect(100 - (MARK.plusV * U) / 2, 100 - s / 2, MARK.plusV * U, s),
    rect(100 - s / 2, 100 - (MARK.plusH * U) / 2, s, MARK.plusH * U),
  );
  return `<svg class="art" aria-hidden="true" viewBox="0 0 200 200" width="${size}" height="${size}"><path fill="${N.ink}" d="${circle(100, 100, 96)}"/><path fill="${N.accent}" d="${d}"/></svg>`;
}
const yes = `<svg class="verdict ok" aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
const no = `<svg class="verdict bad" aria-hidden="true" viewBox="0 0 16 16" width="16" height="16"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;

// ---------------------------------------------------------------------------------------------
// Mockups
// ---------------------------------------------------------------------------------------------
function van() {
  const a = LOCKUPS.dual();
  const lw = 452;
  const lh = (a.h / a.w) * lw;
  const lx = 146;
  const ly = 176;
  return `<svg class="scene" role="img" aria-label="Dvojni znak na boku dostavnog vozila" viewBox="0 0 980 420" width="100%">
    <line x1="20" y1="368" x2="960" y2="368" stroke="${"#2C3238"}" stroke-width="1"/>
    <path d="M120 96h560c14 0 26 6 34 18l92 124c8 10 12 22 12 36v62c0 10-8 18-18 18H120c-12 0-22-10-22-22V118c0-12 10-22 22-22z" fill="#F4F2EE"/>
    <path d="M694 124l76 104H640V124z" fill="#16191D"/>
    <path d="M640 124v230" stroke="#D5D2CB" stroke-width="2" fill="none"/>
    <rect x="98" y="318" width="720" height="36" fill="#E3E0DA"/>
    <rect x="792" y="262" width="26" height="22" rx="3" fill="${N.accent}" opacity=".85"/>
    <rect x="98" y="250" width="12" height="40" rx="3" fill="#C4303A" opacity=".8"/>
    <g fill="#0D0F11"><circle cx="232" cy="356" r="52"/><circle cx="700" cy="356" r="52"/></g>
    <g fill="#2B3138"><circle cx="232" cy="356" r="27"/><circle cx="700" cy="356" r="27"/></g>
    <g fill="#6E767F"><circle cx="232" cy="356" r="8"/><circle cx="700" cy="356" r="8"/></g>
    <svg x="${lx}" y="${ly}" width="${lw}" height="${lh.toFixed(1)}" viewBox="0 0 ${a.w} ${a.h}">${fill(a.ink, P.ink)}${fill(a.accent, P.accent)}</svg>
    <svg x="688" y="246" width="44" height="55" viewBox="0 0 160 200">${fill(mark().bracket, P.ink)}${fill(mark().sign, P.accent)}</svg>
  </svg>`;
}

function sign() {
  const a = LOCKUPS.dual();
  const lw = 560;
  const lh = (a.h / a.w) * lw;
  return `<svg class="scene" role="img" aria-label="Svetleća tabla iznad izloga sa dvojnim znakom" viewBox="0 0 980 420" width="100%">
    <rect x="0" y="0" width="980" height="420" fill="#16191D"/>
    <g stroke="#1E2227" stroke-width="1">${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${30 + i * 46}" x2="980" y2="${30 + i * 46}"/>`).join("")}</g>
    <rect x="150" y="62" width="680" height="118" fill="#0D0F11" stroke="#434A52" stroke-width="1"/>
    <rect x="150" y="180" width="680" height="3" fill="#07080A"/>
    <svg x="${150 + (680 - lw) / 2}" y="${62 + (118 - lh) / 2}" width="${lw}" height="${lh.toFixed(1)}" viewBox="0 0 ${a.w} ${a.h}">${fill(a.ink, N.ink)}${fill(a.accent, N.accent)}</svg>
    <rect x="170" y="214" width="420" height="206" fill="#1C2025" stroke="#2C3238"/>
    <path d="M170 214h420v206H170z M300 214v206 M460 214v206" fill="none" stroke="#2C3238"/>
    <path d="M190 400l80-166M330 400l80-166" stroke="#23282E" stroke-width="14" fill="none"/>
    <rect x="630" y="214" width="180" height="206" fill="#121518" stroke="#2C3238"/>
    <rect x="786" y="318" width="6" height="26" fill="#6E767F"/>
    <rect x="868" y="92" width="74" height="74" fill="#0D0F11" stroke="#434A52"/>
    <rect x="830" y="126" width="38" height="6" fill="#434A52"/>
    <svg x="887" y="107" width="35.2" height="44" viewBox="0 0 160 200">${fill(mark().bracket, N.ink)}${fill(mark().sign, N.accent)}</svg>
  </svg>`;
}

const skeleton = (widths, cls = "") =>
  widths.map((w) => `<span class="sk ${cls}" style="width:${w}%"></span>`).join("");

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------
const oldEuro = await dataUri("euromotors-plus-current.jpg", 760);
const oldOem = await dataUri("oem-parts-current.webp", 520);

const variants = [
  ["night", "Na tamnoj podlozi", "logo-…-night", N.bg, ""],
  ["paper", "Na beloj podlozi", "logo-…-paper", "#FFFFFF", "light"],
  ["black", "Jedna boja, crna", "logo-…-black", "#FFFFFF", "light"],
  ["white", "Jedna boja, bela", "logo-…-white", N.bg, ""],
  ["orange", "Narandžasta na tamnom", "logo-…-orange", N.bg, ""],
];

const SYSTEM = {
  horizontal: ["Osnovni znak", "logo-horizontal", 112, MIN.horizontal],
  dual: ["Dvojni znak — tabla, vozilo", "logo-dual", 100, MIN.dual],
  header: ["Za zaglavlje sajta", "logo-header", 72, MIN.header],
  wordmark: ["Samo ime", "logo-wordmark", 78, MIN.wordmark],
  stacked: ["Uspravni", "logo-stacked", 196, MIN.stacked],
  mark: ["Znak", "mark", 150, MIN.mark],
  oemParts: ["Potpis radnje", "oem-parts", 118, MIN.oemParts],
};
const cap = (title, file, min) =>
  `<figcaption><span class="t">${title}</span><span class="m">${file} · najmanje ${min.px} px / ${min.mm} mm visine</span></figcaption>`;
const fig = (kind, theme) => {
  const [t, f, h, min] = SYSTEM[kind];
  return `<figure>${art(kind, theme, h, { label: `${t}: ${kind === "oemParts" ? "OEM Parts" : NAME}` })}${cap(t, f, min)}</figure>`;
};
const systemGround = (theme, cls) => `
  <div class="ground ${cls}">
    ${fig("horizontal", theme)}
    ${fig("dual", theme)}
    <div class="row2">${fig("header", theme)}${fig("wordmark", theme)}</div>
    <div class="row3">${fig("stacked", theme)}${fig("mark", theme)}${fig("oemParts", theme)}</div>
  </div>`;

const swatches = [
  ["Noć", "#0D0F11", "13 · 15 · 17", "Podloga sajta, tabla, ikonica.", "dark"],
  ["Mastilo", "#F1ECE3", "241 · 236 · 227", "Znak i ime na tamnoj podlozi.", "lightsw"],
  ["Signal", "#FF6B1A", "255 · 107 · 26", "Samo plus. Nigde drugde u znaku.", "accent"],
  ["Papir", "#FFFFFF", "255 · 255 · 255", "Dokumenta, e-pošta, admin.", "lightsw"],
  ["Grafit", "#121518", "18 · 21 · 24", "Znak i ime na beloj podlozi.", "dark"],
  ["Crna", "#000000", "0 · 0 · 0", "Jednobojna štampa, pečat.", "dark"],
];

const donts = [
  [
    `<div style="transform:scaleX(1.42)">${art("header", N, 26)}</div>`,
    "Ne razvlačiti i ne sabijati.",
  ],
  [
    `<div style="transform:rotate(-9deg)">${art("header", N, 34)}</div>`,
    "Ne okretati i ne naginjati.",
  ],
  [
    art("header", { ink: "#3D7BE0", accent: "#39C16C" }, 36),
    "Ne menjati boje. Plus je jedini narandžast.",
  ],
  [
    `<div style="filter:drop-shadow(0 6px 5px rgba(255,255,255,.55)) drop-shadow(0 0 2px #FF6B1A)">${art("header", N, 36)}</div>`,
    "Bez senke, sjaja i dodatnih kontura.",
  ],
  [`<div class="busy">${art("header", N, 30)}</div>`, "Ne na narandžastu ili šarenu podlogu."],
  [rearranged(36), "Ne premeštati delove: znak je uvek levo."],
  [art("horizontal", N, 24), "Osnovni znak ne ispod 56 px. Tada ide verzija za zaglavlje."],
  [plusInCircle(76), "Plus ne zatvarati u krug i ne koristiti sam."],
];

const css = `
${FONTS}
:root{--bg:#0D0F11;--raised:#121518;--s1:#16191D;--s2:#1C2025;--s3:#23282E;--line-faint:#1E2227;--line:#2C3238;--line-strong:#434A52;--ink1:#F1ECE3;--ink2:#C4BEB4;--ink3:#969088;--accent:#FF6B1A;--ok:#4FD18B;--bad:#FF6166;color-scheme:dark}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--ink1);font:400 16px/1.55 "Public Sans",Arial,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.board{width:1600px;margin:0 auto}
svg{display:block}
h1,h2,h3,p,figure{margin:0}
.mono{font:400 12px/1.4 "Martian Mono",ui-monospace,monospace;letter-spacing:.04em;color:var(--ink3);text-transform:uppercase}
.cover{position:relative;padding:72px 96px 88px;border-bottom:1px solid var(--line)}
.cover .bar{display:flex;justify-content:space-between;margin-bottom:150px}
.cover h1{font:700 44px/1.08 "Archivo Expanded",Arial,sans-serif;text-transform:uppercase;letter-spacing:.005em;max-width:1180px;margin-top:132px;text-wrap:balance}
.cover .lede{font-size:20px;line-height:1.5;color:var(--ink2);max-width:760px;margin-top:28px}
.block{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);margin-top:96px}
.block div{padding:18px 20px 0 0}
.block dt{font:400 11px/1.3 "Martian Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--ink3)}
.block dd{margin:6px 0 0;font-size:16px;color:var(--ink1)}
dl{margin:0}
.sheet{padding:104px 96px;border-bottom:1px solid var(--line)}
.head{display:grid;grid-template-columns:96px 1fr;align-items:baseline;margin-bottom:56px}
.head .idx{font:600 20px/1 "Archivo Expanded",Arial,sans-serif;color:var(--ink3);font-variant-numeric:tabular-nums}
.head h2{font:600 34px/1.08 "Archivo Expanded",Arial,sans-serif;text-transform:uppercase;letter-spacing:.005em}
.head p{grid-column:2;font-size:18px;line-height:1.5;color:var(--ink2);max-width:780px;margin-top:16px}
figure{display:flex;flex-direction:column;gap:18px}
figcaption{display:flex;flex-direction:column;gap:4px}
figcaption .t{font-weight:600;font-size:15px}
figcaption .m{font:400 11px/1.4 "Martian Mono",monospace;letter-spacing:.03em;color:var(--ink3)}
.light figcaption .t{color:#121518}.light figcaption .m{color:#5D6570}
/* 01 */
.then{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.then .card{border:1px solid var(--line);display:grid;grid-template-rows:300px auto}
.then .img{display:grid;place-items:center;overflow:hidden}
.then .img img{display:block;max-width:100%;max-height:100%}
.then .txt{padding:24px 28px 28px;border-top:1px solid var(--line)}
.then h3,.now h3{font-weight:650;font-size:18px;margin-bottom:12px}
.kv{display:grid;grid-template-columns:104px 1fr;gap:8px 16px;font-size:15px;line-height:1.5;color:var(--ink2)}
.kv dt{font:400 11px/1.9 "Martian Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--ink3)}
.kv dd{margin:0}
.now{margin-top:24px;border:1px solid var(--line-strong);display:grid;grid-template-columns:1.25fr 1fr}
.now .stage{padding:72px 56px;display:grid;place-items:center start;background:var(--raised)}
.now .txt{padding:40px 44px;border-left:1px solid var(--line)}
.now ol{margin:0;padding:0;list-style:none;display:grid;gap:14px;font-size:15.5px;line-height:1.5;color:var(--ink2)}
.now li{display:grid;grid-template-columns:28px 1fr}
.now li b{font:600 13px/1.75 "Archivo Expanded",Arial,sans-serif;color:var(--accent)}
.now strong{color:var(--ink1);font-weight:600}
/* 02 */
.split{display:grid;grid-template-columns:minmax(0,1fr);border:1px solid var(--line)}
.ground{padding:72px 64px;display:grid;gap:72px;align-content:start}
.ground.light{background:#FFFFFF}
.row2{display:grid;grid-template-columns:auto auto;justify-content:space-between;align-items:end;gap:40px}
.row3{display:grid;grid-template-columns:auto auto auto;justify-content:space-between;align-items:end;gap:40px}
/* 03 */
.build{display:grid;grid-template-columns:auto 1fr;gap:72px;align-items:start}
.drawing .grid line{stroke:var(--line);stroke-width:1}
.drawing .dim line{stroke:var(--ink3);stroke-width:1}
.drawing text{font:400 12px "Martian Mono",monospace;fill:var(--ink2);letter-spacing:.02em}
.drawing .legend text{font:500 15px "Public Sans",sans-serif;fill:var(--ink1);letter-spacing:0}
.drawing .legend text.sub{font:400 12px "Martian Mono",monospace;fill:var(--ink3)}
.drawing .guide{stroke:var(--ink3);stroke-width:2;stroke-dasharray:10 8}
.drawing .glabel{font:400 22px "Martian Mono",monospace;fill:var(--ink3)}
.drawing .clear{fill:none;stroke:var(--accent);stroke-width:2.5;stroke-dasharray:14 10}
.drawing .ghost{fill:var(--accent);opacity:.28}
.drawing.wide{height:auto}
.notes{display:grid;gap:28px}
.note h3{font-weight:650;font-size:17px;margin-bottom:6px}
.note p{font-size:15.5px;color:var(--ink2);max-width:520px}
.wideframe{border:1px solid var(--line);margin-top:56px;padding:28px 36px 20px}
.wideframe .mono{display:block;margin-top:8px}
.sizes{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--line);margin-top:24px}
.sizes div{padding:28px 28px 24px;border-right:1px solid var(--line);display:flex;flex-direction:column;justify-content:space-between;gap:24px;min-height:176px}
.sizes div:last-child{border-right:0}
/* 04 */
.swatches{display:grid;grid-template-columns:repeat(6,1fr);border:1px solid var(--line)}
.sw{border-right:1px solid var(--line)}.sw:last-child{border-right:0}
.sw .chip{height:150px;border-bottom:1px solid var(--line)}
.sw .txt{padding:18px 18px 22px}
.sw b{display:block;font-weight:650;font-size:16px}
.sw code{display:block;font:500 13px/1.6 "Martian Mono",monospace;color:var(--ink1);margin-top:6px}
.sw code + code{font-weight:400;font-size:11px;color:var(--ink3);margin-top:0}
.sw p{font-size:13.5px;line-height:1.45;color:var(--ink2);margin-top:10px}
.type{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--line);margin-top:24px}
.type > div{padding:36px 40px 40px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.type > div:nth-child(2n){border-right:0}.type > div:nth-last-child(-n+2){border-bottom:0}
.type .spec{font:700 40px/1.05 "Archivo Expanded",Arial,sans-serif;text-transform:uppercase;margin:14px 0 14px}
.type .spec.ui{font:500 34px/1.15 "Public Sans",sans-serif;text-transform:none}
.type .spec.mono2{font:500 28px/1.3 "Martian Mono",monospace;text-transform:none;letter-spacing:.01em}
.type p{font-size:14.5px;color:var(--ink2);max-width:560px}
/* 05 */
.variants{display:grid;grid-template-columns:repeat(6,1fr);gap:0;border:1px solid var(--line)}
.variant{grid-column:span 2;padding:44px 36px 28px;display:grid;gap:36px;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}
.variant:nth-child(3){border-right:0}
.variant:nth-child(n+4){grid-column:span 3;border-bottom:0}
.variant:nth-child(5){border-right:0}
.variant .pair{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:72px}
/* 06 */
.usage{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid var(--line)}
.use{border-right:1px solid var(--line);border-bottom:1px solid var(--line);display:grid;grid-template-rows:176px auto}
.use:nth-child(4n){border-right:0}
.use .stage{display:grid;place-items:center;overflow:hidden;padding:20px}
.use .stage.light{background:#FFFFFF}
.use .cap{display:grid;grid-template-columns:22px 1fr;align-items:start;gap:8px;padding:16px 20px 20px;border-top:1px solid var(--line);font-size:14.5px;line-height:1.4;color:var(--ink2)}
.verdict{margin-top:2px}.verdict.ok{color:var(--ok)}.verdict.bad{color:var(--bad)}
.busy{background:repeating-linear-gradient(135deg,#FF6B1A 0 22px,#E95E0E 22px 44px);padding:22px 20px}
.usage.last .use{border-bottom:0}
.rowlabel{font-weight:650;font-size:17px;margin:44px 0 16px}
.rowlabel:first-of-type{margin-top:0}
/* 07 */
.mock{border:1px solid var(--line);margin-bottom:24px;gap:0}
.mock > :first-child{flex:1}
.mock > figcaption{padding:16px 24px;border-top:1px solid var(--line);flex-direction:row;justify-content:space-between;align-items:baseline}
.mockgrid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.mockgrid .mock{margin:0}
.site{background:var(--bg);padding:0 0 132px}
.sitebar{height:72px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:44px;padding:0 40px;background:var(--raised);border-bottom:1px solid var(--line)}
.sitebar nav{display:flex;gap:30px;font-weight:600;font-size:15px;color:var(--ink2)}
.sitebar nav span:first-child{color:var(--ink1)}
.sitebar .tools{display:flex;gap:14px;align-items:center}
.search{width:330px;height:42px;border:1px solid #6E767F;background:var(--s2);border-radius:4px;display:flex;align-items:center;padding:0 14px;font:400 13px "Martian Mono",monospace;color:var(--ink3)}
.btn{height:42px;padding:0 18px;border-radius:4px;background:var(--accent);color:#0D0F11;font-weight:600;font-size:15px;display:flex;align-items:center}
.hero{padding:76px 40px 0;display:grid;gap:18px;max-width:900px}
.hero .big{font:700 46px/1.02 "Archivo Expanded",Arial,sans-serif;text-transform:uppercase}
.hero .sub{font-size:19px;color:var(--ink2)}
.tabs{background:#1C2025;padding:14px 20px 0;display:flex;gap:6px;align-items:flex-end}
.tab{height:40px;flex:0 1 150px;min-width:0;padding:0 14px;border-radius:9px 9px 0 0;display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink3);background:#16191D}
.tab.on{flex:1 1 auto}
.tab span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pagepeek{background:var(--bg);padding:34px 28px 40px;display:grid;gap:30px}
.pagepeek.light{background:#FFFFFF}
.tab.on{background:#2B3138;color:var(--ink1)}
.tab .fav{width:16px;height:16px;flex:none}
.tab .dot{width:16px;height:16px;border-radius:4px;background:#434A52;flex:none}
.urlbar{background:#2B3138;padding:10px 20px 12px;display:flex;gap:12px;align-items:center}
.url{flex:1;height:32px;border-radius:16px;background:#16191D;padding:0 16px;display:flex;align-items:center;font:400 12px "Martian Mono",monospace;color:var(--ink3)}
.tabsLight{background:#DEE1E6}.tabsLight .tab{background:#CDD1D7;color:#3D444C}.tabsLight .tab.on{background:#FFFFFF;color:#121518}.tabsLight .dot{background:#9AA1AA}
.urlLight{background:#FFFFFF;border-bottom:1px solid #DADDE1}.urlLight .url{background:#EEF1F4;color:#5D6570}
.phone{background:var(--s1);padding:56px 0;display:grid;place-items:center}
.device{width:316px;height:432px;border-radius:38px 38px 0 0;border:8px solid #2B3138;border-bottom:0;background:linear-gradient(#23282E,#16191D);padding:46px 28px 0}
.apps{display:grid;grid-template-columns:repeat(4,1fr);gap:22px 16px}
.app{display:grid;gap:7px;justify-items:center;font-size:10.5px;color:var(--ink2);white-space:nowrap}
.app i{display:block;width:52px;height:52px;border-radius:12px;background:#434A52}
.app svg{border-radius:12px;box-shadow:0 0 0 1px #434A52}
.mail{background:#E8EAED;padding:52px 0;display:grid;place-items:center}
.letter{width:560px;background:#FFFFFF;color:#121518}
.letter .top{padding:26px 34px;border-bottom:1px solid #DADDE1}
.letter .body{padding:30px 34px 38px;display:grid;gap:14px}
.letter .h{font-weight:650;font-size:21px;line-height:1.25}
.letter .code{font:500 13px "Martian Mono",monospace;color:#3D444C}
.sk{display:block;height:10px;border-radius:2px;background:#DADDE1}
.sk.dark{background:#2C3238}
.lines{display:grid;gap:10px}
.letter .btn{justify-self:start;margin-top:8px}
.cards{background:var(--s1);padding:60px 0;display:grid;grid-template-columns:auto auto;justify-content:center;gap:34px;align-items:center}
.bc{width:330px;height:204px;padding:26px 28px;display:flex;flex-direction:column;justify-content:space-between}
.bc.front{background:#0D0F11;border:1px solid #434A52}
.bc.back{background:#FFFFFF;transform:translateY(22px)}
.bc .lines{width:150px}
.doc{background:#E8EAED;padding:52px 0 0;display:grid;place-items:end center}
.sheetA4{width:560px;height:372px;background:#FFFFFF;color:#000;padding:38px 40px;display:grid;align-content:start;gap:26px;overflow:hidden}
.sheetA4 .toprow{display:flex;justify-content:space-between;align-items:baseline}
.sheetA4 .title{font:700 20px "Public Sans",sans-serif;letter-spacing:.04em;text-transform:uppercase}
.sheetA4 .num{font:400 12px "Martian Mono",monospace;color:#4A4A4A}
.tbl{border-top:2px solid #000;display:grid}
.tbl div{display:grid;grid-template-columns:28px 110px minmax(0,1fr) 44px 70px;gap:14px;align-items:center;height:34px;border-bottom:1px solid #BDBDBD}
.tbl .sk{background:#BDBDBD}
.foot{padding:56px 96px 72px;display:grid;grid-template-columns:1fr auto;align-items:end;gap:40px}
.foot p{font-size:14.5px;color:var(--ink3);max-width:820px}
.foot code{font:400 12px "Martian Mono",monospace;color:var(--ink2)}
`;

const appIcon = inline(iconSvg({ rounded: false }), 52);
const fav = inline(hintedIconSvg(16), 16, "fav");

const html = `<!doctype html>
<html lang="sr-Latn-RS">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Euromotors Plus by OEM Parts — tabla vizuelnog identiteta</title>
<style>${css}</style>
</head>
<body>
<main class="board">

<header class="cover">
  <div class="bar"><span class="mono">Vizuelni identitet</span><span class="mono">Verzija 1.0 · 11.10.2026.</span></div>
  ${art("horizontal", N, 176, { label: NAME })}
  <h1>Ime firme, plus i potpis radnje koju majstori već znaju</h1>
  <p class="lede">Novi znak nosi oba imena. Euromotors Plus je firma. OEM Parts je radnja koju ljudi imaju u telefonu. Zato ime firme vodi, a radnja ga potpisuje onako kako je kupci pamte: puno „OEM“ i konturno „Parts“.</p>
  <dl class="block">
    <div><dt>Firma</dt><dd>Euromotors Plus</dd></div>
    <div><dt>Radnja</dt><dd>OEM Parts</dd></div>
    <div><dt>Delatnost</dt><dd>Delovi za VW, Audi, Škoda, SEAT i Cupra</dd></div>
    <div><dt>Sadržaj</dt><dd>Znak, boje, pismo, pravila, primena</dd></div>
  </dl>
</header>

<section class="sheet" aria-labelledby="h1">
  <div class="head"><span class="idx">01</span><h2 id="h1">Od starog ka novom</h2>
  <p>Ništa nije bačeno bez razloga. Iz svakog od dva postojeća znaka uzeto je ono po čemu se pamti, a ostalo je nacrtano iznova.</p></div>
  <div class="then">
    <div class="card"><div class="img" style="background:#FFFFFF"><img alt="Dosadašnji znak Euromotors Plus" src="${oldEuro}" width="520" height="347"></div>
      <div class="txt"><h3>Dosadašnji znak firme</h3>
      <dl class="kv"><dt>Zadržano</dt><dd>Red imena: Euromotors, pa Plus, pa OEM Parts. Linija uz reč Plus. Jedan znak levo od imena, otvoren ka njemu.</dd>
      <dt>Izostavljeno</dt><dd>Serifno pismo, neujednačene zvezdice i prazan prostor oko znaka. Krug zvezdica nije zadržan ni u naznaci: dvanaest zvezdica u krugu je zaštićen amblem Evropske unije.</dd></dl></div></div>
    <div class="card"><div class="img" style="background:#000000"><img alt="Dosadašnji znak OEM Parts" src="${oldOem}" width="300" height="300"></div>
      <div class="txt"><h3>Dosadašnji znak radnje</h3>
      <dl class="kv"><dt>Zadržano</dt><dd>Puna, široka, nagnuta reč OEM, tanka linija i konturna reč Parts, manja i desno. To je ono što majstor prepozna.</dd>
      <dt>Popravljeno</dt><dd>Nacrtano čisto, u krivama, sa jednakom debljinom konture i jednakim razmakom između slova.</dd></dl></div></div>
  </div>
  <div class="now">
    <div class="stage">${art("horizontal", N, 118, { label: NAME })}</div>
    <div class="txt"><h3>Novi znak</h3>
      <ol>
        <li><b>1</b><span><strong>E</strong> je Euromotors: zagrada otvorena ka imenu, nacrtana debljinom slova.</span></li>
        <li><b>2</b><span><strong>Plus</strong> je deo koji leže u svoje ležište. Jedini narandžasti element.</span></li>
        <li><b>3</b><span><strong>Linija</strong> je i linija uz Plus iz starog znaka firme i linija iz znaka radnje.</span></li>
        <li><b>4</b><span><strong>OEM Parts</strong> potpisuje: puna reč i njena kontura, kao deo i njegov rendgenski snimak.</span></li>
      </ol></div>
  </div>
</section>

<section class="sheet" aria-labelledby="h2">
  <div class="head"><span class="idx">02</span><h2 id="h2">Sistem znaka</h2>
  <p>Jedan znak u sedam oblika. Bira se prema prostoru: što je mesto manje, oblik je kraći. Potpis OEM Parts se ne smanjuje ispod čitljivosti, nego se izostavlja.</p></div>
  <div class="split">${systemGround(N, "")}${systemGround(P, "light")}</div>
</section>

<section class="sheet" aria-labelledby="h3">
  <div class="head"><span class="idx">03</span><h2 id="h3">Konstrukcija</h2>
  <p>Znak je crtan na mreži, a debljine su uzete iz slova imena. Zato znak i ime izgledaju kao jedna celina i u jednoj boji i na šesnaest piksela.</p></div>
  <div class="build">
    ${markConstruction()}
    <div class="notes">
      ${strokeLogic()}
      <div class="note"><h3>Mreža 16 × 20</h3><p>Zagrada je visoka dvadeset jedinica i široka šesnaest. Plus je širok devet jedinica i stoji jednu jedinicu od kičme, kao deo uz svoje ležište. Vodoravni potezi su tanji od uspravnih, isto kao u slovima, pa svi izgledaju jednako teški.</p></div>
      <div class="note"><h3>Razmak između slova</h3><p>Razmaci u reči EUROMOTORS su izmereni i ručno ujednačeni: slovo T je imalo previše vazduha sa obe strane, M premalo. Sada nijedan par ne odstupa više od jednog procenta visine slova.</p></div>
    </div>
  </div>
  <div class="wideframe">${lockupConstruction()}<span class="mono">Visina znaka = visina oba reda imena · slobodan prostor sa svake strane = širina plusa (9 u)</span></div>
  <div class="sizes">
    <div>${art("horizontal", N, MIN.horizontal.px)}<span class="mono">Osnovni · 56 px · 14 mm</span></div>
    <div>${art("header", N, MIN.header.px)}<span class="mono">Zaglavlje · 28 px · 8 mm</span></div>
    <div>${art("mark", N, 32)}<span class="mono">Znak · 32 px</span></div>
    <div>${inline(hintedIconSvg(16), 16)}<span class="mono">Ikonica · 16 px, crtana piksel po piksel</span></div>
  </div>
</section>

<section class="sheet" aria-labelledby="h4">
  <div class="head"><span class="idx">04</span><h2 id="h4">Boje i pismo</h2>
  <p>Iste boje kao na sajtu. Narandžasta znači jedno: deo koji tražite. Zato je u znaku narandžast samo plus.</p></div>
  <div class="swatches">
    ${swatches.map(([n, hex, rgbv, use]) => `<div class="sw"><div class="chip" style="background:${hex}"></div><div class="txt"><b>${n}</b><code>${hex}</code><code>RGB ${rgbv}</code><p>${use}</p></div></div>`).join("")}
  </div>
  <div class="type">
    <div><span class="mono">Ime firme · Archivo Expanded 800</span><div class="spec">Euromotors Plus</div><p>Široka verzalna slova, kao oznaka modela na vozilu. U znaku su slova pretvorena u krive i ručno razmaknuta. Isto pismo nosi naslove na sajtu.</p></div>
    <div><span class="mono">Potpis radnje · Saira Expanded Italic</span><div class="spec" style="margin:22px 0 22px">${art("oemParts", N, 74, { label: "OEM Parts" })}</div><p>Koristi se samo za reči OEM i Parts, uvek kao gotov crtež. Proširena je i nagnuta do ugla dosadašnjeg znaka radnje.</p></div>
    <div><span class="mono">Tekst · Public Sans</span><div class="spec ui">Kočioni disk, prednji levi</div><p>Za sve što se čita: opise, cene, dokumenta, e-poštu. Podržava č, ć, ž, š i đ.</p></div>
    <div><span class="mono">Brojevi delova · Martian Mono</span><div class="spec mono2">5Q0 615 301 F</div><p>Za OEM brojeve, šifre i brojeve porudžbina. Nula i slovo O se jasno razlikuju.</p></div>
  </div>
</section>

<section class="sheet" aria-labelledby="h5">
  <div class="head"><span class="idx">05</span><h2 id="h5">Varijante boja</h2>
  <p>Pet varijanti pokriva sve podloge. U jednoj boji znak ostaje isti: plus se razlikuje oblikom, ne samo bojom.</p></div>
  <div class="variants">
    ${variants.map(([v, t, f, bg, cls]) => `<div class="variant ${cls}" style="background:${bg}"><div class="pair">${art("header", v, 38, { label: `${t}: Euromotors Plus` })}${art("mark", v, 56)}</div><figcaption><span class="t">${t}</span><span class="m">${f}.svg · .png · .pdf</span></figcaption></div>`).join("")}
  </div>
</section>

<section class="sheet" aria-labelledby="h6">
  <div class="head"><span class="idx">06</span><h2 id="h6">Pravilno i nepravilno</h2>
  <p>Znak se koristi onakav kakav je u datotekama. Ako negde ne staje, uzima se manji oblik, a ne menja se crtež.</p></div>
  <h3 class="rowlabel">Pravilno</h3>
  <div class="usage last">
    <div class="use"><div class="stage">${art("header", N, 36)}</div><div class="cap">${yes}<span>Na tamnoj podlozi: svetao znak, narandžast plus.</span></div></div>
    <div class="use"><div class="stage light">${art("header", P, 36)}</div><div class="cap">${yes}<span>Na beloj podlozi: grafitni znak, narandžast plus.</span></div></div>
    <div class="use"><div class="stage light">${art("header", "black", 36)}</div><div class="cap">${yes}<span>U jednoj boji: sve crno ili sve belo.</span></div></div>
    <div class="use"><div class="stage" style="background:#23282E">${art("mark", N, 84)}</div><div class="cap">${yes}<span>Kad nema mesta za ime: samo znak.</span></div></div>
  </div>
  <h3 class="rowlabel">Nepravilno</h3>
  <div class="usage">
    ${donts.map(([a, c], i) => `<div class="use"${i >= 4 ? ' style="border-bottom:0"' : ""}><div class="stage">${a}</div><div class="cap">${no}<span>${c}</span></div></div>`).join("")}
  </div>
</section>

<section class="sheet" aria-labelledby="h7">
  <div class="head"><span class="idx">07</span><h2 id="h7">Primena</h2>
  <p>Isti znak od kartice pregledača do boka vozila. Na tabli i na vozilu oba imena stoje u istoj visini, da onaj ko zna radnju odmah vidi OEM Parts.</p></div>

  <figure class="mock"><div class="site">
    <div class="sitebar">${art("header", N, 36, { label: "Euromotors Plus" })}
      <nav aria-hidden="true"><span>Delovi</span><span>Vozila</span><span>Za majstore</span><span>Upit po VIN-u</span></nav>
      <div class="tools" aria-hidden="true"><div class="search">OEM broj, npr. 1K0 615 301 AA</div><div class="btn">Korpa</div></div></div>
    <div class="hero" aria-hidden="true"><div class="big">Rasklopi auto. Nađi deo.</div><div class="sub">Delovi za Volkswagen, Audi, Škodu, SEAT i Cupru. Po OEM broju, po vozilu ili na 3D modelu.</div></div>
  </div><figcaption><span class="t">Zaglavlje sajta</span><span class="m">logo-header-night.svg · 36 px</span></figcaption></figure>

  <div class="mockgrid">
    <figure class="mock"><div>
      <div class="tabs" aria-hidden="true"><div class="tab"><span class="dot"></span><span>Pretraga</span></div><div class="tab on">${fav}<span>Euromotors Plus — delovi za VW grupu</span></div><div class="tab"><span class="dot"></span><span>Pošta</span></div></div>
      <div class="urlbar" aria-hidden="true"><div class="url">/delovi/kocioni-diskovi</div></div>
      <div class="pagepeek" aria-hidden="true">${art("header", N, 30)}<div class="lines" style="width:52%">${skeleton([100, 78], "dark")}</div></div>
      <div class="tabs tabsLight" aria-hidden="true"><div class="tab"><span class="dot"></span><span>Pretraga</span></div><div class="tab on">${fav}<span>Euromotors Plus — porudžbine</span></div><div class="tab"><span class="dot"></span><span>Pošta</span></div></div>
      <div class="urlbar urlLight" aria-hidden="true"><div class="url">/admin/porudzbine</div></div>
      <div class="pagepeek light" aria-hidden="true">${art("header", P, 30)}<div class="lines" style="width:52%">${skeleton([100, 78])}</div></div>
    </div><figcaption><span class="t">Kartica pregledača</span><span class="m">favicon.ico · 16 px</span></figcaption></figure>

    <figure class="mock"><div class="phone" aria-hidden="true"><div class="device"><div class="apps">
      ${Array.from({ length: 5 }, () => `<div class="app"><i></i>&nbsp;</div>`).join("")}
      <div class="app">${appIcon}Euromotors</div>
      ${Array.from({ length: 6 }, () => `<div class="app"><i></i>&nbsp;</div>`).join("")}
    </div></div></div><figcaption><span class="t">Ikonica aplikacije</span><span class="m">apple-touch-icon.png · icon-512.png</span></figcaption></figure>

    <figure class="mock"><div class="mail"><div class="letter">
      <div class="top">${art("horizontal", P, 56, { label: NAME })}</div>
      <div class="body" aria-hidden="true"><div class="h">Porudžbina je primljena</div><div class="code">SK-2026-000123</div>
        <div class="lines">${skeleton([92, 86, 64])}</div><div class="btn">Pogledajte status porudžbine</div></div>
    </div></div><figcaption><span class="t">E-pošta</span><span class="m">email-header@2x.png · na beloj</span></figcaption></figure>

    <figure class="mock"><div class="doc"><div class="sheetA4">
      ${art("horizontal", "black", 56, { label: NAME })}
      <div class="toprow" aria-hidden="true"><div class="title">Predračun</div><div class="num">SK-2026-000123</div></div>
      <div class="tbl" aria-hidden="true">${Array.from({ length: 4 }, (_, i) => `<div>${skeleton([60 + i * 8, 80 - i * 6, 70 + i * 5, 55, 75])}</div>`).join("")}</div>
    </div></div><figcaption><span class="t">Dokument u jednoj boji</span><span class="m">logo-horizontal-black.svg · .pdf</span></figcaption></figure>
  </div>

  <div class="mockgrid" style="margin-top:24px">
    <figure class="mock">${sign()}<figcaption><span class="t">Tabla iznad radnje</span><span class="m">logo-dual-night · mark-night</span></figcaption></figure>
    <figure class="mock"><div style="background:#16191D">${van()}</div><figcaption><span class="t">Dostavno vozilo</span><span class="m">logo-dual-paper · mark-paper</span></figcaption></figure>
  </div>

  <figure class="mock" style="margin-top:24px"><div class="cards">
    <div class="bc front">${art("mark", N, 72, { label: "Euromotors Plus" })}<div style="align-self:flex-end">${art("oemParts", N, 44, { label: "OEM Parts" })}</div></div>
    <div class="bc back">${art("header", P, 34, { label: "Euromotors Plus" })}<div class="lines" aria-hidden="true">${skeleton([100, 72, 86])}</div></div>
  </div><figcaption><span class="t">Vizitkarta</span><span class="m">mark-night · oem-parts-night · logo-header-paper</span></figcaption></figure>
</section>

<footer class="foot">
  <p>Datoteke za sajt su u <code>public/brand</code>, a komplet za štampu i saradnike u <code>docs/brand/export</code> (SVG, PNG u tri veličine, PDF). Pravila upotrebe, spisak datoteka i licence pisama: <code>docs/brand/LOGO.md</code>.</p>
  ${art("mark", N, 56)}
</footer>

</main>
</body>
</html>
`;

await writeFile(path.join(OUT, "BRAND-BOARD.html"), html);

// Render at 1600 px and report anything the page asked the network for.
const browser = await getBrowser();
const page = await browser.newPage({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 1,
});
const requests = [];
const consoleMessages = [];
page.on("request", (r) => {
  if (!r.url().startsWith("data:") && !r.url().startsWith("file:")) requests.push(r.url());
});
page.on("console", (m) => consoleMessages.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => consoleMessages.push(`pageerror: ${e.message}`));
await page.goto(
  `file:///${path.join(OUT, "BRAND-BOARD.html").replaceAll("\\", "/").replaceAll(" ", "%20")}`,
);
await page.evaluate(() => document.fonts.ready);
const info = await page.evaluate(() => ({
  width: document.documentElement.scrollWidth,
  height: document.documentElement.scrollHeight,
  fonts: [...document.fonts]
    .filter((f) => f.status === "loaded")
    .map((f) => `${f.family} ${f.weight}`),
  overflow: [...document.querySelectorAll(".board *")].filter(
    (e) => e.getBoundingClientRect().right > 1600.5 && !e.closest("svg"),
  ).length,
}));
await page.screenshot({ path: path.join(OUT, "BRAND-BOARD.png"), fullPage: true });
await page.close();
await closeBrowser();
console.log(
  `BRAND-BOARD.html ${(html.length / 1024).toFixed(0)} KB · PNG ${info.width} × ${info.height} · external requests: ${requests.length} · console: ${consoleMessages.length} · elements past the right edge: ${info.overflow}`,
);
console.log(`fonts loaded: ${[...new Set(info.fonts)].join(", ")}`);
if (requests.length || consoleMessages.length) {
  console.log(requests.join("\n"), consoleMessages.join("\n"));
  process.exit(1);
}
