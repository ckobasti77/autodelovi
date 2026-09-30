// Verifier for copy-05: brand names not declined after „za“ (Škoda, Cupra; feminine models).
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
import sharp from "sharp";

const OUT = "docs/qa/audit/verify/copy";
mkdirSync(OUT, { recursive: true });
const log = [];
const p = (s) => {
  log.push(s);
  console.log(s);
};
const to3100 = (u) => u.replace("http://localhost:3000", BASE);

async function text(url) {
  const r = await fetch(url);
  return { status: r.status, html: await r.text() };
}
function decode(s) {
  return s
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// 1. sitemap crawl
const idx = (await text(`${BASE}/sitemap.xml`)).html;
const maps = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => to3100(m[1]));
let urls = [];
for (const m of maps) {
  const x = (await text(m)).html;
  const locs = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map((mm) => to3100(mm[1]));
  if (locs.some((l) => l.endsWith(".xml"))) {
    for (const s of locs) urls.push(...[...(await text(s)).html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((q) => to3100(q[1])));
  } else urls.push(...locs);
}
urls = [...new Set(urls)];
p(`sitemap URLs: ${urls.length}`);

// Phrases: "za <Brand>" followed by optional capitalised model word(s)
const RX = /\bza (Škoda|Cupra|SEAT|Audi|Volkswagen|ŠKODA|CUPRA)((?: [A-ZČĆŽŠĐ][\w\-]*)?)/g;
const perPhrase = new Map();
const affected = new Set();
const titles = {};
let i = 0;
for (const u of urls) {
  i++;
  const { status, html } = await text(u);
  if (status !== 200) continue;
  const t = decode(html);
  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  let hit = false;
  for (const m of t.matchAll(RX)) {
    const brand = m[1];
    const model = m[2].trim();
    const phrase = `za ${brand}${model ? " " + model : ""}`;
    // Only flag forms that are ungrammatical: feminine brand (Škoda/Cupra) or feminine -a model
    const bad = /^(Škoda|Cupra|ŠKODA|CUPRA)$/.test(brand) || /a$/.test(model);
    if (!bad) continue;
    hit = true;
    if (!perPhrase.has(phrase)) perPhrase.set(phrase, new Set());
    perPhrase.get(phrase).add(new URL(u).pathname);
  }
  if (hit) {
    affected.add(new URL(u).pathname);
    titles[new URL(u).pathname] = title;
  }
}
p(`\nAffected sitemap pages (ungrammatical „za <Škoda|Cupra|…-a model>“ anywhere in HTML incl. meta/JSON-LD): ${affected.size}`);
p([...affected].sort().join("\n"));
p(`\nPhrases (count of pages):`);
for (const [ph, set] of [...perPhrase.entries()].sort((a, b) => b[1].size - a[1].size)) p(`${set.size}\t${ph}`);
p(`\nTitles of affected pages with the phrase in <title>:`);
for (const [pth, t] of Object.entries(titles)) if (/za (Škoda|Cupra)|za \w+ \w+a\b/.test(t)) p(`${pth}\t${t}`);

// 2. screenshots + H1s
const browser = await launch();
for (const vp of [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844 },
]) {
  const ctx = await newContext(browser, { width: vp.width, height: vp.height, tag: `verify-copy05-${vp.tag}` });
  const page = await ctx.newPage();
  for (const r of ["/vozila/skoda", "/delovi/kocioni-diskovi/skoda", "/vozila/cupra", "/vozila/seat/ibiza"]) {
    const res = await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    const h1 = await page.locator("h1").first().innerText().catch(() => "(none)");
    p(`\n${r} @${vp.tag} status=${res.status()} title=${await page.title()} H1=${JSON.stringify(h1)}`);
    if (r !== "/vozila/seat/ibiza" || vp.tag === "1440")
      await shot(page, `verify/copy/copy-05-reproduce-${r.replaceAll("/", "_").slice(1)}-${vp.tag}`);
  }
  await ctx.close();
}
await browser.close();

// 3. OG image of the landing
const land = (await text(`${BASE}/delovi/kocioni-diskovi/skoda`)).html;
const og = (land.match(/property="og:image" content="([^"]+)"/) || [])[1];
p(`\nog:image ${og}`);
if (og) {
  const r = await fetch(to3100(og.replace(/&amp;/g, "&")));
  const buf = Buffer.from(await r.arrayBuffer());
  await sharp(buf).webp({ quality: 70 }).toFile(`${OUT}/copy-05-reproduce-og-landing-skoda.webp`);
  p(`og status ${r.status} bytes ${buf.length}`);
}
writeFileSync(`${OUT}/copy-05-reproduce.txt`, log.join("\n"));
