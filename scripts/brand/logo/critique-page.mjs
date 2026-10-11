// Builds docs/brand/concepts/critique.html — the three finalists on one self-contained page
// (inline SVG, no external requests). This is the viewable target of the impeccable critique.
// Usage: node scripts/brand/logo/critique-page.mjs k2-e-plus k6-etiketa k7-izvucen-plus
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const DIR = path.join(ROOT, "docs/brand/concepts");
const ids = process.argv.slice(2);
const read = async (f) =>
  (await readFile(path.join(DIR, f), "utf8")).replace(/ width="[\d.]+" height="[\d.]+"/, "").trim();

let sections = "";
for (const id of ids) {
  const cells = [];
  for (const theme of ["night", "paper"]) {
    const primary = await read(`${id}-primary-${theme}.svg`);
    const mark = await read(`${id}-mark-${theme}.svg`);
    cells.push(`<div class="cell ${theme}">
      <div class="lockup">${primary}</div>
      <div class="marks">${[256, 64, 32, 16].map((s) => `<span class="mark" style="width:${s}px;height:${s}px">${mark}</span>`).join("")}</div>
    </div>`);
  }
  sections += `<section aria-labelledby="h-${id}"><h2 id="h-${id}">${id}</h2><div class="pair">${cells.join("")}</div></section>`;
}

const html = `<!doctype html>
<html lang="sr-Latn-RS"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Koncepti logotipa — finalisti</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0D0F11; color: #F1ECE3; font: 16px/1.5 system-ui, sans-serif; }
  main { max-width: 1440px; margin: 0 auto; padding: 32px 24px 64px; }
  h1 { font-size: 22px; font-weight: 650; margin: 0 0 24px; }
  h2 { font: 500 13px/1.4 ui-monospace, monospace; color: #969088; margin: 40px 0 12px; }
  .pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1px; background: #2C3238; border: 1px solid #2C3238; }
  .cell { padding: 40px 32px; }
  .night { background: #0D0F11; }
  .paper { background: #FFFFFF; }
  .lockup svg { display: block; width: 100%; height: auto; max-width: 620px; }
  .marks { display: flex; align-items: flex-end; gap: 24px; margin-top: 40px; flex-wrap: wrap; }
  .mark { display: block; flex: none; }
  .mark svg { display: block; width: 100%; height: 100%; }
</style></head>
<body><main><h1>Euromotors Plus by OEM Parts — finalisti</h1>${sections}</main></body></html>
`;
await writeFile(path.join(DIR, "critique.html"), html);
console.log("wrote docs/brand/concepts/critique.html", (html.length / 1024).toFixed(1), "KB");
