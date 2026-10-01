/**
 * Post-build step (PERF-01, D294): marks the framework chunks every App Router page runs on load
 * — the Turbopack runtime, React DOM and the Next router, `rootMainFiles` in
 * `.next/build-manifest.json` — with V8's explicit compile hint `//# allFunctionsCalledOnLoad`
 * (Chrome 136+, https://v8.dev/blog/explicit-compile-hints).
 *
 * Without the hint V8 compiles each module factory lazily on the main thread the first time it
 * runs: on a throttled phone that was most of the 125–250 ms boot task that evaluates the
 * framework chunk. With it, V8 compiles the whole file eagerly while the script streams in, on a
 * background thread. Browsers without the feature read an ordinary comment. Only these files
 * get it — their functions do run on every load; page chunks keep lazy compilation.
 *
 * Idempotent (a file that already starts with the hint is left alone). Runs from `npm run build`.
 *   node scripts/build/compile-hints.mjs [distDir]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const COMPILE_HINT = "//# allFunctionsCalledOnLoad";

/** Returns the source with the hint as its first line (unchanged when already there). */
export function withCompileHint(source) {
  return source.startsWith(COMPILE_HINT) ? source : `${COMPILE_HINT}\n${source}`;
}

/** The JS files the hint applies to: the root main files of the build manifest. */
export function hintTargets(manifest) {
  return (manifest.rootMainFiles ?? []).filter((file) => file.endsWith(".js"));
}

function main() {
  const distDir = path.resolve(process.argv[2] ?? ".next");
  const manifest = JSON.parse(readFileSync(path.join(distDir, "build-manifest.json"), "utf8"));
  const targets = hintTargets(manifest);
  if (targets.length === 0) {
    console.error("compile-hints: no rootMainFiles in build-manifest.json");
    process.exit(1);
  }
  for (const file of targets) {
    const full = path.join(distDir, file);
    const source = readFileSync(full, "utf8");
    const next = withCompileHint(source);
    if (next !== source) writeFileSync(full, next);
    console.log(`compile-hints: ${next === source ? "already hinted" : "hinted"} ${file}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
