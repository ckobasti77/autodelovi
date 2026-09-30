// perf-bundle track: splits Turbopack production chunks into their module factories (evaluated
// in a vm sandbox, nothing executed) and prints each module's raw / gzip size with a label taken
// from its exports, so shared first-load chunks can be attributed to source modules.
//
//   node scripts/qa/audit/perf-bundle-modules.mjs <chunk.js> [<chunk.js> ...] [--top 40] [--json out.json]
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { gzipSync } from "node:zlib";

const args = process.argv.slice(2);
const topI = args.indexOf("--top");
const TOP = topI >= 0 ? Number(args[topI + 1]) : 40;
const jsonI = args.indexOf("--json");
const JSON_OUT = jsonI >= 0 ? args[jsonI + 1] : null;
const files = args.filter((a, i) => !a.startsWith("--") && (topI < 0 || i !== topI + 1) && (jsonI < 0 || i !== jsonI + 1));

const all = [];
for (const f of files) {
  const file = path.isAbsolute(f) ? f : path.resolve(".next/static/chunks", f.endsWith(".js") ? f : `${f}.js`);
  const src = readFileSync(file, "utf8");
  const pushed = [];
  const sandbox = { TURBOPACK: { push: (arr) => pushed.push(arr) } };
  try {
    vm.runInNewContext(src, sandbox, { timeout: 2000 });
  } catch (e) {
    console.log(`! ${path.basename(file)}: not a module chunk (${String(e).slice(0, 80)})`);
    continue;
  }
  for (const arr of pushed) {
    let ids = [];
    for (const item of arr.slice(1)) {
      if (typeof item === "number" || typeof item === "string") ids.push(item);
      else if (typeof item === "function") {
        const code = item.toString();
        const exp = /\.s\(\[([^\]]{0,400})/.exec(code)?.[1];
        const names = exp ? [...exp.matchAll(/"([A-Za-z_$][\w$]*)"/g)].map((m) => m[1]).slice(0, 8).join(",") : "";
        const strs = [...code.matchAll(/"([^"\\]{6,40})"/g)].map((m) => m[1]).filter((s) => !/^use strict$/.test(s)).slice(0, 4).join(" | ");
        all.push({ chunk: path.basename(file), ids: ids.join("+"), raw: code.length, gz: gzipSync(code).length, names, hint: strs });
        ids = [];
      }
    }
  }
}
all.sort((a, b) => b.raw - a.raw);
const kb = (n) => (n / 1024).toFixed(1);
for (const m of all.slice(0, TOP)) {
  console.log(`${kb(m.raw).padStart(7)} raw ${kb(m.gz).padStart(6)} gz  ${m.chunk} #${m.ids}  [${m.names}]  ${m.hint}`);
}
console.log(`modules: ${all.length}, sum raw ${kb(all.reduce((n, m) => n + m.raw, 0))} KB`);
if (JSON_OUT) writeFileSync(JSON_OUT, JSON.stringify(all, null, 2));
