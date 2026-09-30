// perf-bundle track: attributes each template's first-load chunks to the Next entry that pulls them
// in (root layout, root error / not-found / global-error boundaries, group layouts, page), using
// the client reference manifests in .next/server/app (read-only).
//   node scripts/qa/audit/perf-bundle-entries.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const MAN = {
  home: "(shop)/page",
  category: "(shop)/delovi/[kategorija]/page",
  product: "(shop)/deo/[slug]/page",
  landing: "(landing)/ponuda/[slug]/page",
  upit: "(shop)/upit/page",
  porudzbina: "(shop)/porudzbina/page",
  prijava: "(shop)/prijava/page",
};
const sizes = JSON.parse(readFileSync("docs/qa/audit/perf-bundle/chunk-signatures.json", "utf8"));
const out = {};
for (const [name, rel] of Object.entries(MAN)) {
  let src;
  try {
    src = readFileSync(path.join(".next/server/app", `${rel}_client-reference-manifest.js`), "utf8");
  } catch {
    console.log(`${name}: manifest not found (${rel})`);
    continue;
  }
  const m = /"entryJSFiles":(\{[^}]*\})/.exec(src);
  const entries = JSON.parse(m[1]);
  const owner = new Map();
  for (const [entry, files] of Object.entries(entries)) {
    for (const f of files) {
      const b = path.basename(f);
      if (!owner.has(b)) owner.set(b, entry.replace("[project]/", ""));
    }
  }
  const byEntry = {};
  for (const [b, entry] of owner) {
    const gz = sizes[b]?.gz ?? 0;
    byEntry[entry] ??= { gz: 0, files: [] };
    byEntry[entry].gz += gz;
    byEntry[entry].files.push(`${b}(${(gz / 1024).toFixed(1)})`);
  }
  out[name] = byEntry;
  console.log(`\n== ${name} (${rel}) — chunks first attributed to each entry, KB gz`);
  for (const [e, v] of Object.entries(byEntry)) console.log(`   ${(v.gz / 1024).toFixed(1).padStart(6)}  ${e.padEnd(44)} ${v.files.join(" ")}`);
}
writeFileSync("docs/qa/audit/perf-bundle/entries.json", JSON.stringify(out, null, 2));
