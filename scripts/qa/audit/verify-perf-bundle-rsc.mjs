// verify track (perf-bundle-06): fetch fresh HTML, decode the inline RSC payload, count shell and
// 404 markers in RSC vs visible HTML.
//   node scripts/qa/audit/verify-perf-bundle-rsc.mjs
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const routes = {
  landing: "/ponuda/kocione-plocice-golf",
  home: "/",
  korpa: "/korpa",
  category: "/delovi/kocioni-diskovi",
  product: "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
};
const PUSH = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
const out = [];
for (const [name, path] of Object.entries(routes)) {
  const html = await (await fetch(BASE + path)).text();
  const rsc = [...html.matchAll(PUSH)].map((m) => JSON.parse(m[1])).join("");
  writeFileSync(`docs/qa/audit/verify/perf-bundle/${name}.rsc.txt`, rsc);
  const vis = html.replace(/<script[\s\S]*?<\/script>/g, "");
  const count = (s, n) => s.split(n).length - 1;
  const marks = ['"site-header"', '"site-footer"', "Stranica nije pronađena", "Često tražene kategorije", "Adresa je možda promenjena"];
  out.push(`== ${name} ${path}  html ${html.length} B, rsc decoded ${rsc.length} B (gz ${gzipSync(rsc).length} B)`);
  for (const m of marks) out.push(`   ${m}: rsc ${count(rsc, m)} / html(no scripts) ${count(vis, m)}`);
}
console.log(out.join("\n"));
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-06-rsc-count.txt", out.join("\n") + "\n");
