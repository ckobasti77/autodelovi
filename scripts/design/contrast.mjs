// Computes WCAG 2.2 contrast ratios for the SKLOP color tokens (docs/design/tokens.json)
// and prints the Markdown table used in docs/design/DESIGN-SYSTEM.md §3.
// Usage: node scripts/design/contrast.mjs [--check]   (--check exits 1 when a required pair fails)
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const tokens = JSON.parse(await readFile(path.join(ROOT, "docs/design/tokens.json"), "utf8"));

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex).map(lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
/** Resolves "theme.group.name" references inside tokens.json. */
const resolve = (ref) => ref.split(".").reduce((node, key) => node?.[key], tokens.color);

let failures = 0;
const rows = [];
for (const pair of tokens.contrastPairs) {
  const fg = resolve(pair.fg);
  const bg = resolve(pair.bg);
  if (!fg || !bg) throw new Error(`Unknown token in pair ${pair.fg} / ${pair.bg}`);
  const r = ratio(fg, bg);
  const pass = r >= pair.min;
  if (!pass) failures++;
  rows.push(`| ${pair.use} | \`${pair.fg}\` ${fg} | \`${pair.bg}\` ${bg} | **${r.toFixed(2)}:1** | ${pair.min}:1 | ${pass ? "pass" : "FAIL"} |`);
}
console.log("| Use | Foreground | Background | Ratio | Required | Result |");
console.log("|---|---|---|---|---|---|");
console.log(rows.join("\n"));
console.log(`\n${rows.length} pairs, ${failures} failing`);
if (process.argv.includes("--check") && failures) process.exit(1);
