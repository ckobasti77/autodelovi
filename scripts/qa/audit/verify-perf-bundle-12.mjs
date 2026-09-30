// Verifier (perf-bundle-12): which next/image candidate product-card thumbnails download on phones
// vs the rendered width, across widths/DPRs and every ProductGrid route.
//   node scripts/qa/audit/verify-perf-bundle-12.mjs
import { writeFileSync, mkdirSync } from "node:fs";

import { BASE, launch, newContext, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/perf-bundle";
mkdirSync(OUT, { recursive: true });

const ROUTES = [
  ["category", "/delovi/kocioni-diskovi"],
  ["search", "/pretraga?q=disk"],
  ["landing", "/ponuda/kocione-plocice-golf"],
  ["product-related", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"],
  ["vehicle-gen", "/vozila/volkswagen/golf/golf-7"],
];
const CONFIGS = [
  { width: 360, height: 780, dpr: 3 },
  { width: 390, height: 844, dpr: 3 },
  { width: 390, height: 844, dpr: 2 },
  { width: 412, height: 915, dpr: 2.625 },
  { width: 390, height: 844, dpr: 1 },
  { width: 540, height: 900, dpr: 2 },
  { width: 1440, height: 900, dpr: 1 },
];

const browser = await launch("chromium");
const out = [];
const lines = [];
for (const cfg of CONFIGS) {
  const ctx = await newContext(browser, { width: cfg.width, height: cfg.height, deviceScaleFactor: cfg.dpr, tag: "verify-pb12" });
  const page = await ctx.newPage();
  const imgBytes = new Map();
  page.on("response", async (r) => {
    if (!r.url().includes("/_next/image")) return;
    try {
      const b = await r.body();
      imgBytes.set(r.url().replace(BASE, ""), { bytes: b.length, type: r.headers()["content-type"] });
    } catch {}
  });
  for (const [name, route] of ROUTES) {
    imgBytes.clear();
    await page.goto(BASE + route, { waitUntil: "load" });
    // Scroll the cards into view so lazy images load.
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
    });
    await page.waitForTimeout(800);
    const cards = await page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="product-card"] img')].slice(0, 8).map((img) => {
        const w = new URL(img.currentSrc || img.src, location.origin).searchParams.get("w");
        return {
          w: Number(w),
          renderedCssPx: Math.round(img.getBoundingClientRect().width),
          neededPx: Math.round(img.getBoundingClientRect().width * devicePixelRatio),
          sizes: img.sizes,
          src: (img.currentSrc || img.src).replace(location.origin, ""),
        };
      }),
    );
    const rec = { ...cfg, route: name, cards, fetched: [...imgBytes.entries()].map(([u, v]) => ({ url: u, ...v })) };
    out.push(rec);
    const c = cards[0];
    const line = c
      ? `${cfg.width}x${cfg.height}@${cfg.dpr} ${name.padEnd(16)} cards=${cards.length} rendered=${c.renderedCssPx}css need=${c.neededPx}px got w=${c.w} (${(c.w / c.neededPx).toFixed(2)}x width, ${((c.w / c.neededPx) ** 2).toFixed(1)}x px)  sizes="${c.sizes}"`
      : `${cfg.width}x${cfg.height}@${cfg.dpr} ${name.padEnd(16)} no product cards`;
    lines.push(line);
    console.log(line);
    for (const f of rec.fetched) console.log(`      fetched ${f.bytes} B ${f.type} ${f.url}`);
    if (cfg.width === 390 && cfg.dpr === 3 && name === "category") {
      await page.evaluate(() => document.querySelector('[data-testid="product-card"]')?.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(700);
      await shot(page, "verify/perf-bundle/perf-bundle-12-reproduce-category-390-dpr3", {});
    }
  }
  await ctx.close();
}

// Byte cost of the candidate actually used vs the one a correct `sizes` would pick (AVIF, as Chromium asks).
const cmp = [];
for (const src of ["/images/parts/kocioni-diskovi.webp", "/images/parts/kocione-plocice.webp"]) {
  for (const w of [256, 384, 640]) {
    const r = await fetch(`${BASE}/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`, {
      headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
    });
    const b = Buffer.from(await r.arrayBuffer());
    cmp.push(`${src} w=${w} ${r.headers.get("content-type")} ${b.length} B`);
  }
}
console.log(cmp.join("\n"));
await browser.close();
writeFileSync(`${OUT}/perf-bundle-12-reproduce.json`, JSON.stringify(out, null, 2));
writeFileSync(`${OUT}/perf-bundle-12-reproduce.txt`, [...lines, "", "candidate bytes (AVIF):", ...cmp].join("\n") + "\n");
