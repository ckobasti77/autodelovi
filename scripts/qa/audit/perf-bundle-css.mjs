// perf-bundle track: CSS coverage (Playwright/CDP) of the single global stylesheet on home at 390
// and 1440 after a full scroll-through, plus which preloaded font faces are actually painted in
// the first viewport of several templates at 390.
//   node scripts/qa/audit/perf-bundle-css.mjs
import { writeFileSync } from "node:fs";
import path from "node:path";

import { BASE, launch, newContext, scrollThrough } from "./kit.mjs";

const OUT = path.resolve("docs/qa/audit/perf-bundle");
const browser = await launch("chromium");
const res = { coverage: {}, fontsAboveFold: {} };

function merge(ranges) {
  const r = [...ranges].sort((a, b) => a.start - b.start);
  let used = 0;
  let cur = null;
  for (const x of r) {
    if (!cur || x.start > cur.end) {
      if (cur) used += cur.end - cur.start;
      cur = { ...x };
    } else cur.end = Math.max(cur.end, x.end);
  }
  if (cur) used += cur.end - cur.start;
  return used;
}

for (const [w, h] of [[390, 844], [1440, 900]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `perf-bundle-css-${w}` });
  const page = await ctx.newPage();
  await page.coverage.startCSSCoverage();
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const firstPaint = await page.coverage.stopCSSCoverage();
  await page.coverage.startCSSCoverage();
  await page.reload({ waitUntil: "load" });
  await scrollThrough(page);
  const full = await page.coverage.stopCSSCoverage();
  const pick = (entries) =>
    entries.map((e) => ({ url: e.url.replace(BASE, "") || "(inline)", bytes: e.text.length, used: merge(e.ranges) }));
  res.coverage[`home@${w}`] = { atLoad: pick(firstPaint), afterScroll: pick(full) };
  for (const [k, v] of Object.entries(res.coverage[`home@${w}`])) {
    for (const e of v) console.log(`home@${w} ${k.padEnd(11)} ${e.url.slice(0, 45).padEnd(45)} ${(e.bytes / 1024).toFixed(1)} KB, used ${(e.used / 1024).toFixed(1)} KB (${Math.round((e.used / e.bytes) * 100)} %)`);
  }
  await ctx.close();
}

const pages = [
  ["home", "/"],
  ["category", "/delovi/kocioni-diskovi"],
  ["product", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004"],
  ["landing", "/ponuda/kocione-plocice-golf"],
  ["korpa", "/korpa"],
  ["prijava", "/prijava"],
];
const ctx = await newContext(browser, { width: 390, height: 844, tag: "perf-bundle-fonts" });
const page = await ctx.newPage();
for (const [name, route] of pages) {
  await page.goto(BASE + route, { waitUntil: "load" });
  await page.waitForTimeout(600);
  const r = await page.evaluate(() => {
    const out = {};
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= innerHeight || rect.width === 0) continue;
      const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
      if (!own) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const fam = cs.fontFamily.split(",")[0].replace(/['"]/g, "");
      const key = `${fam} ${cs.fontWeight}`;
      (out[key] ??= []).push(own.slice(0, 30));
    }
    return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, `${v.length}: ${v.slice(0, 4).join(" | ")}`]));
  });
  res.fontsAboveFold[name] = r;
  console.log(`\nfirst viewport @390 ${name}:`);
  for (const [k, v] of Object.entries(r)) console.log(`   ${k.padEnd(26)} ${v}`);
}
await ctx.close();
await browser.close();
writeFileSync(path.join(OUT, "css-fonts.json"), JSON.stringify(res, null, 2));
