// perf-bundle track: measures how much of the inline RSC payload is spent on the error/not-found/
// forbidden/unauthorized boundary fallbacks that Next serializes for every layout segment (they are
// sent with every page even though they render only on error).
//   node scripts/qa/audit/perf-bundle-rsc-boundaries.mjs [name ...]
import { readFileSync } from "node:fs";

const names = process.argv.slice(2).length ? process.argv.slice(2) : ["korpa", "home", "product", "generation"];
for (const n of names) {
  const s = readFileSync(`docs/qa/audit/perf-bundle/html/${n}.html`, "utf8");
  const all = [...s.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map((m) => JSON.parse(m[1])).join("");
  const rows = new Map();
  for (const r of all.split(/\n(?=[0-9a-f]+:)/)) {
    const i = r.indexOf(":");
    rows.set(r.slice(0, i), r.slice(i + 1));
  }
  const refsOf = (body) => [...body.matchAll(/"\$[L@]?([0-9a-f]+)"/g)].map((m) => m[1]).filter((id) => rows.has(id));
  const closure = (start) => {
    const seen = new Set();
    const stack = [...start];
    while (stack.length) {
      const id = stack.pop();
      if (seen.has(id) || !rows.has(id)) continue;
      seen.add(id);
      stack.push(...refsOf(rows.get(id)));
    }
    return seen;
  };
  // Boundary slots: "forbidden":"$Lx","unauthorized":"$Ly" and the not-found/error slot arrays that
  // precede them in the flight tree.
  const keys = {};
  for (const k of ["forbidden", "unauthorized", "notFound", "notFoundStyles", "errorComponent", "globalError"]) {
    keys[k] = [...all.matchAll(new RegExp(`"${k}":"\\$L?([0-9a-f]+)"`, "g"))].map((m) => m[1]);
  }
  // Rows referenced only from boundaries: closure(boundary roots) minus closure(everything else).
  const context = [...all.matchAll(/.{0,60}"forbidden":/g)].map((m) => m[0]);
  const bRoots = Object.values(keys).flat();
  const bSet = closure(bRoots);
  const size = (set) => [...set].reduce((a, id) => a + Buffer.byteLength(rows.get(id) ?? ""), 0);
  console.log(`== ${n}: RSC ${(Buffer.byteLength(all) / 1024).toFixed(1)} KB, rows ${rows.size}`);
  console.log(`   boundary roots ${JSON.stringify(keys)}`);
  console.log(`   rows reachable from forbidden/unauthorized slots: ${bSet.size}, ${(size(bSet) / 1024).toFixed(1)} KB`);
  for (const c of context) console.log(`   …${c.replace(/\s+/g, " ")}`);
  // The not-found fallbacks are positional in the flight tree: [..., loading, notFound?]. Find rows
  // that contain "404" or the NotFound content and measure their closure.
  const nf = [...rows.entries()].filter(([, b]) => /not-found|Stranica nije pronađena|404/.test(b)).map(([id]) => id);
  const nfSet = closure(nf);
  console.log(`   rows mentioning 404/not-found: ${nf.join(",")}; closure ${nfSet.size} rows, ${(size(nfSet) / 1024).toFixed(1)} KB`);
}
