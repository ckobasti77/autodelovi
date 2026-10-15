// Builds the Euromotors Plus · OEM Parts logo kit from scripts/brand/logo/logo.mjs (step 33: the
// star arc, concept A).
//
// Usage: node scripts/brand/logo/build.mjs
// Output:
//   public/brand/                 web assets: SVG lockups in every colour variant, favicon set, PWA icons,
//                                 e-mail header (light and dark), social avatar
//   docs/brand/export/svg|png|pdf the owner's kit: optimised SVG, PNG at 1× / 2× / 4×, vector PDF
//   docs/brand/export/icons       the same icon set as public/brand, for handing over
//   docs/brand/export/manifest.json   every file with its size in px and bytes
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { assertClean, ico, optimizeSvg } from "./lib/export.mjs";
import { fill, svgDoc } from "./lib/parts.mjs";
import { closeBrowser, svgToPdf, svgToPng } from "./lib/render.mjs";
import { CLEAR, ICON, LOCKUPS, THEMES, hintedIconSvg, iconSvg, lockupSvg } from "./logo.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const PUBLIC = path.join(ROOT, "public/brand");
const EXPORT = path.join(ROOT, "docs/brand/export");
const NAME = "Euromotors Plus · OEM Parts";

const KINDS = ["stacked", "horizontal", "wordmark", "mark", "markSmall", "oemParts"];
const FILE = {
  stacked: "logo-stacked",
  horizontal: "logo-horizontal",
  wordmark: "logo-wordmark",
  mark: "mark",
  markSmall: "mark-small",
  oemParts: "oem-parts",
};
const VARIANTS = ["night", "paper", "navy", "black", "white"];
/** PNG height at 1× per lockup (px): a size at which every element of it holds. */
const BASE_HEIGHT = {
  stacked: 160,
  horizontal: 48,
  wordmark: 40,
  mark: 64,
  markSmall: 32,
  oemParts: 56,
};
const TITLES = {
  stacked: NAME,
  horizontal: NAME,
  wordmark: NAME,
  mark: "Euromotors Plus",
  markSmall: "Euromotors Plus",
  oemParts: "OEM Parts",
};

const manifest = [];
async function put(dir, name, data, meta = {}) {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await writeFile(file, data);
  manifest.push({
    file: path.relative(ROOT, file).replaceAll("\\", "/"),
    bytes: Buffer.byteLength(data),
    ...meta,
  });
}

for (const dir of [PUBLIC, EXPORT]) await rm(dir, { recursive: true, force: true });

// ---------------------------------------------------------------------------------------------
// Lockups: SVG, PNG, PDF
// ---------------------------------------------------------------------------------------------
for (const kind of KINDS) {
  for (const variant of VARIANTS) {
    const theme = THEMES[variant];
    const base = `${FILE[kind]}-${variant}`;
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
      await put(path.join(EXPORT, "png"), `${base}${scale === 1 ? "" : `@${scale}x`}.png`, png, {
        w: meta.width,
        h: meta.height,
      });
    }

    // PDF: light-ground variants on a transparent page at artwork size; dark-ground variants on the
    // night field with their clear space, so the file can be opened and proofed as it is.
    const onDark = variant === "night" || variant === "white";
    const pdfArt = lockupSvg(kind, theme, {
      bg: onDark,
      pad: onDark ? CLEAR[kind] : 0,
      title: TITLES[kind],
    });
    // 1 unit = 0.5 px; vector, so the size only sets the default page (marks are drawn small)
    const k = kind === "mark" || kind === "markSmall" ? 1 : 0.5;
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
  for (const { size, png } of hinted)
    await put(dir, `favicon-${size}.png`, png, { w: size, h: size });
  await put(dir, "favicon.ico", ico(hinted), { sizes: "16, 32, 48" });

  // apple-touch-icon: opaque, full-bleed (iOS applies its own mask)
  const apple = await sharp(svgToPng(iconSvg({ rounded: false }), 180))
    .flatten({ background: THEMES.night.bg })
    .png()
    .toBuffer();
  await put(dir, "apple-touch-icon.png", apple, { w: 180, h: 180 });

  for (const size of [192, 512]) {
    await put(dir, `icon-${size}.png`, svgToPng(master, size), { w: size, h: size });
    const maskable = await sharp(
      svgToPng(iconSvg({ rounded: false, markHeight: ICON.maskableHeight }), size),
    )
      .flatten({ background: THEMES.night.bg })
      .png()
      .toBuffer();
    await put(dir, `icon-maskable-${size}.png`, maskable, { w: size, h: size });
  }
}
await icons(PUBLIC);
await icons(path.join(EXPORT, "icons"));

// ---------------------------------------------------------------------------------------------
// E-mail header (2×): the horizontal lockup in heritage navy on white, and the dark-mode copy in
// warm ink on a transparent ground (swapped in by lib/email/html.ts). Social avatar 1000 × 1000.
// ---------------------------------------------------------------------------------------------
const EMAIL = { width: 336, height: 56, pad: 16 };
{
  const art = LOCKUPS.horizontal();
  const k = (EMAIL.height * 2) / art.h;
  // a fixed canvas (lib/email/html.ts states its size); the logo sits at the top left
  const w = EMAIL.width * 2;
  const h = EMAIL.height * 2 + EMAIL.pad * 4;
  if (art.w * k + EMAIL.pad * 4 > w) throw new Error("e-mail header: the logo does not fit");
  const doc = (ink, bg) =>
    svgDoc({
      w,
      h,
      bg,
      body: `<g transform="translate(${EMAIL.pad * 2} ${EMAIL.pad * 2}) scale(${k})">${fill(art.ink, ink)}</g>`,
    });
  const light = await sharp(svgToPng(doc(THEMES.navy.ink, "#FFFFFF"), w))
    .flatten({ background: "#FFFFFF" })
    .png()
    .toBuffer();
  const dark = svgToPng(doc(THEMES.night.ink), w);
  for (const dir of [PUBLIC, path.join(EXPORT, "icons")]) {
    await put(dir, "email-header@2x.png", light, { w, h, display: `${w / 2} × ${h / 2}` });
    await put(dir, "email-header-dark@2x.png", dark, { w, h, display: `${w / 2} × ${h / 2}` });
  }
}
{
  // The platform crops to a circle: the ring sits inside the inscribed circle with room to spare.
  const avatar = iconSvg({ rounded: false, markHeight: 0.62 });
  const png = await sharp(svgToPng(avatar, 1000))
    .flatten({ background: THEMES.night.bg })
    .png()
    .toBuffer();
  for (const dir of [PUBLIC, path.join(EXPORT, "icons")])
    await put(dir, "social-avatar.png", png, { w: 1000, h: 1000 });
}

await closeBrowser();

// ---------------------------------------------------------------------------------------------
// Manifest + summary
// ---------------------------------------------------------------------------------------------
manifest.sort((a, b) => a.file.localeCompare(b.file));
await writeFile(
  path.join(EXPORT, "manifest.json"),
  JSON.stringify(
    { name: NAME, generated: "scripts/brand/logo/build.mjs", files: manifest },
    null,
    2,
  ) + "\n",
);
const count = async (dir) =>
  (await readdir(dir, { recursive: true, withFileTypes: true })).filter((e) => e.isFile()).length;
console.log(
  `public/brand: ${await count(PUBLIC)} files · docs/brand/export: ${await count(EXPORT)} files`,
);
const svgs = manifest.filter(
  (m) => m.file.startsWith("public/brand") && m.file.endsWith("-night.svg"),
);
console.log(
  `SVG sizes: ${svgs.map((m) => `${path.basename(m.file)} ${(m.bytes / 1024).toFixed(1)} KB`).join(", ")}`,
);
