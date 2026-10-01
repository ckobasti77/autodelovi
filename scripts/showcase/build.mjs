// Builds docs/showcase/index.html from scripts/showcase/template.html (step 23).
//
//   node scripts/showcase/build.mjs
//
// The page is self-contained apart from the screenshots next to it: fonts are inlined as base64
// (Archivo, Public Sans and Martian Mono, all SIL OFL), every <img> gets its real width/height so
// nothing shifts while loading. Screenshots come from `node scripts/showcase/shots.mjs`.
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
  ["Automatski testovi (logika i baza)", "<span class=\"num\">1.223</span> prolazi"],
  ["Testovi u pregledaču (ceo tok)", "<span class=\"num\">105</span> prolazi, 0 pada"],
  ["Brzina na telefonu, Lighthouse", "početna <span class=\"num\">97</span> · kategorija <span class=\"num\">98</span> · artikal <span class=\"num\">97</span>"],
  ["Pristupačnost i SEO, Lighthouse", "<span class=\"num\">100</span> / <span class=\"num\">100</span> na sve tri strane"],
  ["Bezbednosni pregled", "23 nalaza ispravljena, cene se ne vide preko uloga"],
  ["Nezavisni QA pregled", "180 nalaza; ispravljeno svih 18 važnih i 85 od 87 srednjih"],
];

const fontCss = FONTS.map(({ family, weight, file, range }) => {
  const data = readFileSync(resolve(DIR, "fonts", file)).toString("base64");
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${data}) format("woff2")${range ? `;unicode-range:${range}` : ""}}`;
}).join("\n");

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

const date = new Intl.DateTimeFormat("sr-Latn-RS", { day: "2-digit", month: "2-digit", year: "numeric" })
  .format(new Date())
  .replace(/\s/g, "");
html = html
  .replace("{{fonts}}", fontCss)
  .replaceAll("{{date}}", date.endsWith(".") ? date : `${date}.`)
  .replace(
    "{{facts}}",
    FACTS.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join("\n        "),
  );
if (/\{\{/.test(html)) throw new Error("unreplaced placeholder in the template");
writeFileSync(resolve(OUT, "index.html"), html);
console.log(`docs/showcase/index.html · ${images.length} images · ${(html.length / 1024).toFixed(0)} KB`);
