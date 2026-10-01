// PERF-13: how often shell landmarks are serialized in the inline RSC payload vs rendered in the
// HTML, fetched live (AUDIT_BASE). Same counting as scripts/qa/audit/perf-bundle-rsc-count.mjs.
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3001";
const pages = { home: "/", product: "/delovi/kocioni-diskovi", landing: "/ponuda/kocione-plocice-golf", korpa: "/korpa" };
const marks = ['"site-header"', '"site-footer"', "Stranica nije pronađena", "Nemate pristup", "Potrebna je prijava", "SearchBox", "VehiclePicker", "MobileNav"];
for (const [n, path] of Object.entries(pages)) {
  const res = await fetch(BASE + path);
  const s = await res.text();
  const all = [...s.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)].map((m) => JSON.parse(m[1])).join("");
  const html = s.replace(/<script[\s\S]*?<\/script>/g, "");
  console.log(`== ${n} ${path} ${res.status} rsc ${all.length} chars`);
  console.log("   " + marks.map((m) => `${m}: rsc ${all.split(m).length - 1} / html ${html.split(m).length - 1}`).join("\n   "));
}
