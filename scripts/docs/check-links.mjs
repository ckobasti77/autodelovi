// Checks that every link and image in the handoff documents resolves (step 29).
//
//   node scripts/docs/check-links.mjs [file ...]
//
// Without arguments it checks the owner-facing set: docs/PREDAJA.md, docs/GO-LIVE.md,
// docs/HUMAN-TODO.md, docs/README.md, docs/brand/LOGO.md, README.md and pipeline/REPORT.md.
// For each Markdown link and image: the target file or folder must exist, and a `#fragment`
// must match a heading of the target (GitHub's slug rules). External links (http, mailto) are
// listed, not fetched. Paths written as `code` that look like files of this repository are
// checked too and reported separately, because the owner follows those just the same.
// The showcase page has its own check: scripts/showcase/check.mjs.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT = [
  "docs/PREDAJA.md",
  "docs/GO-LIVE.md",
  "docs/HUMAN-TODO.md",
  "docs/README.md",
  "docs/brand/LOGO.md",
  "README.md",
  "pipeline/REPORT.md",
];
const files = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;
const ROOT = resolve(".");

/** GitHub heading slug: lower case, punctuation dropped, spaces to hyphens (letters with diacritics stay). */
const slug = (heading) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s/g, "-");

const headingCache = new Map();
function headings(path) {
  if (!headingCache.has(path)) {
    const seen = new Map();
    const slugs = new Set();
    let fenced = false;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      if (/^\s*```/.test(line)) fenced = !fenced;
      const match = !fenced && /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
      if (!match) continue;
      const base = slug(match[1]);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      slugs.add(n ? `${base}-${n}` : base);
    }
    headingCache.set(path, slugs);
  }
  return headingCache.get(path);
}

/** Root folders a `code` path may start with to count as a path of this repository. */
const REPO_PREFIX =
  /^(docs|scripts|public|app|components|lib|constants|config|convex|tests|pipeline|3d|\.claude|\.playwright)\//;

const broken = [];
const brokenCode = [];
const external = new Set();
let checked = 0;
let checkedCode = 0;

for (const file of files) {
  const source = resolve(file);
  if (!existsSync(source)) {
    broken.push(`${file}: the document itself is missing`);
    continue;
  }
  const lines = readFileSync(source, "utf8").split(/\r?\n/);
  let fenced = false;
  lines.forEach((line, index) => {
    if (/^\s*```/.test(line)) {
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    const where = `${file}:${index + 1}`;

    // [text](target) and ![alt](target); the target may carry a "title".
    for (const match of line.matchAll(/!?\[[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g)) {
      const target = match[1];
      if (/^(https?:|mailto:|tel:)/i.test(target)) {
        external.add(target);
        continue;
      }
      checked += 1;
      const [pathPart, fragment] = target.split("#");
      const path = pathPart ? resolve(dirname(source), decodeURIComponent(pathPart)) : source;
      if (!existsSync(path)) {
        broken.push(`${where}: ${target} → file not found`);
        continue;
      }
      if (fragment && statSync(path).isFile() && /\.md$/i.test(path)) {
        if (!headings(path).has(decodeURIComponent(fragment).toLowerCase())) {
          broken.push(`${where}: ${target} → no heading for #${decodeURIComponent(fragment)}`);
        }
      }
    }

    // `path/in/the/repo.ext` — only whole paths: no placeholders, globs, spaces or line numbers.
    for (const match of line.matchAll(/`([^`]+)`/g)) {
      const text = match[1].trim();
      if (!REPO_PREFIX.test(text) || /[\s*<>{}…|$]|\.\.\./.test(text)) continue;
      const path = text.replace(/:\d+$/, "").replace(/#.*$/, "");
      checkedCode += 1;
      // Written from the repository root, or (in docs/) relative to the document.
      if (!existsSync(resolve(ROOT, path)) && !existsSync(resolve(dirname(source), path))) {
        brokenCode.push(`${where}: \`${text}\``);
      }
    }
  });
}

console.log(
  `${files.length} documents · ${checked} links and images · ${checkedCode} paths in code spans`,
);
if (external.size) console.log(`external (not fetched): ${[...external].join(", ")}`);
if (brokenCode.length) {
  console.log(`\n${brokenCode.length} path(s) in code spans that do not exist:`);
  for (const b of brokenCode) console.log(`  ${b}`);
}
if (broken.length) {
  console.log(`\n${broken.length} broken link(s) or image(s):`);
  for (const b of broken) console.log(`  ${b}`);
}
if (broken.length || brokenCode.length) process.exit(1);
console.log("every link, image and repository path resolves");
