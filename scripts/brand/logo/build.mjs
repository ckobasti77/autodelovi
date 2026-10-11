// Step 24 — builds the Euromotors Plus by OEM Parts logo kit from scripts/brand/logo/logo.mjs.
//
// Usage: node scripts/brand/logo/build.mjs
// Output:
//   public/brand/                 web assets: SVG lockups in every colour variant, favicon set, PWA icons,
//                                 e-mail header, social avatar
//   docs/brand/export/svg|png|pdf the owner's kit: optimised SVG, PNG at 1× / 2× / 4×, vector PDF
//   docs/brand/export/icons       the same icon set as public/brand, for handing over
//   docs/brand/export/manifest.json   every file with its size in px and bytes
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { assertClean, ico, optimizeSvg } from "./lib/export.mjs";
import { fill, svgDoc } from "./lib/parts.mjs";
import { closeBrowser, svgToPdf, svgToPng } from "./lib/render.mjs";
import { CLEAR, ICON, LOCKUPS, MIN, THEMES, hintedIconSvg, iconSvg, lockupSvg } from "./logo.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const PUBLIC = path.join(ROOT, "public/brand");
const EXPORT = path.join(ROOT, "docs/brand/export");
const NAME = "Euromotors Plus by OEM Parts";

const KINDS = ["horizontal", "header", "stacked", "wordmark", "mark", "dual", "oemParts"];
const FILE = { mark: "mark", oemParts: "oem-parts" };
const VARIANTS = ["night", "paper", "black", "white", "orange"];
/** PNG height at 1× per lockup (px): the smallest size at which every element of it holds. */
const BASE_HEIGHT = { horizontal: MIN.horizontal.px, header: 40, stacked: 160, wordmark: 56, mark: 64, dual: 56, oemParts: 56 };
const TITLES = {
  horizontal: NAME,
  header: "Euromotors Plus",
  stacked: NAME,
  wordmark: NAME,
  mark: "Euromotors Plus",
  dual: "Euromotors Plus | OEM Parts",
  oemParts: "OEM Parts",
};

const manifest = [];
async function put(dir, name, data, meta = {}) {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await writeFile(file, data);
  manifest.push({ file: path.relative(ROOT, file).replaceAll("\\", "/"), bytes: Buffer.byteLength(data), ...meta });
}

for (const dir of [PUBLIC, EXPORT]) await rm(dir, { recursive: true, force: true });

// ---------------------------------------------------------------------------------------------
// Lockups: SVG, PNG, PDF
// ---------------------------------------------------------------------------------------------
for (const kind of KINDS) {
  for (const variant of VARIANTS) {
    const theme = THEMES[variant];
    const base = `${FILE[kind] ?? `logo-${kind}`}-${variant}`;
    const { svg, w, h } = lockupSvg(kind, theme, { title: TITLES[kind] });
    const optimised = optimizeSvg(svg);
    assertClean(optimised, base);
    await put(path.join(EXPORT, "svg"), `${base}.svg`, optimised, { w, h });
    await put(PUBLIC, `${base}.svg`, optimised, { w, h });

    for (const scale of [1, 2, 4]) {
      const height = BASE_HEIGHT[kind] * scale;
      const width = Math.round((w / h) * height);
      const png = svgToPng(svg, width);
      const meta = await sharp(png).metadata();
      await put(path.join(EXPORT, "png"), `${base}${scale === 1 ? "" : `@${scale}x`}.png`, png, { w: meta.width, h: meta.height });
    }

    // PDF: light-ground variants on a transparent page at artwork size; dark-ground variants on the
    // night field with clear space, so the file can be opened and proofed as it is.
    const onDark = variant === "night" || variant === "white" || variant === "orange";
    const pdfArt = lockupSvg(kind, theme, { bg: onDark, pad: onDark ? CLEAR : 0, title: TITLES[kind] });
    const k = 0.5; // 1 unit = 0.5 px = 0.375 pt; vector, so the size only sets the default page
    await svgToPdf(
      pdfArt.svg.replace(/ width="[\d.]+" height="[\d.]+"/, ""),
      path.join(EXPORT, "pdf", `${base}.pdf`),
      Math.ceil(pdfArt.w * k),
      Math.ceil(pdfArt.h * k),
    );
    const pdfStat = await stat(path.join(EXPORT, "pdf", `${base}.pdf`));
    manifest.push({ file: `docs/brand/export/pdf/${base}.pdf`, bytes: pdfStat.size });
  }
}

// ---------------------------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------------------------
async function icons(dir) {
  const master = iconSvg();
  const masterOpt = optimizeSvg(master);
  assertClean(masterOpt, "icon.svg");
  await put(dir, "icon.svg", masterOpt, { w: 512, h: 512 });

  const hinted = [16, 32, 48].map((size) => ({ size, png: svgToPng(hintedIconSvg(size), size) }));
  for (const { size, png } of hinted) await put(dir, `favicon-${size}.png`, png, { w: size, h: size });
  await put(dir, "favicon.ico", ico(hinted), { sizes: "16, 32, 48" });

  // apple-touch-icon: opaque, full-bleed (iOS applies its own mask)
  const apple = await sharp(svgToPng(iconSvg({ rounded: false }), 180)).flatten({ background: THEMES.night.bg }).png().toBuffer();
  await put(dir, "apple-touch-icon.png", apple, { w: 180, h: 180 });

  for (const size of [192, 512]) {
    await put(dir, `icon-${size}.png`, svgToPng(master, size), { w: size, h: size });
    const maskable = await sharp(svgToPng(iconSvg({ rounded: false, markHeight: ICON.maskableHeight }), size))
      .flatten({ background: THEMES.night.bg })
      .png()
      .toBuffer();
    await put(dir, `icon-maskable-${size}.png`, maskable, { w: size, h: size });
  }
}
await icons(PUBLIC);
await icons(path.join(EXPORT, "icons"));

// ---------------------------------------------------------------------------------------------
// E-mail header (2×, on white) and social avatar (1000 × 1000)
// ---------------------------------------------------------------------------------------------
{
  const art = LOCKUPS.horizontal();
  const displayH = MIN.horizontal.px; // 56 px tall in the e-mail
  const pad = 16; // px of white around it at 1×
  const k = (displayH * 2) / art.h;
  const w = Math.round(art.w * k) + pad * 4;
  const h = displayH * 2 + pad * 4;
  const t = THEMES.paper;
  const svg = svgDoc({
    w,
    h,
    bg: "#FFFFFF",
    body: `<g transform="translate(${pad * 2} ${pad * 2}) scale(${k})">${fill(art.ink, t.ink)}${fill(art.accent, t.accent)}</g>`,
  });
  const png = await sharp(svgToPng(svg, w)).flatten({ background: "#FFFFFF" }).png().toBuffer();
  for (const dir of [PUBLIC, path.join(EXPORT, "icons")]) {
    await put(dir, "email-header@2x.png", png, { w, h, display: `${w / 2} × ${h / 2}` });
  }
}
{
  // The platform crops to a circle: the mark sits inside the inscribed circle with room to spare.
  const avatar = iconSvg({ rounded: false, markHeight: 0.44 });
  const png = await sharp(svgToPng(avatar, 1000)).flatten({ background: THEMES.night.bg }).png().toBuffer();
  for (const dir of [PUBLIC, path.join(EXPORT, "icons")]) await put(dir, "social-avatar.png", png, { w: 1000, h: 1000 });
}

await closeBrowser();

// ---------------------------------------------------------------------------------------------
// Manifest + summary
// ---------------------------------------------------------------------------------------------
manifest.sort((a, b) => a.file.localeCompare(b.file));
await writeFile(path.join(EXPORT, "manifest.json"), JSON.stringify({ name: NAME, generated: "scripts/brand/logo/build.mjs", files: manifest }, null, 2) + "\n");
const count = async (dir) => (await readdir(dir, { recursive: true, withFileTypes: true })).filter((e) => e.isFile()).length;
console.log(`public/brand: ${await count(PUBLIC)} files · docs/brand/export: ${await count(EXPORT)} files`);
const svgs = manifest.filter((m) => m.file.startsWith("public/brand") && m.file.endsWith(".svg"));
console.log(`SVG sizes: ${svgs.map((m) => `${path.basename(m.file)} ${(m.bytes / 1024).toFixed(1)} KB`).join(", ")}`);
