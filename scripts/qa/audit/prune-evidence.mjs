/**
 * Keeps the audit evidence small enough for git: in the given folders under docs/qa/audit/, a
 * file survives when docs/qa/AUDIT.md or docs/qa/audit/findings.json references it (any size), or
 * when it is a non-image file under 300 KB (logs, metrics, summaries). Everything else — mostly
 * uncited screenshots of capture sweeps, re-creatable with the scripts in scripts/qa/audit/ — is
 * deleted.
 *
 *   node scripts/qa/audit/prune-evidence.mjs [--dry] <folder under docs/qa/audit> …
 */
import { readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const dirs = args.filter((a) => a !== "--dry");
const root = path.resolve("docs/qa/audit");
const refs = [readFileSync("docs/qa/AUDIT.md", "utf8"), readFileSync(path.join(root, "findings.json"), "utf8")]
  .join("\n")
  .replaceAll("\\\\", "/")
  .replaceAll("\\", "/");
const IMAGE = /\.(webp|png|jpe?g|gif)$/i;

const walk = (d) =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)],
  );

let kept = 0;
let keptBytes = 0;
let removed = 0;
let removedBytes = 0;
for (const dir of dirs) {
  for (const file of walk(path.join(root, dir))) {
    const rel = path.relative(root, file).replaceAll("\\", "/");
    const size = statSync(file).size;
    const referenced = refs.includes(rel) || refs.includes(path.basename(file)) && refs.includes(`${path.dirname(rel)}/`);
    const keep = referenced || (!IMAGE.test(file) && size < 300_000);
    if (keep) {
      kept++;
      keptBytes += size;
    } else {
      removed++;
      removedBytes += size;
      if (!dry) unlinkSync(file);
    }
  }
}
const mb = (b) => `${(b / 1e6).toFixed(1)} MB`;
console.log(`${dry ? "[dry] " : ""}kept ${kept} files (${mb(keptBytes)}), removed ${removed} (${mb(removedBytes)})`);
