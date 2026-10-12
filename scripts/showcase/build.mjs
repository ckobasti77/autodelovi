// Builds docs/showcase/index.html from scripts/showcase/template.html (steps 23 and 29).
//
//   node scripts/showcase/build.mjs
//
// The page is self-contained apart from the screenshots next to it: fonts are inlined as base64
// (Archivo, Public Sans and Martian Mono, all SIL OFL), every <img> gets its real width/height so
// nothing shifts while loading. Screenshots come from `node scripts/showcase/shots.mjs`; the brand
// board and the logo sheets are converted here from docs/brand (`scripts/brand/logo/board.mjs`,
// `renders.mjs`, `scripts/brand/site/shots.mjs`), so the page never reaches outside its folder
// for a picture. Nothing is requested from the network: the links to the other documents
// (GO-LIVE, PREDAJA, the brand board) are relative paths to local files.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import sharp from "sharp";

const DIR = resolve("scripts/showcase");
const OUT = resolve("docs/showcase");

const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

const FONTS = [
  { family: "Archivo Expanded", weight: "700", file: "archivo-expanded-700.woff2" },
  { family: "Archivo Expanded", weight: "600", file: "archivo-expanded-600.woff2" },
  { family: "Archivo Condensed", weight: "600", file: "archivo-condensed-600.woff2" },
  { family: "Public Sans", weight: "100 900", file: "public-sans-latin.woff2", range: LATIN },
  { family: "Public Sans", weight: "100 900", file: "public-sans-latin-ext.woff2", range: LATIN_EXT },
  { family: "Martian Mono", weight: "100 800", file: "martian-mono-latin.woff2", range: LATIN },
  { family: "Martian Mono", weight: "100 800", file: "martian-mono-latin-ext.woff2", range: LATIN_EXT },
];

/** Verified results shown in the „Šta je provereno“ table (update when the gates are re-run). */
const FACTS = [
  ["Build, TypeScript, ESLint", "bez grešaka"],
  ["Automatski testovi (logika i baza)", "<span class=\"num\">1.306</span> prolazi"],
  ["Testovi u pregledaču (ceo tok)", "<span class=\"num\">188</span> prolazi, 0 pada"],
  ["Uglovi", "<span class=\"num\">4.599</span> elemenata na 39 strana, nijedan oštar"],
  ["Pojavljivanje sadržaja", "<span class=\"num\">78</span> poseta, ništa ne ostaje skriveno"],
  ["Brzina na telefonu, Lighthouse", "početna <span class=\"num\">96</span> · kategorija <span class=\"num\">97</span> · artikal <span class=\"num\">97</span>"],
  ["Pristupačnost i SEO, Lighthouse", "<span class=\"num\">100</span> / <span class=\"num\">100</span> na sve tri strane"],
  ["Bezbednosni pregled", "23 nalaza ispravljena, cene se ne vide preko uloga"],
  ["Nezavisni QA pregled", "180 nalaza; ispravljeno svih 18 važnih i 85 od 87 srednjih"],
];

const fontCss = FONTS.map(({ family, weight, file, range }) => {
  const data = readFileSync(resolve(DIR, "fonts", file)).toString("base64");
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format("woff2")${range ? `;unicode-range:${range}` : ""}}`;
}).join("\n");

/** Brand pictures shown in the „Ime i znak“ chapter: source under docs/brand → file in docs/showcase. */
const BRAND = [
  ["BRAND-BOARD.png", "brand-board.webp"],
  ["renders/logo-system-night.png", "brand-system-night.webp"],
  ["renders/logo-system-paper.png", "brand-system-paper.webp"],
  ["renders/logo-one-colour.png", "brand-one-colour.webp"],
  ["renders/logo-small-sizes.png", "brand-small-sizes.webp"],
  ["site/footer-night-1440.png", "brand-footer.webp"],
];
for (const [source, target] of BRAND) {
  await sharp(resolve("docs/brand", source)).webp({ quality: 86 }).toFile(resolve(OUT, target));
}

// The compare slider shows the car alone, assembled and exploded from the same camera: the two
// poster renders the home page itself starts from (3d/scripts, public/images/hero), cropped to
// the car. A crop of a page screenshot would move with every change of the hero layout.
for (const state of ["assembled", "exploded"]) {
  await sharp(resolve(`public/images/hero/car-${state}.webp`))
    .extract({ left: 900, top: 160, width: 1600, height: 1200 })
    .resize({ width: 1200 })
    .webp({ quality: 84 })
    .toFile(resolve(OUT, `home-stage-${state}.webp`));
}

let html = readFileSync(resolve(DIR, "template.html"), "utf8");
const escape = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const missing = [];
const images = [...html.matchAll(/\{\{img ([\w.-]+) "([^"]+)"\}\}/g)];
for (const [token, file, alt] of images) {
  const path = resolve(OUT, file);
  if (!existsSync(path)) {
    missing.push(file);
    continue;
  }
  const { width, height } = await sharp(path).metadata();
  const eager = file.startsWith("home-assembled-desktop") || file.startsWith("home-exploded-desktop");
  html = html.replace(
    token,
    `<img src="${file}" width="${width}" height="${height}" alt="${escape(alt)}" decoding="async"${eager ? "" : ' loading="lazy"'}>`,
  );
}
if (missing.length) throw new Error(`missing screenshots: ${missing.join(", ")}`);

/** A logo from the kit, inlined: only its shapes, hidden from assistive technology (the link is named). */
const logo = (file, cls) => {
  const svg = readFileSync(resolve("public/brand", file), "utf8");
  const box = /viewBox="([^"]+)"/.exec(svg)?.[1];
  const paths = (svg.match(/<path\b[^>]*\/>/g) ?? []).join("");
  if (!box || !paths) throw new Error(`${file}: unexpected logo file`);
  return `<svg class="${cls}" viewBox="${box}" aria-hidden="true" focusable="false">${paths}</svg>`;
};

const date = new Intl.DateTimeFormat("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" })
  .format(new Date())
  .replace(/\s/g, "");
/** The site's own icon as a data URI, so the tab shows the new mark without a request. */
const favicon = `data:image/svg+xml,${encodeURIComponent(
  readFileSync(resolve("public/brand/icon.svg"), "utf8").replace(/<title>[^<]*<\/title>/, ""),
)}`;

html = html
  .replace("{{fonts}}", fontCss)
  .replace("{{favicon}}", favicon)
  .replace("{{logo-header}}", logo("logo-header-night.svg", "lockup"))
  .replace("{{logo-mark}}", logo("mark-night.svg", "mark"))
  .replaceAll("{{date}}", date.endsWith(".") ? date : `${date}.`)
  .replace(
    "{{facts}}",
    FACTS.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join("\n        "),
  );
if (/\{\{/.test(html)) throw new Error("unreplaced placeholder in the template");
writeFileSync(resolve(OUT, "index.html"), html);
console.log(`docs/showcase/index.html · ${images.length} images · ${(html.length / 1024).toFixed(0)} KB`);
