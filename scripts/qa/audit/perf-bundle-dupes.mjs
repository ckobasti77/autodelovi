// perf-bundle track: finds Turbopack module factories that are shipped more than once within
// the first-load script set of each template (same module id in two or more chunks of one page),
// and module ids duplicated across all chunks of the build.
//
//   node scripts/qa/audit/perf-bundle-dupes.mjs
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { gzipSync } from "node:zlib";

const DIR = path.resolve(".next/static/chunks");
const OUT = path.resolve("docs/qa/audit/perf-bundle");

function modulesOf(file) {
  const src = readFileSync(path.join(DIR, file), "utf8");
  const pushed = [];
  try {
    vm.runInNewContext(src, { TURBOPACK: { push: (a) => pushed.push(a) } }, { timeout: 2000 });
  } catch {
    return [];
  }
  const mods = [];
  for (const arr of pushed) {
    let ids = [];
    for (const item of arr.slice(1)) {
      if (typeof item === "function") {
        const code = item.toString();
        const exp = /\.s\(\[([^\]]{0,300})/.exec(code)?.[1];
        const names = exp ? [...exp.matchAll(/"([A-Za-z_$][\w$]*)"/g)].map((m) => m[1]).slice(0, 4).join(",") : "";
        mods.push({ key: ids.join("+"), raw: code.length, gz: gzipSync(code).length, names });
        ids = [];
      } else ids.push(item);
    }
  }
  return mods;
}

const cache = new Map();
const mods = (f) => (cache.has(f) ? cache.get(f) : (cache.set(f, modulesOf(f)), cache.get(f)));

const tpl = JSON.parse(readFileSync(path.join(OUT, "templates.json"), "utf8"));
const report = {};
const kb = (n) => (n / 1024).toFixed(1);
for (const [name, t] of Object.entries(tpl)) {
  const seen = new Map();
  for (const j of t.js) {
    if (/noModule/.test(j.attrs)) continue;
    const f = path.basename(j.src);
    for (const m of mods(f)) {
      const e = seen.get(m.key) ?? { ...m, chunks: [] };
      e.chunks.push(f);
      seen.set(m.key, e);
    }
  }
  const dupes = [...seen.values()].filter((e) => e.chunks.length > 1);
  const extraRaw = dupes.reduce((n, e) => n + e.raw * (e.chunks.length - 1), 0);
  const extraGz = dupes.reduce((n, e) => n + e.gz * (e.chunks.length - 1), 0);
  report[name] = { dupes: dupes.length, extraRaw, extraGz, list: dupes.sort((a, b) => b.raw - a.raw).map((e) => ({ key: e.key, names: e.names, raw: e.raw, copies: e.chunks.length, chunks: e.chunks })) };
  console.log(`${name.padEnd(12)} duplicated modules in first load: ${dupes.length}, redundant ${kb(extraRaw)} KB raw (~${kb(extraGz)} KB gz if gzipped standalone)`);
}
console.log("\nhome duplicates:");
for (const d of report.home.list.slice(0, 25)) console.log(`  ${kb(d.raw).padStart(6)} raw x${d.copies} #${d.key} [${d.names}] ${d.chunks.join(" ")}`);
console.log("\nproduct duplicates:");
for (const d of report.product.list.slice(0, 15)) console.log(`  ${kb(d.raw).padStart(6)} raw x${d.copies} #${d.key} [${d.names}] ${d.chunks.join(" ")}`);

// Build-wide: how many chunks carry the same module
const all = new Map();
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".js"))) {
  for (const m of mods(f)) {
    const e = all.get(m.key) ?? { ...m, chunks: [] };
    e.chunks.push(f);
    all.set(m.key, e);
  }
}
const wide = [...all.values()].filter((e) => e.chunks.length > 2).sort((a, b) => b.raw * b.chunks.length - a.raw * a.chunks.length);
console.log("\nbuild-wide modules in > 2 chunks (top 20 by raw x copies):");
for (const e of wide.slice(0, 20)) console.log(`  ${kb(e.raw).padStart(6)} raw x${String(e.chunks.length).padStart(3)} #${e.key} [${e.names}]`);
writeFileSync(path.join(OUT, "dupes.json"), JSON.stringify({ perTemplate: report, buildWide: wide.slice(0, 60).map((e) => ({ key: e.key, names: e.names, raw: e.raw, copies: e.chunks.length })) }, null, 2));
