// Rendering helpers for the logo work: SVG → PNG (resvg, exact pixel sizes) and HTML → PNG / PDF (Chromium).
import { Resvg } from "@resvg/resvg-js";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Render an SVG string to a PNG buffer at an exact pixel width (height follows the viewBox). */
export function svgToPng(svg, width, background) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: Math.round(width) },
    background,
    font: { loadSystemFonts: false },
  });
  return resvg.render().asPng();
}

export async function writePng(file, svg, width, background) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, svgToPng(svg, width, background));
}

let browser;
export async function getBrowser() {
  browser ??= await chromium.launch();
  return browser;
}
export async function closeBrowser() {
  await browser?.close();
  browser = undefined;
}

/** Screenshot a self-contained HTML string. */
export async function htmlToPng(
  html,
  file,
  { width = 1600, height = 900, scale = 1, fullPage = true } = {},
) {
  const b = await getBrowser();
  const page = await b.newPage({ viewport: { width, height }, deviceScaleFactor: scale });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await mkdir(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage });
  await page.close();
}

/** Print an SVG to a one-page vector PDF whose page is exactly the artwork size (in CSS px → pt). */
export async function svgToPdf(svg, file, widthPx, heightPx) {
  const b = await getBrowser();
  const page = await b.newPage();
  const html = `<!doctype html><html><head><style>@page{size:${widthPx}px ${heightPx}px;margin:0}html,body{margin:0;padding:0}svg{display:block;width:${widthPx}px;height:${heightPx}px}</style></head><body>${svg}</body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  await mkdir(path.dirname(file), { recursive: true });
  await page.pdf({
    path: file,
    width: `${widthPx}px`,
    height: `${heightPx}px`,
    printBackground: true,
    pageRanges: "1",
  });
  await page.close();
}
