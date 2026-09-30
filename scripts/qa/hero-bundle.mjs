// JS budget of the home page (docs/3D-CONTRACT.md §F7.3: 3D chunk ≤ 350 KB gzip): lists the
// scripts loaded before any intent (first load) and the ones the 3D start adds (lazy), with
// their gzip sizes, against a running production server.
//
//   node scripts/qa/hero-bundle.mjs [--base http://localhost:3100]
import { gzipSync } from "node:zlib";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const i = args.indexOf("--base");
const BASE = i >= 0 ? args[i + 1] : "http://localhost:3100";

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const seen = new Map();
let phase = "first";
page.on("response", async (res) => {
  const url = res.url();
  const type = res.request().resourceType();
  if (!url.startsWith(BASE)) return;
  if (type !== "script" && !url.endsWith(".glb") && !url.endsWith(".hdr")) return;
  try {
    const body = await res.body();
    seen.set(url, { phase, raw: body.length, gz: type === "script" ? gzipSync(body).length : body.length, type });
  } catch {
    /* redirects */
  }
});
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
phase = "3d";
await page.evaluate(() => window.scrollTo(0, 80));
await page.waitForFunction(
  () => document.querySelector('[data-testid="hero-canvas"]')?.getAttribute("data-status") === "ready",
  null,
  { timeout: 180_000 },
);
await page.waitForTimeout(500);
await browser.close();

const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
for (const p of ["first", "3d"]) {
  const rows = [...seen.entries()].filter(([, v]) => v.phase === p);
  const scripts = rows.filter(([, v]) => v.type === "script");
  console.log(`\n${p === "first" ? "First load (before intent)" : "Added by the 3D start"}:`);
  for (const [url, v] of rows.sort((a, b) => b[1].gz - a[1].gz)) {
    console.log(`  ${kb(v.gz).padStart(9)} gz  ${kb(v.raw).padStart(9)} raw  ${url.replace(BASE, "")}`);
  }
  console.log(`  scripts: ${scripts.length}, ${kb(scripts.reduce((s, [, v]) => s + v.gz, 0))} gzip`);
}
