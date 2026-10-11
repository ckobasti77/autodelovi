// Step 25 — the favicon as a browser shows it (docs/brand/site/favicon-tab*.png).
// Usage: node scripts/brand/site/favicon.mjs <baseUrl>
//
// Headless Chromium has no tab strip, so the strip is drawn here — but the icon inside it is the real
// one: the address is read from the page's <link rel="icon">, and the image is laid out at 16 CSS px,
// which is how a browser rasterises an SVG favicon for a tab (the media queries in app/icon.svg then
// pick the mark drawn for that pixel grid).
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const OUT = path.resolve(import.meta.dirname, "../../../docs/brand/site");
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const probe = await browser.newPage();
await probe.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
const head = await probe.evaluate(() => ({
  title: document.title,
  icons: [...document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')].map(
    (l) => ({ rel: l.rel, href: l.href, sizes: l.getAttribute("sizes"), type: l.type }),
  ),
  manifest: document.querySelector('link[rel="manifest"]')?.href ?? null,
}));
await probe.close();
console.log(JSON.stringify(head, null, 1));

const svg = head.icons.find((i) => i.type === "image/svg+xml")?.href;
const ico = head.icons.find((i) => i.type === "image/x-icon")?.href;
const apple = head.icons.find((i) => i.rel === "apple-touch-icon")?.href;
if (!svg || !ico || !apple) throw new Error("expected an SVG icon, an ICO and an Apple touch icon");

const tab = (theme) => {
  const dark = theme === "dark";
  const strip = dark ? "#202124" : "#dee1e6";
  const active = dark ? "#35363a" : "#ffffff";
  const ink = dark ? "#e8eaed" : "#202124";
  const dim = dark ? "#9aa0a6" : "#5f6368";
  return `<div style="background:${strip};padding:8px 8px 0;display:flex;gap:2px;align-items:flex-end;font:12px/16px 'Segoe UI',system-ui,sans-serif">
  <div style="background:${active};color:${ink};width:240px;height:34px;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:8px;padding:0 10px;box-sizing:border-box">
    <img src="${svg}" width="16" height="16" alt="">
    <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${head.title}</span>
    <span style="color:${dim}">×</span>
  </div>
  <div style="color:${dim};width:200px;height:34px;display:flex;align-items:center;gap:8px;padding:0 10px;box-sizing:border-box">
    <img src="${svg}" width="16" height="16" alt="">
    <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Kočioni diskovi</span>
  </div>
</div>
<div style="background:${active};height:36px;border-bottom:1px solid ${dark ? "#5f6368" : "#dadce0"};display:flex;align-items:center;padding:0 12px;font:13px 'Segoe UI',system-ui,sans-serif;color:${dim}">${new URL(BASE).host}</div>`;
};

// Enlarged with a transform, not by resizing: the image keeps its real layout size, so an SVG icon
// still sees a 16 or 32 px viewport and shows the variant a tab would get.
const zoom = (src, size, label) =>
  `<figure style="margin:0;display:flex;flex-direction:column;gap:6px;align-items:flex-start">
    <div style="width:${size * 8}px;height:${size * 8}px;outline:1px solid #c8c8c8;overflow:hidden">
      <img src="${src}" width="${size}" height="${size}" alt="" style="display:block;transform:scale(8);transform-origin:0 0;image-rendering:pixelated">
    </div>
    <figcaption style="font:12px 'Segoe UI',system-ui,sans-serif;color:#444">${label}</figcaption>
  </figure>`;

const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f4f4f4">
<div style="width:900px;padding:24px;display:flex;flex-direction:column;gap:24px">
  <div style="box-shadow:0 1px 4px #0003">${tab("dark")}</div>
  <div style="box-shadow:0 1px 4px #0003">${tab("light")}</div>
  <div style="display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap">
    ${zoom(svg, 16, "icon.svg u kartici: 16 px, uvećano 8×")}
    ${zoom(`${BASE}/brand/favicon-16.png`, 16, "favicon.ico, sloj 16 px, uvećano 8×")}
    ${zoom(svg, 32, "icon.svg na 32 px, uvećano 8×")}
    <figure style="margin:0;display:flex;flex-direction:column;gap:6px">
      <img src="${apple}" width="180" height="180" alt="" style="border-radius:40px">
      <figcaption style="font:12px 'Segoe UI',system-ui,sans-serif;color:#444">apple-icon.png 180 px (iOS maska)</figcaption>
    </figure>
  </div>
</div>`;

for (const scale of [1, 2]) {
  const page = await browser.newPage({
    viewport: { width: 948, height: 620 },
    deviceScaleFactor: scale,
  });
  await page.setContent(html, { waitUntil: "networkidle" });
  const loaded = await page.evaluate(() =>
    [...document.images].every((i) => i.complete && i.naturalWidth > 0),
  );
  await page.screenshot({ path: path.join(OUT, `favicon-tab${scale === 1 ? "" : "@2x"}.png`) });
  console.log(`favicon-tab @${scale}x: all images loaded = ${loaded}`);
  await page.close();
}
await browser.close();
