/**
 * Step 21 QA audit, track "seo": full-text near-duplicate check (5-word shingles, Jaccard) of the
 * <main> text of the given pairs of paths; prints the words unique to each page.
 *   node scripts/qa/audit/seo-dupe.mjs /a /b [/c /d ...]
 */
import { JSDOM } from "jsdom";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const text = async (p) => {
  const d = new JSDOM(await (await fetch(BASE + p)).text()).window.document;
  const m = d.querySelector("main");
  m.querySelectorAll("script,style").forEach((n) => n.remove());
  return m.textContent.replace(/\s+/g, " ").trim();
};
const words = (t) => t.toLowerCase().replace(/[^a-zčćžšđ0-9 ]/g, " ").split(/\s+/).filter(Boolean);
const sh = (w) => new Set(w.map((_, i) => w.slice(i, i + 5).join(" ")).slice(0, Math.max(0, w.length - 4)));
const args = process.argv.slice(2);
for (let i = 0; i + 1 < args.length; i += 2) {
  const [ta, tb] = [await text(args[i]), await text(args[i + 1])];
  const [wa, wb] = [words(ta), words(tb)];
  const [a, b] = [sh(wa), sh(wb)];
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const onlyA = [...new Set(wa)].filter((w) => !wb.includes(w));
  const onlyB = [...new Set(wb)].filter((w) => !wa.includes(w));
  console.log(`${args[i]} (${wa.length} words) vs ${args[i + 1]} (${wb.length} words): jaccard ${(inter / (a.size + b.size - inter)).toFixed(2)}`);
  console.log(`  only in A: ${onlyA.join(" ").slice(0, 400)}`);
  console.log(`  only in B: ${onlyB.join(" ").slice(0, 400)}`);
}
