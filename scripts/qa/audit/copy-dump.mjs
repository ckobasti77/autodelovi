// Copy track: writes a readable text dump of a crawl (header/footer lines that occur on > 60 % of pages removed once).
import { readFileSync, writeFileSync } from "node:fs";
const [file, out] = process.argv.slice(2);
const j = JSON.parse(readFileSync(`docs/qa/audit/copy/${file}`, "utf8"));
const pages = j.results.filter((r) => r.text);
const freq = new Map();
for (const p of pages) for (const l of new Set(p.text.split("\n").map((s) => s.trim()).filter(Boolean))) freq.set(l, (freq.get(l) ?? 0) + 1);
const common = new Set([...freq].filter(([, n]) => n > pages.length * 0.6 && pages.length > 3).map(([l]) => l));
let s = `COMMON LINES (on > 60 % of pages):\n${[...common].join("\n")}\n`;
for (const p of pages) {
  s += `\n\n======== ${p.url} [${p.status}]\nTITLE: ${p.title}\nDESC: ${p.description}\nOG: ${p.ogTitle} | ${p.ogDescription}\nH1: ${JSON.stringify(p.h1)}\n--- text\n`;
  s += p.text.split("\n").map((l) => l.trim()).filter((l) => l && !common.has(l)).join("\n");
  const attrs = [...new Set((p.attrs ?? []).map((a) => `${a.attr}=${a.value}`))];
  s += `\n--- attrs\n${attrs.join(" | ")}`;
}
writeFileSync(`docs/qa/audit/copy/${out}`, s);
console.log(pages.length, "pages", s.length, "chars");
