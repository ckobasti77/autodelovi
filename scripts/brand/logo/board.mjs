// The brand board for the owner and the client (step 33: the star arc): one self-contained HTML
// file (inline SVG, CSS and fonts, no external requests) and its PNG render at 1600 px.
// Usage: node scripts/brand/logo/board.mjs   (after build.mjs)
// Output: docs/brand/BRAND-BOARD.html, docs/brand/BRAND-BOARD.png
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { fill } from "./lib/parts.mjs";
import { closeBrowser, getBrowser, svgToPng } from "./lib/render.mjs";
import {
  ARCS,
  HORIZONTAL,
  LOCKUPS,
  MIN,
  STACKED,
  STAR,
  THEMES,
  arcStars,
  hintedIconSvg,
  horizontal,
  iconSvg,
  stacked,
  star,
  starsInk,
} from "./logo.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT = path.join(ROOT, "docs/brand");
const N = THEMES.night;
const NAVY = THEMES.navy;
const NAME = "Euromotors Plus · OEM Parts";

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

/** A lockup as inline SVG sized by height (px). */
function art(kind, theme, height, { label, style = "" } = {}) {
  const a = LOCKUPS[kind]();
  const t = typeof theme === "string" ? THEMES[theme] : theme;
  const w = (a.w / a.h) * height;
  const aria = label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`;
  return `<svg class="art" ${aria} viewBox="0 0 ${a.w} ${a.h}" width="${w.toFixed(1)}" height="${height}"${style ? ` style="${style}"` : ""}>${fill(a.ink, t.ink)}</svg>`;
}
/** A generated icon document, inlined at a size. */
const inline = (svg, size, cls = "") =>
  svg
    .replace(
      /<svg [^>]*viewBox="([^"]+)"[^>]*>/,
      `<svg class="${cls}" aria-hidden="true" viewBox="$1" width="${size}" height="${size}">`,
    )
    .replace(/<title>.*?<\/title>/, "");
const zoomed = async (px, zoom) => {
  const png = await sharp(svgToPng(hintedIconSvg(px), px))
    .resize(px * zoom, px * zoom, { kernel: "nearest" })
    .png()
    .toBuffer();
  return `<img alt="" width="${px * zoom}" height="${px * zoom}" src="data:image/png;base64,${png.toString("base64")}" style="image-rendering:pixelated">`;
};
const dataUri = async (file, width) => {
  const buf = await sharp(path.join(OUT, "source", file))
    .resize({ width })
    .jpeg({ quality: 82 })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
};
const deg = (a) => `${Math.round(a)}°`;

// ---------------------------------------------------------------------------------------------
// Construction drawings, computed from the same numbers as the logo
// ---------------------------------------------------------------------------------------------

/** The stacked logo on the board's field with its arc, centre, text axis and opening. */
function arcConstruction() {
  const s = stacked();
  const A = STACKED.arc;
  const stars = arcStars(A);
  const pad = 70;
  const W = 860 + pad * 2;
  const H = 470 + pad * 2;
  const ray = (a, len) => {
    const r = (a * Math.PI) / 180;
    return `${A.cx + Math.cos(r) * A.rx * len} ${A.cy + Math.sin(r) * A.ry * len}`;
  };
  const first = stars[0];
  const last = stars[stars.length - 1];
  const labels = stars
    .map((p, i) =>
      i === 0 || i === stars.length - 1 || i === 5
        ? `<text x="${p.x + (p.x < A.cx ? -34 : 30)}" y="${p.y + 5}" text-anchor="${p.x < A.cx ? "end" : "start"}">${i + 1} · r ${p.R.toFixed(0)}</text>`
        : "",
    )
    .join("");
  return `<svg class="drawing" role="img" aria-label="Konstrukcija luka: elipsa, središte, osa teksta i otvor desno" viewBox="${-pad} ${-pad} ${W} ${H}" width="${W}" height="${H}">
    <ellipse class="guide" cx="${A.cx}" cy="${A.cy}" rx="${A.rx}" ry="${A.ry}"/>
    <path class="guide thin" d="M${A.cx - 14} ${A.cy}h28M${A.cx} ${A.cy - 14}v28"/>
    <path class="guide accent" d="M${ray(first.tip, 1.2)}L${ray(first.tip, 0.82)}M${ray(last.tip, 1.2)}L${ray(last.tip, 0.82)}"/>
    <path class="guide accent" d="M${A.cx - 9} ${A.cy - 9}l18 18m0 -18l-18 18"/>
    <path class="guide axis" d="M${STACKED.x} ${-30}V${500}"/>
    <path fill="${N.ink}" fill-rule="evenodd" d="${s.text}"/>
    <path fill="${N.ink}" fill-rule="evenodd" d="${starsInk(stars)}"/>
    <g class="labels">
      <text x="${STACKED.x + 10}" y="${-38}">osa teksta · ${STACKED.x - A.cx} desno od središta</text>
      <text x="${A.cx + A.rx + 74}" y="${A.cy + 5}">otvor ${deg(360 - A.sweep)}</text>
      ${labels}
      <text x="${A.cx - A.rx}" y="${A.cy + A.ry + 52}">× središte luka · elipsa ${A.rx} × ${A.ry} · ${A.n} zvezda · luk ${deg(A.sweep)} · zvezde rastu ${(A.r0 / A.r1).toFixed(2).replace(".", ",")} → 1</text>
    </g></svg>`;
}

/** One star, large: the polygon, its two radii and the round join. */
function starConstruction() {
  const R = 150;
  const c = 210;
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * STAR.inner : R;
    const a = ((-90 + i * 36) * Math.PI) / 180;
    pts.push(`${c + r * Math.cos(a)} ${c + r * Math.sin(a)}`);
  }
  return `<svg class="drawing" role="img" aria-label="Konstrukcija zvezde" viewBox="0 0 420 420" width="420" height="420" overflow="visible">
    <path fill="${N.ink}" opacity=".9" d="${star(c, c, R)}"/>
    <circle class="guide" cx="${c}" cy="${c}" r="${R}"/>
    <circle class="guide" cx="${c}" cy="${c}" r="${R * STAR.inner}"/>
    <path class="guide accent" fill="none" d="M${pts.join("L")}Z"/>
    <g class="labels"><text x="${c + R * 0.74}" y="${c - R * 0.8}">R</text><text x="${c - R}" y="${c + R + 34}">spoljni krug R · unutrašnji ${String(STAR.inner).replace(".", ",")} R</text></g>
  </svg>`;
}

/** The horizontal lockup with its ring centre and the two lines of the block. */
function horizontalConstruction() {
  const h = horizontal();
  const b = h.block;
  const k = HORIZONTAL.mark / 120;
  const cx = ARCS.compact.cx * k;
  const cy = b.h / 2;
  const W = b.x2 + 40;
  const line = (y, label) =>
    `<path class="guide thin" d="M${-30} ${y}H${W}"/><text x="${W + 8}" y="${y + 5}">${label}</text>`;
  return `<svg class="drawing" role="img" aria-label="Konstrukcija vodoravnog znaka" viewBox="-40 -40 ${W + 230} ${b.h + 80}" width="${((W + 230) * 1.25).toFixed(0)}" height="${((b.h + 80) * 1.25).toFixed(0)}">
    ${line(0, "C")}${line(b.base1, "")}${line(b.base2 - b.c2, "")}${line(b.base2, `${String(HORIZONTAL.line2.toFixed(2)).replace(".", ",")} C`)}
    <path class="guide accent" d="M${cx - 10} ${cy}h20M${cx} ${cy - 10}v20M${cx + 30} ${cy}H${b.x1 - 6}"/>
    <path fill="${N.ink}" fill-rule="evenodd" d="${h.text}"/>
    <path fill="${N.ink}" fill-rule="evenodd" d="${starsInk(h.stars)}"/>
  </svg>`;
}

// ---------------------------------------------------------------------------------------------
// Do / don't artwork
// ---------------------------------------------------------------------------------------------

/** Twelve equal upright stars in a closed ring — the EU emblem the logo must never become. */
function closedRing(size) {
  const ring = arcStars({ cx: 60, cy: 60, rx: 44, n: 12, r0: 8, r1: 8, a0: -90, sweep: 330 });
  return `<svg aria-hidden="true" viewBox="0 0 120 120" width="${size}" height="${size}"><path fill="${N.ink}" d="${ring.map((s) => star(s.x, s.y, s.R, -90)).join("")}"/></svg>`;
}

// ---------------------------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------------------------
const oldEuro = await dataUri("euromotors-plus-current.jpg", 760);
const oldOem = await dataUri("oem-parts-current.webp", 520);

const FORMS = [
  [
    "stacked",
    "Osnovni, uspravni",
    "logo-stacked",
    230,
    MIN.stacked,
    "Ulaz, tabla, vozilo, naslovna strana, podnožje sajta.",
  ],
  [
    "horizontal",
    "Vodoravni",
    "logo-horizontal",
    84,
    MIN.horizontal,
    "Zaglavlje sajta, admin, e-pošta, dokumenta, OG slike.",
  ],
  [
    "mark",
    "Znak, deset zvezda",
    "mark",
    120,
    MIN.mark,
    "Ikonica aplikacije, profilna slika, pečat. Od 48 px.",
  ],
  [
    "markSmall",
    "Mali znak, pet zvezda",
    "mark-small",
    72,
    MIN.markSmall,
    "32 px i manje: kartica pregledača, telefon, admin traka.",
  ],
  ["wordmark", "Samo ime", "logo-wordmark", 60, MIN.wordmark, "Kada znak već stoji pored."],
  [
    "oemParts",
    "OEM Parts",
    "oem-parts",
    84,
    MIN.oemParts,
    "Mesta na kojima stoji samo ime radnje.",
  ],
];
const form = ([kind, title, file, h, min, use], theme) =>
  `<figure>${art(kind, theme, h, { label: `${title}: ${kind === "oemParts" ? "OEM Parts" : NAME}` })}<figcaption><span class="t">${title}</span><span class="m">${file}-* · najmanje ${min.px} px / ${min.mm} mm</span><span class="u">${use}</span></figcaption></figure>`;

const swatches = [
  ["Noć", "#0D0F11", "13 · 15 · 17", "Podloga sajta, ikonica, tabla.", "dark"],
  ["Topla bela", "#F1ECE3", "241 · 236 · 227", "Logo na tamnoj podlozi.", "lightsw"],
  ["Grafit", "#121518", "18 · 21 · 24", "Logo na beloj podlozi ekrana: admin.", "dark"],
  [
    "Tamnoplava",
    "#1B2A6B",
    "27 · 42 · 107",
    "Boja prvog loga firme: štampa, dokumenta, e-pošta na beloj.",
    "dark",
  ],
  ["Papir", "#FFFFFF", "255 · 255 · 255", "Dokumenta, e-pošta.", "lightsw"],
  ["Crna", "#000000", "0 · 0 · 0", "Jednobojna štampa, pečat, graviranje.", "dark"],
];

const variants = [
  ["night", "Na tamnoj", N.bg, ""],
  ["paper", "Na beloj, ekran", "#FFFFFF", "light"],
  ["navy", "Na beloj, štampa", "#FFFFFF", "light"],
  ["black", "Jedna boja, crna", "#FFFFFF", "light"],
  ["white", "Jedna boja, bela", N.bg, ""],
];

const donts = [
  [
    closedRing(104),
    "Luk se ne zatvara i zvezde se ne izjednačavaju: dvanaest jednakih zvezda u krugu je amblem Evropske unije.",
  ],
  [
    `<div style="transform:scaleX(1.4)">${art("horizontal", N, 30)}</div>`,
    "Ne razvlačiti i ne sabijati.",
  ],
  [
    `<div style="transform:rotate(180deg)">${art("mark", N, 80)}</div>`,
    "Ne okretati: luk je uvek otvoren udesno, zvezde rastu naniže.",
  ],
  [
    art("horizontal", { ink: "#FF6B1A" }, 34),
    "Logo nije narandžast. Narandžasta je boja dugmadi i signala na sajtu.",
  ],
  [
    `<div style="filter:drop-shadow(0 6px 5px rgba(255,255,255,.5))">${art("horizontal", N, 34)}</div>`,
    "Bez senke, sjaja, okvira i prelaza.",
  ],
  [
    `<div class="busy">${art("horizontal", N, 30)}</div>`,
    "Ne na šarenu podlogu ili fotografiju bez dovoljnog kontrasta.",
  ],
  [art("horizontal", N, 26), `Vodoravni ne ispod ${MIN.horizontal.px} px: tada ide mali znak.`],
  [
    `<div class="typed">EUROMOTORS<br><small>PLUS — OEM Parts</small></div>`,
    "Ime se ne kuca drugim pismom pored zvezda.",
  ],
];

const css = `
${FONTS}
:root{--bg:#0D0F11;--raised:#121518;--s1:#16191D;--s2:#1C2025;--s3:#23282E;--line:#2C3238;--line-strong:#434A52;--ink1:#F1ECE3;--ink2:#C4BEB4;--ink3:#969088;--accent:#FF6B1A;--ok:#4FD18B;--bad:#FF6166;color-scheme:dark}
*{box-sizing:border-box}
html{background:var(--bg)}
body{margin:0;background:var(--bg);color:var(--ink1);font:400 16px/1.55 "Public Sans",Arial,sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.board{width:1600px;margin:0 auto}
svg{display:block}
h1,h2,h3,p,figure{margin:0}
.mono{font:400 12px/1.4 "Martian Mono",ui-monospace,monospace;letter-spacing:.04em;color:var(--ink3);text-transform:uppercase}
.cover{padding:72px 96px 88px;border-bottom:1px solid var(--line)}
.cover .bar{display:flex;justify-content:space-between;margin-bottom:110px}
.cover .stage{display:grid;place-items:center}
.cover h1{font:700 44px/1.08 "Archivo Expanded",Arial,sans-serif;text-transform:uppercase;letter-spacing:.005em;max-width:1180px;margin-top:110px;text-wrap:balance}
.cover .lede{font-size:20px;line-height:1.5;color:var(--ink2);max-width:780px;margin-top:28px}
.block{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--line);margin-top:80px}
.block div{padding:18px 20px 0 0}
.block dt{font:400 11px/1.3 "Martian Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--ink3)}
.block dd{margin:6px 0 0;font-size:16px;color:var(--ink1)}
dl{margin:0}
.sheet{padding:104px 96px;border-bottom:1px solid var(--line)}
.head{display:grid;grid-template-columns:96px 1fr;align-items:baseline;margin-bottom:56px}
.head .idx{font:600 20px/1 "Archivo Expanded",Arial,sans-serif;color:var(--ink3);font-variant-numeric:tabular-nums}
.head h2{font:600 34px/1.08 "Archivo Expanded",Arial,sans-serif;text-transform:uppercase;letter-spacing:.005em}
.head p{grid-column:2;font-size:18px;line-height:1.5;color:var(--ink2);max-width:800px;margin-top:16px}
figure{display:flex;flex-direction:column;gap:18px}
figcaption{display:flex;flex-direction:column;gap:4px}
figcaption .t{font-weight:600;font-size:15px}
figcaption .m{font:400 11px/1.4 "Martian Mono",monospace;letter-spacing:.03em;color:var(--ink3)}
figcaption .u{font-size:14px;color:var(--ink2);max-width:300px}
.light figcaption .t{color:#121518}.light figcaption .m{color:#5D6570}.light figcaption .u{color:#3D444C}
.then{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.then .card{border:1px solid var(--line);display:grid;grid-template-rows:300px auto}
.then .img{display:grid;place-items:center;overflow:hidden}
.then .img img{display:block;max-width:100%;max-height:100%}
.then .txt{padding:24px 28px 28px;border-top:1px solid var(--line)}
.then h3,.now h3{font-weight:650;font-size:18px;margin-bottom:12px}
.kv{display:grid;grid-template-columns:104px 1fr;gap:8px 16px;font-size:15px;line-height:1.5;color:var(--ink2)}
.kv dt{font:400 11px/1.9 "Martian Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--ink3)}
.kv dd{margin:0}
.now{margin-top:24px;border:1px solid var(--line-strong);display:grid;grid-template-columns:1.2fr 1fr}
.now .stage{padding:56px;display:grid;place-items:center;background:var(--raised)}
.now .txt{padding:40px 44px;border-left:1px solid var(--line)}
.now ol{margin:0;padding:0;list-style:none;display:grid;gap:14px;font-size:15.5px;line-height:1.5;color:var(--ink2)}
.now li{display:grid;grid-template-columns:28px 1fr}
.now li b{font:600 13px/1.75 "Archivo Expanded",Arial,sans-serif;color:var(--ink3)}
.now strong{color:var(--ink1);font-weight:600}
.grounds{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);border:1px solid var(--line)}
.ground{padding:64px 56px;display:grid;gap:64px;align-content:start}
.ground.light{background:#FFFFFF}
.pair{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-end;gap:40px 32px}
.build{display:grid;grid-template-columns:auto 1fr;gap:56px;align-items:start}
.drawing .guide{fill:none;stroke:var(--ink3);stroke-width:1.5;stroke-dasharray:8 7}
.drawing .guide.thin{stroke-width:1;stroke-dasharray:4 5}
.drawing .guide.accent{stroke:var(--accent);stroke-dasharray:none;stroke-width:1.5}
.drawing .guide.axis{stroke:var(--accent);stroke-dasharray:3 6}
.drawing text,.drawing .labels text{font:400 13px "Martian Mono",monospace;fill:var(--ink2);letter-spacing:.02em}
.notes{display:grid;gap:28px}
.note h3{font-weight:650;font-size:17px;margin-bottom:6px}
.note p{font-size:15.5px;color:var(--ink2);max-width:520px}
.frame{border:1px solid var(--line);padding:32px 36px;margin-top:40px;display:flex;gap:56px;align-items:center}
.smalls{display:flex;gap:40px;align-items:flex-end;flex-wrap:wrap}
.smalls figure{gap:10px}
.tabs{background:#202124;padding:10px 12px 0;display:flex;gap:4px;align-items:flex-end;width:620px}
.tab{height:36px;flex:0 1 200px;min-width:0;padding:0 12px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:8px;font-size:13px;color:#9AA0A6}
.tab.on{background:#35363A;color:#E8EAED;flex:0 1 260px}
.tab span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tabsLight{background:#DEE1E6}.tabsLight .tab{color:#5F6368}.tabsLight .tab.on{background:#FFFFFF;color:#202124}
.swatches{display:grid;grid-template-columns:repeat(6,1fr);border:1px solid var(--line)}
.sw{border-right:1px solid var(--line)}.sw:last-child{border-right:0}
.sw .chip{height:150px;border-bottom:1px solid var(--line)}
.sw .txt{padding:18px 18px 22px}
.sw b{display:block;font-weight:650;font-size:16px}
.sw code{display:block;font:500 13px/1.6 "Martian Mono",monospace;color:var(--ink1);margin-top:6px}
.sw code + code{font-weight:400;font-size:11px;color:var(--ink3);margin-top:0}
.sw p{font-size:13.5px;line-height:1.45;color:var(--ink2);margin-top:10px}
.signal{margin-top:24px;border:1px solid var(--line);padding:22px 28px;display:grid;grid-template-columns:44px 1fr;gap:20px;align-items:center;color:var(--ink2);font-size:15px}
.signal i{display:block;width:44px;height:44px;border-radius:6px;background:var(--accent)}
.type{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--line);margin-top:24px}
.type > div{padding:32px 40px 36px;border-right:1px solid var(--line)}
.type > div:last-child{border-right:0}
.type p{font-size:14.5px;color:var(--ink2);max-width:560px;margin-top:10px}
.variants{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid var(--line)}
.variant{padding:40px 28px 24px;display:grid;gap:28px;border-right:1px solid var(--line);align-content:start}
.variant:last-child{border-right:0}
.rules{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.rules .box{border:1px solid var(--line);padding:32px 36px}
.rules table{border-collapse:collapse;width:100%;font-size:14.5px;color:var(--ink2)}
.rules td,.rules th{text-align:left;padding:9px 0;border-bottom:1px solid var(--line)}
.rules th{font:400 11px "Martian Mono",monospace;letter-spacing:.04em;text-transform:uppercase;color:var(--ink3)}
.clear{position:relative;display:inline-block;padding:28px;outline:1.5px dashed var(--accent);outline-offset:0}
.usage{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);margin-top:24px}
.use{border-right:1px solid var(--line);border-bottom:1px solid var(--line);display:grid;grid-template-rows:176px auto}
.use:nth-child(4n){border-right:0}
.use:nth-last-child(-n+4){border-bottom:0}
.use .stage{display:grid;place-items:center;overflow:hidden;padding:20px}
.use .cap{display:grid;grid-template-columns:22px 1fr;align-items:start;gap:8px;padding:16px 20px 20px;border-top:1px solid var(--line);font-size:14px;line-height:1.4;color:var(--ink2)}
.bad{color:var(--bad)}
.busy{background:repeating-linear-gradient(135deg,#FF6B1A 0 22px,#2B6CB0 22px 44px);padding:20px}
.typed{font:700 26px/1 Georgia,serif;color:var(--ink1);text-align:center}.typed small{font-size:14px}
.mock{border:1px solid var(--line);margin-top:24px;gap:0}
.mock > figcaption{padding:16px 24px;border-top:1px solid var(--line);flex-direction:row;justify-content:space-between;align-items:baseline}
.mockgrid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.mockgrid .mock{margin-top:0}
.sitebar{height:64px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:40px;padding:0 32px;background:var(--raised);border-bottom:1px solid var(--line)}
.sitebar nav{display:flex;gap:28px;font-weight:600;font-size:15px;color:var(--ink2)}
.search{width:300px;height:40px;border:1px solid #6E767F;background:var(--s2);border-radius:6px;display:flex;align-items:center;padding:0 14px;font:400 13px "Martian Mono",monospace;color:var(--ink3)}
.hero{padding:64px 32px 72px;display:grid;gap:14px}
.hero .big{font:700 44px/1.02 "Archivo Expanded",Arial,sans-serif;text-transform:uppercase}
.hero .sub{font-size:18px;color:var(--ink2)}
.mail{background:#E8EAED;padding:44px 0;display:grid;place-items:center}
.letter{width:560px;background:#FFFFFF;color:#121518;border-radius:12px;overflow:hidden;border:1px solid #DADDE1}
.letter .top{padding:14px 24px;border-bottom:1px solid #DADDE1}
.letter .body{padding:26px 32px 34px;display:grid;gap:12px}
.letter .h{font-weight:650;font-size:21px}
.sk{display:block;height:10px;border-radius:2px;background:#DADDE1}
.lines{display:grid;gap:10px}
.doc{background:#E8EAED;padding:44px 0 0;display:grid;place-items:end center}
.a4{width:560px;height:330px;background:#FFFFFF;padding:34px 40px;display:grid;align-content:start;gap:24px}
.a4 .row{display:flex;justify-content:space-between;align-items:flex-end}
.a4 .title{font:700 18px "Public Sans",sans-serif;letter-spacing:.04em;text-transform:uppercase;color:#121518}
.a4 .num{font:400 12px "Martian Mono",monospace;color:#5D6570}
.phone{background:var(--s1);padding:48px 0;display:grid;place-items:center}
.device{width:300px;height:330px;border-radius:36px 36px 0 0;border:8px solid #2B3138;border-bottom:0;background:linear-gradient(#23282E,#16191D);padding:40px 26px 0}
.apps{display:grid;grid-template-columns:repeat(4,1fr);gap:20px 14px}
.app{display:grid;gap:7px;justify-items:center;font-size:10.5px;color:var(--ink2);white-space:nowrap}
.app i{display:block;width:50px;height:50px;border-radius:12px;background:#434A52}
.app svg{border-radius:12px}
.foot{padding:56px 96px 72px;display:grid;grid-template-columns:1fr auto;align-items:end;gap:40px}
.foot p{font-size:14.5px;color:var(--ink3);max-width:820px}
.foot code{font:400 12px "Martian Mono",monospace;color:var(--ink2)}
`;

const fav = inline(hintedIconSvg(16), 16);
const appIcon = inline(iconSvg({ rounded: false }), 50);
const tabs = (cls) => `<div class="tabs ${cls}">
  <div class="tab on">${fav}<span>Auto delovi VW, Audi, Škoda | Euromotors Plus · OEM Parts</span></div>
  <div class="tab">${fav}<span>Kočioni diskovi</span></div></div>`;

const html = `<!doctype html>
<html lang="sr-Latn-RS">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Euromotors Plus · OEM Parts — tabla vizuelnog identiteta</title>
<style>${css}</style>
</head>
<body>
<main class="board">

<header class="cover">
  <div class="bar"><span class="mono">Vizuelni identitet</span><span class="mono">Verzija 2.0 · 15.10.2026.</span></div>
  <div class="stage">${art("stacked", N, 430, { label: NAME })}</div>
  <h1>Luk zvezda sa prvog loga firme, nacrtan iznova</h1>
  <p class="lede">Zvezde su ostale, ime je ostalo, Plus između dve linije je ostao. Novo je to što su zvezde čiste i rastu niz luk, pa luk deluje kao da se kreće, i što ispod imena stoji OEM Parts onako kako ga kupci znaju.</p>
  <dl class="block">
    <div><dt>Firma</dt><dd>Euromotors Plus</dd></div>
    <div><dt>Radnja</dt><dd>OEM Parts</dd></div>
    <div><dt>Delatnost</dt><dd>Delovi za VW, Audi, Škoda, SEAT i Cupra</dd></div>
    <div><dt>Sadržaj</dt><dd>Oblici, konstrukcija, boje, pravila, primena</dd></div>
  </dl>
</header>

<section class="sheet" aria-labelledby="h1">
  <div class="head"><span class="idx">01</span><h2 id="h1">Od starog ka novom</h2>
  <p>Iz oba postojeća znaka uzeto je ono po čemu se pamte. Ostalo je nacrtano iznova, geometrijski, da drži i na 16 piksela i na tabli iznad radnje.</p></div>
  <div class="then">
    <div class="card"><div class="img" style="background:#FFFFFF"><img alt="Dosadašnji znak Euromotors Plus" src="${oldEuro}" width="520" height="347"></div>
      <div class="txt"><h3>Prvi znak firme</h3>
      <dl class="kv"><dt>Zadržano</dt><dd>Luk od dvanaest zvezda oko imena, otvoren desno. EUROMOTORS, ispod PLUS između dve linije. Tamnoplava boja, za štampu.</dd>
      <dt>Novo</dt><dd>Zvezde su čiste, geometrijske i rastu niz luk. Ime je u širokom pismu sajta. Sve je u krivama, u jednoj boji.</dd></dl></div></div>
    <div class="card"><div class="img" style="background:#000000"><img alt="Dosadašnji znak OEM Parts" src="${oldOem}" width="300" height="300"></div>
      <div class="txt"><h3>Znak radnje</h3>
      <dl class="kv"><dt>Zadržano</dt><dd>Puna, široka, nagnuta reč OEM i konturna reč Parts. To majstor prepozna.</dd>
      <dt>Novo</dt><dd>Kontura iste debljine na svakom slovu, slova na jednakom razmaku, da se konture nigde ne slepe.</dd></dl></div></div>
  </div>
  <div class="now">
    <div class="stage">${art("stacked", N, 300, { label: NAME })}</div>
    <div class="txt"><h3>Novi znak</h3>
      <ol>
        <li><b>1</b><span><strong>Luk od dvanaest zvezda</strong> počinje gore desno, obilazi levo i završava se dole desno. Desno ostaje otvoren.</span></li>
        <li><b>2</b><span><strong>Zvezde rastu</strong> niz luk, od manje od pola do pune veličine, i svaka je okrenuta od središta. Luk se čita kao pokret.</span></li>
        <li><b>3</b><span><strong>EUROMOTORS</strong>, ispod <strong>PLUS</strong> između dve linije, kao na prvom znaku.</span></li>
        <li><b>4</b><span><strong>OEM Parts</strong> potpisuje: puno OEM i konturno Parts, kao na znaku radnje.</span></li>
      </ol></div>
  </div>
</section>

<section class="sheet" aria-labelledby="h2">
  <div class="head"><span class="idx">02</span><h2 id="h2">Oblici</h2>
  <p>Šest oblika za različita mesta. Ako oblik ne staje u visinu iz tabele, uzima se sledeći manji, nikad smanjen ispod najmanje veličine.</p></div>
  <div class="grounds">
    <div class="ground">${form(FORMS[0], N)}<div class="pair">${form(FORMS[1], N)}</div><div class="pair">${form(FORMS[2], N)}${form(FORMS[3], N)}</div><div class="pair">${form(FORMS[4], N)}${form(FORMS[5], N)}</div></div>
    <div class="ground light">${form(FORMS[0], NAVY)}<div class="pair">${form(FORMS[1], NAVY)}</div><div class="pair">${form(FORMS[2], NAVY)}${form(FORMS[3], NAVY)}</div><div class="pair">${form(FORMS[4], NAVY)}${form(FORMS[5], NAVY)}</div></div>
  </div>
</section>

<section class="sheet" aria-labelledby="h3">
  <div class="head"><span class="idx">03</span><h2 id="h3">Konstrukcija</h2>
  <p>Znak se ne crta ručno: sve mere su brojevi u jednoj skripti, iz koje nastaju sve datoteke. Zato su zvezde svuda iste, a luk na tabli i na ikonici ista kriva.</p></div>
  ${arcConstruction()}
  <div class="build" style="margin-top:56px">
    ${starConstruction()}
    <div class="notes">
      <div class="note"><h3>Zvezda</h3><p>Pet krakova, unutrašnji ugao na ${String(STAR.inner).replace(".", ",")} dužine kraka. Ivica je zaobljena tankom linijom (${String(STAR.join).replace(".", ",")} kraka), pa vrh nije oštar ni na velikoj tabli ni na maloj ikonici.</p></div>
      <div class="note"><h3>Luk</h3><p>Dvanaest zvezda na elipsi, od ${deg(-ARCS.stacked.a0)} iznad desne strane, ${deg(ARCS.stacked.sweep)} ulevo. Zvezde rastu od ${String((ARCS.stacked.r0 / ARCS.stacked.r1).toFixed(2)).replace(".", ",")} do pune veličine, a razmak između njih raste sa njima.</p></div>
      <div class="note"><h3>Ime</h3><p>Archivo, težina 800, širina 125. Tekst stoji malo desno od središta luka, kao na prvom znaku. Linije oko reči PLUS staju pre krajeva reči EUROMOTORS.</p></div>
      <div class="note"><h3>Vodoravni oblik</h3><p>Prsten od deset zvezda levo, ime desno; sredina imena je u visini središta prstena. Drugi red je ${String(HORIZONTAL.line2.toFixed(2)).replace(".", ",")} visine slova prvog reda, desno poravnat sa krajem reči EUROMOTORS.</p></div>
    </div>
  </div>
  <div class="frame">${horizontalConstruction()}</div>
</section>

<section class="sheet" aria-labelledby="h4">
  <div class="head"><span class="idx">04</span><h2 id="h4">Male veličine</h2>
  <p>Na 32 piksela i manje deset zvezda bi bile tačke. Zato mali znak ima pet većih zvezda, a ikonica od 16 piksela je nacrtana piksel po piksel: svaka zvezda ima vrh, krake i dve noge, i nijedna ne dodiruje susednu.</p></div>
  <div class="smalls">
    <figure>${await zoomed(16, 12)}<figcaption><span class="t">16 px, uvećano 12 puta</span><span class="m">favicon.ico · crtano po pikselu</span></figcaption></figure>
    <figure>${await zoomed(32, 6)}<figcaption><span class="t">32 px, uvećano 6 puta</span><span class="m">pet zvezda, središta na pikselu</span></figcaption></figure>
    <figure>${await zoomed(48, 4)}<figcaption><span class="t">48 px, uvećano 4 puta</span><span class="m">sedam zvezda</span></figcaption></figure>
  </div>
  <div class="frame" style="flex-direction:column;align-items:flex-start;gap:20px">${tabs("")}${tabs("tabsLight")}<span class="mono">Kartica pregledača, tamna i svetla tema, u stvarnoj veličini</span></div>
</section>

<section class="sheet" aria-labelledby="h5">
  <div class="head"><span class="idx">05</span><h2 id="h5">Boje i pismo</h2>
  <p>Logo je uvek u jednoj boji. Na sajtu je topla bela na noćnoj podlozi; na papiru je tamnoplava sa prvog znaka firme.</p></div>
  <div class="swatches">${swatches
    .map(
      ([name, hex, rgbText, use]) =>
        `<div class="sw"><div class="chip" style="background:${hex}"></div><div class="txt"><b>${name}</b><code>${hex}</code><code>RGB ${rgbText}</code><p>${use}</p></div></div>`,
    )
    .join("")}</div>
  <div class="signal"><i aria-hidden="true"></i><span><strong style="color:var(--ink1)">Signalna narandžasta #FF6B1A nije u logu.</strong> Ona je boja dugmadi, cena i sledećeg koraka na sajtu, i tako ostaje jedini signal na stranici.</span></div>
  <div class="type">
    <div><span class="mono">EUROMOTORS, PLUS</span><p><strong style="color:var(--ink1)">Archivo</strong>, težina 800, širina 125 (Expanded). Omnibus-Type, slobodna licenca SIL OFL 1.1. Isto pismo nose naslovi sajta.</p></div>
    <div><span class="mono">OEM Parts</span><p><strong style="color:var(--ink1)">Saira</strong>, kurziv, težina 900, širina 125, dodatno proširen i nagnut kao na znaku radnje. Omnibus-Type, SIL OFL 1.1. U datotekama loga slova su krive, pa ne zavise od instaliranog pisma.</p></div>
  </div>
</section>

<section class="sheet" aria-labelledby="h6">
  <div class="head"><span class="idx">06</span><h2 id="h6">Varijante</h2>
  <p>Pet boja, iste krive. Varijanta se bira po podlozi, ne po ukusu.</p></div>
  <div class="variants">${variants
    .map(
      ([v, title, bg, cls]) =>
        `<div class="variant ${cls}" style="background:${bg}">${art("stacked", v, 120)}${art("horizontal", v, 40)}<figcaption><span class="t">${title}</span><span class="m">*-${v}.svg · .pdf · .png</span></figcaption></div>`,
    )
    .join("")}</div>
</section>

<section class="sheet" aria-labelledby="h7">
  <div class="head"><span class="idx">07</span><h2 id="h7">Pravila</h2>
  <p>Oko loga ostaje prazan prostor visine najveće zvezde. U njemu nema teksta, ivica ni drugih znakova.</p></div>
  <div class="rules">
    <div class="box"><div class="clear">${art("horizontal", N, 72, { label: NAME })}</div><p class="mono" style="margin-top:18px">Slobodan prostor = visina najveće zvezde</p></div>
    <div class="box"><table>
      <tr><th>Oblik</th><th>Ekran</th><th>Štampa</th></tr>
      ${Object.entries({
        stacked: "Uspravni",
        horizontal: "Vodoravni",
        wordmark: "Samo ime",
        mark: "Znak, deset zvezda",
        markSmall: "Mali znak",
        oemParts: "OEM Parts",
      })
        .map(([k, t]) => `<tr><td>${t}</td><td>${MIN[k].px} px</td><td>${MIN[k].mm} mm</td></tr>`)
        .join("")}
    </table></div>
  </div>
  <div class="usage">${donts
    .map(
      ([artwork, text]) =>
        `<div class="use"><div class="stage">${artwork}</div><div class="cap"><span class="bad" aria-hidden="true">✕</span><span>${text}</span></div></div>`,
    )
    .join("")}</div>
</section>

<section class="sheet" aria-labelledby="h8">
  <div class="head"><span class="idx">08</span><h2 id="h8">Primena</h2>
  <p>Kako logo stoji na sajtu, u e-pošti, na dokumentu i na telefonu.</p></div>
  <figure class="mock"><div>
    <div class="sitebar">${art("horizontal", N, 48, { label: NAME })}<nav aria-hidden="true"><span style="color:var(--ink1)">Delovi</span><span>Vozila</span><span>Za majstore</span></nav><div class="search" aria-hidden="true">Broj dela ili naziv</div></div>
    <div class="hero" aria-hidden="true"><div class="big">Rasklopi auto.<br>Nađi deo.</div><div class="sub">Delovi za VW, Audi, Škoda, SEAT i Cupra vozila.</div></div>
  </div><figcaption><span class="t">Zaglavlje sajta</span><span class="m">vodoravni oblik · 48 px, na telefonu mali znak 32 px</span></figcaption></figure>
  <div class="mockgrid" style="margin-top:24px">
    <figure class="mock"><div class="mail"><div class="letter"><div class="top">${art("horizontal", NAVY, 44, { label: NAME })}</div><div class="body" aria-hidden="true"><div class="h">Primili smo porudžbinu</div><div class="lines"><span class="sk" style="width:92%"></span><span class="sk" style="width:78%"></span><span class="sk" style="width:64%"></span></div></div></div></div><figcaption><span class="t">E-pošta</span><span class="m">email-header@2x.png · tamni režim: email-header-dark@2x.png</span></figcaption></figure>
    <figure class="mock"><div class="doc"><div class="a4">${art("horizontal", NAVY, 52, { label: NAME })}<div class="row" aria-hidden="true"><span class="title">Predračun</span><span class="num">SK-2026-000123</span></div><div class="lines" aria-hidden="true"><span class="sk" style="width:100%"></span><span class="sk" style="width:100%"></span><span class="sk" style="width:70%"></span></div></div></div><figcaption><span class="t">Dokument</span><span class="m">logo-horizontal-navy · .pdf</span></figcaption></figure>
  </div>
  <div class="mockgrid" style="margin-top:24px">
    <figure class="mock"><div class="phone"><div class="device"><div class="apps" aria-hidden="true">
      <div class="app">${appIcon}<span>Euromotors</span></div><div class="app"><i></i><span>Kamera</span></div><div class="app"><i></i><span>Mape</span></div><div class="app"><i></i><span>Viber</span></div>
      <div class="app"><i></i><span>Telefon</span></div><div class="app"><i></i><span>Poruke</span></div><div class="app"><i></i><span>Kalendar</span></div><div class="app"><i></i><span>Podešavanja</span></div>
    </div></div></div><figcaption><span class="t">Ikonica na telefonu</span><span class="m">apple-touch-icon · icon-512 · icon-maskable</span></figcaption></figure>
    <figure class="mock"><div class="phone" style="background:#FFFFFF">${art("stacked", NAVY, 220, { label: NAME })}</div><figcaption><span class="t">Tabla, nalepnica, naslovna strana</span><span class="m">logo-stacked-navy · .pdf</span></figcaption></figure>
  </div>
</section>

<footer class="foot">
  <p>Datoteke za sajt su u <code>public/brand</code>, a komplet za štampu i saradnike u <code>docs/brand/export</code> (SVG, PNG u tri veličine, PDF). Pravila upotrebe, spisak datoteka i licence pisama: <code>docs/brand/LOGO.md</code>.</p>
  ${art("mark", N, 64)}
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
if (requests.length || consoleMessages.length || info.overflow) {
  console.log(requests.join("\n"), consoleMessages.join("\n"));
  process.exit(1);
}
