// Verifier for copy-01 (part 2): classify every shortened product meta description against the
// full fitmentSummary carried in the page's RSC payload.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
const OUT = path.resolve("docs/qa/audit/verify/copy");
const { rows } = JSON.parse(readFileSync(path.join(OUT, "copy-01-reproduce.json"), "utf8"));
const shortened = rows.filter((r) => r.desc && r.desc.includes("…"));

const result = [];
for (const r of shortened) {
  const html = await (await fetch(BASE + r.url)).text();
  const all = [...html.matchAll(/\\"fitmentSummary\\":\\"(.*?)\\"/g)].map((x) => x[1]);
  const before = r.desc.split("…")[0];
  const shown = before.slice(before.lastIndexOf(" za ") + 4);
  const full = all.find((f) => f.startsWith(shown.replace(/\s+$/, ""))) ?? null;
  let kind = "unknown";
  if (full && shown !== null) {
    const trimmed = shown.replace(/\s+$/, "");
    const next = full.charAt(trimmed.length);
    const midWord = next !== "" && /[\p{L}\p{N}]/u.test(next) && /[\p{L}\p{N}]$/u.test(trimmed);
    const labels = full.split(/, | i još /);
    const endsOnLabel = labels.some((l) => trimmed.endsWith(l)) && (next === "," || next === " " || next === "");
    if (midWord) kind = "mid-word";
    else if (/ i$/.test(trimmed) || / i još$/.test(trimmed)) kind = / i još$/.test(trimmed) ? "i još (count dropped)" : "dangling 'i'";
    else if (endsOnLabel) kind = "clean label boundary";
    else kind = "incomplete label (word boundary)";
    if (shown !== trimmed) kind += " + space before …";
  }
  result.push({ url: r.url, full, shown, kind });
}
const tally = result.reduce((a, x) => ((a[x.kind] = (a[x.kind] ?? 0) + 1), a), {});
writeFileSync(path.join(OUT, "copy-01-reproduce-desc.json"), JSON.stringify({ tally, result }, null, 2));
console.log(tally);
for (const x of result) console.log(x.kind.padEnd(44), JSON.stringify(x.shown), "<=", JSON.stringify(x.full));
