// Fetches SKLOP's display face — Archivo (OFL-1.1, Omnibus-Type) — as *static instances* of its
// width/weight axes from the Google Fonts CSS2 API, subset to the characters the site needs
// (Basic Latin, Latin-1, Latin Extended-A incl. č ć ž š đ, typographic punctuation, arrows).
//
// Why: the full variable Archivo (wdth 62–125 × wght 100–900) costs ~172 KB for latin + latin-ext;
// one static instance costs ~20–26 KB and is a single file (next/font/local cannot split by
// unicode-range). Design decisions: docs/design/DESIGN-SYSTEM.md §4 and docs/DECISIONS.md.
//
// Usage: node scripts/fonts/fetch-display-fonts.mjs
// Output: app/fonts/archivo-<name>.woff2 (web, used by next/font/local)
//         assets/fonts/og/archivo-<name>.woff (OG images: ImageResponse accepts ttf/otf/woff, not woff2)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const WEB_DIR = path.join(ROOT, "app/fonts");
const OG_DIR = path.join(ROOT, "assets/fonts/og");

/** Static instances used by the design system (keep in sync with DESIGN-SYSTEM.md §4). */
const INSTANCES = [
  { name: "expanded-600", wdth: 125, wght: 600 }, // display statements, section titles
  { name: "expanded-700", wdth: 125, wght: 700 }, // wordmark, hero statement
  { name: "condensed-600", wdth: 75, wght: 600 }, // numerals, stage index, KPI figures
];

const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => String.fromCodePoint(from + i)).join("");
const CHARSET = [
  range(0x20, 0x7e), // Basic Latin
  range(0xa0, 0xff), // Latin-1 Supplement (German/Czech brand names: ö ü ä ß é á)
  range(0x100, 0x17f), // Latin Extended-A (č ć đ š ž + Central European)
  "–—‘’‚“”„†•…′″‹›", // – — ‘ ’ ‚ “ ” „ † • … ′ ″ ‹ ›
  "€№™←↑→↓−∕×", // € № ™ ← ↑ → ↓ − ∕ ×
].join("");

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
// An old UA makes the CSS2 API answer with WOFF 1.0 files (needed for OG images).
const WOFF_UA = "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.30 (KHTML, like Gecko) Safari/534.30";

async function fetchFontUrl(instance, userAgent) {
  const family = `Archivo:wdth,wght@${instance.wdth},${instance.wght}`;
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%2C/g, ",").replace(/%3A/g, ":").replace(/%40/g, "@")}&text=${encodeURIComponent(CHARSET)}&display=swap`;
  const css = await (await fetch(url, { headers: { "User-Agent": userAgent } })).text();
  const match = css.match(/url\((https:[^)]+)\)/);
  if (!match) throw new Error(`No font URL for ${instance.name}: ${css.slice(0, 200)}`);
  return match[1];
}

async function download(url, file, expectedMagic) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const magic = buf.subarray(0, 4).toString("latin1");
  if (magic !== expectedMagic) throw new Error(`${file}: expected ${expectedMagic}, got ${JSON.stringify(magic)}`);
  await writeFile(file, buf);
  return buf.length;
}

await mkdir(WEB_DIR, { recursive: true });
await mkdir(OG_DIR, { recursive: true });
for (const instance of INSTANCES) {
  const woff2 = await download(await fetchFontUrl(instance, CHROME_UA), path.join(WEB_DIR, `archivo-${instance.name}.woff2`), "wOF2");
  const woff = await download(await fetchFontUrl(instance, WOFF_UA), path.join(OG_DIR, `archivo-${instance.name}.woff`), "wOFF");
  console.log(`archivo-${instance.name}: woff2 ${(woff2 / 1024).toFixed(1)} KB · woff ${(woff / 1024).toFixed(1)} KB`);
}
