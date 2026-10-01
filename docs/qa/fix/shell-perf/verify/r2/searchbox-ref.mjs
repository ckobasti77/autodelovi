// Step 22 shell-perf verify round 2 · PERF-01 point (c): where does the SearchBox client
// reference sit in the first-visit RSC payload of a catalog page (not-found boundary or page)?
// Usage: AUDIT_BASE=http://localhost:3001 node docs/qa/fix/shell-perf/verify/r2/searchbox-ref.mjs
import { writeFileSync } from "node:fs";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3001";
const out = {};
for (const route of ["/delovi/kocioni-diskovi", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", "/upit", "/"]) {
  const html = await (await fetch(`${BASE}${route}`)).text();
  // Decode the self.__next_f.push([1,"..."]) chunks into the flight text.
  let flight = "";
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) flight += JSON.parse(m[1]);
  const rows = new Map();
  for (const line of flight.split("\n")) {
    const m = /^([0-9a-f]+):I\[("[^"]+")/.exec(line);
    if (m) rows.set(m[1], JSON.parse(m[2]));
  }
  const ids = [...rows].filter(([, mod]) => mod.includes("components/shell/SearchBox.tsx")).map(([id]) => id);
  const uses = [];
  for (const id of ids) {
    for (const m of flight.matchAll(new RegExp(`"\\$L${id}"`, "g"))) {
      const before = flight.slice(Math.max(0, m.index - 2000), m.index);
      const lineStart = flight.lastIndexOf("\n", m.index);
      const rowId = /^\n?([0-9a-f]+):/.exec(flight.slice(lineStart, lineStart + 12))?.[1];
      uses.push({
        row: rowId,
        mentionsNotFound: /not-found|NotFound|Stranica nije prona/.test(before),
        context: before.slice(-300).replace(/\s+/g, " "),
      });
    }
  }
  // Which rows reference the row that uses SearchBox (walk one level up to the boundary).
  const parents = [];
  for (const u of uses) {
    if (!u.row) continue;
    for (const m of flight.matchAll(new RegExp(`"\\$L?${u.row}"`, "g"))) {
      parents.push(flight.slice(Math.max(0, m.index - 250), m.index + 10).replace(/\s+/g, " "));
    }
  }
  out[route] = {
    searchBoxModuleRows: ids,
    uses,
    parents: parents.slice(0, 4),
    notFoundBoundaryInPayload: flight.includes("not-found"),
    searchBoxInPayload: ids.length > 0,
  };
}
writeFileSync("docs/qa/fix/shell-perf/verify/r2/searchbox-ref.json", JSON.stringify(out, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { ids: v.searchBoxModuleRows, uses: v.uses.map((u) => ({ row: u.row, nf: u.mentionsNotFound })) }])), null, 1));
