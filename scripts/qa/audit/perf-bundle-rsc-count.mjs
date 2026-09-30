// perf-bundle track: counts how often shell landmarks are serialized in the inline RSC payload vs
// rendered in the HTML (a count > 1 in RSC with 1 in HTML = fallback UI shipped but not shown).
//   node scripts/qa/audit/perf-bundle-rsc-count.mjs
import { readFileSync } from "node:fs";

const marks = ['"site-header"', '"site-footer"', '"skip-link"', "Stranica nije pronađena", "Kočioni diskovi", '"401: ', '"403: ', "nominative", "not-found"];
for (const n of ["korpa", "home", "product", "prijava", "landing"]) {
  const s = readFileSync(`docs/qa/audit/perf-bundle/html/${n}.html`, "utf8");
  const all = [...s.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map((m) => JSON.parse(m[1])).join("");
  const html = s.replace(/<script[\s\S]*?<\/script>/g, "");
  const row = marks.map((m) => `${m}: rsc ${all.split(m).length - 1} / html ${html.split(m.replaceAll('"', '"')).length - 1}`);
  console.log(`== ${n}\n   ${row.join("\n   ")}`);
}
