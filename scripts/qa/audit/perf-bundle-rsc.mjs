// perf-bundle track: decodes the inline RSC payload (self.__next_f) of the saved template HTML
// and lists its largest rows, so the HTML weight can be attributed (shell vs page data).
//   node scripts/qa/audit/perf-bundle-rsc.mjs [name ...]
import { readFileSync } from "node:fs";

const names = process.argv.slice(2).length ? process.argv.slice(2) : ["korpa", "home", "generation", "product"];
for (const n of names) {
  const s = readFileSync(`docs/qa/audit/perf-bundle/html/${n}.html`, "utf8");
  const parts = [...s.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map((m) => JSON.parse(m[1]));
  const all = parts.join("");
  const rows = all.split(/\n(?=[0-9a-f]+:)/);
  const sized = rows.map((r) => ({ len: Buffer.byteLength(r), head: r.slice(0, 180).replace(/\s+/g, " ") })).sort((a, b) => b.len - a.len);
  console.log(`== ${n}: HTML ${(Buffer.byteLength(s) / 1024).toFixed(1)} KB, RSC decoded ${(Buffer.byteLength(all) / 1024).toFixed(1)} KB in ${rows.length} rows`);
  for (const x of sized.slice(0, 8)) console.log(`   ${(x.len / 1024).toFixed(1).padStart(6)} KB  ${x.head}`);
  const count = (re) => (all.match(re) || []).length;
  console.log(`   "className" x${count(/className/g)}, "data-reveal" x${count(/data-reveal/g)}, "href" x${count(/"href"/g)}, svg paths "d": x${count(/"d":"/g)}`);
  // Rows with identical bodies (same subtree serialized twice).
  const bodies = new Map();
  for (const r of rows) {
    const i = r.indexOf(":");
    const body = r.slice(i + 1);
    if (body.length < 500) continue;
    const e = bodies.get(body) ?? [];
    e.push(r.slice(0, i));
    bodies.set(body, e);
  }
  for (const [body, ids] of bodies) {
    if (ids.length < 2) continue;
    const refs = ids.map((id) => {
      const m = new RegExp(`"\\$L?${id}"`).exec(all);
      return m ? all.slice(Math.max(0, m.index - 140), m.index + 6).replace(/\s+/g, " ") : "(no ref)";
    });
    console.log(`   DUPLICATE row x${ids.length} (${(Buffer.byteLength(body) / 1024).toFixed(1)} KB each) ids ${ids.join(",")}: ${body.slice(0, 90)}`);
    for (const r of refs) console.log(`      referenced by …${r}`);
  }
}
