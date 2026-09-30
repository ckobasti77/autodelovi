/**
 * Step 21 audit (backend track): static scan of every exported Convex function.
 * For each `export const name = builder({...})` in convex/**\/*.ts (tests and _generated excluded)
 * records the builder, whether `args` and `returns` are present, and flags:
 *  - public exports (query/mutation/action or any non-internal builder) not built with the
 *    SKLOP builders from convex/lib/functions.ts
 *  - missing args / returns validators
 *  - `.collect()` calls, `.filter(` on db queries, `Date.now()` / `new Date()` inside query handlers
 * Output: docs/qa/audit/backend/function-scan.json + a text summary on stdout.
 */
import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = path.resolve("convex");
const OUT = path.resolve("docs/qa/audit/backend");
mkdirSync(OUT, { recursive: true });

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (name === "_generated" || name === "node_modules") continue;
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith(".d.ts") && !name.startsWith("test.setup"))
      out.push(p);
  }
  return out;
}

const SKLOP = new Set([
  "publicQuery",
  "publicMutation",
  "userQuery",
  "userMutation",
  "staffQuery",
  "staffMutation",
  "ownerQuery",
  "ownerMutation",
]);
const INTERNAL = new Set(["internalQuery", "internalMutation", "internalAction"]);
const RAW_PUBLIC = new Set(["query", "mutation", "action", "httpAction"]);
const QUERY_BUILDERS = new Set(["publicQuery", "userQuery", "staffQuery", "ownerQuery", "internalQuery", "query"]);

const results = [];
const flags = [];

for (const file of walk(ROOT)) {
  const rel = path.relative(process.cwd(), file).replaceAll("\\", "/");
  if (rel.startsWith("convex/lib/") || rel.startsWith("convex/seedData/")) {
    // helpers: still scan for raw builder usage
  }
  const src = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  const lineOf = (node) => sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;

  for (const stmt of sf.statements) {
    if (!ts.isVariableStatement(stmt)) continue;
    const exported = stmt.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) continue;
    for (const decl of stmt.declarationList.declarations) {
      const init = decl.initializer;
      if (!init || !ts.isCallExpression(init)) continue;
      const callee = init.expression.getText(sf);
      if (!SKLOP.has(callee) && !INTERNAL.has(callee) && !RAW_PUBLIC.has(callee)) continue;
      const name = decl.name.getText(sf);
      const arg = init.arguments[0];
      let hasArgs = false;
      let hasReturns = false;
      let handler = null;
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) {
          const pn = p.name?.getText(sf);
          if (pn === "args") hasArgs = true;
          if (pn === "returns") hasReturns = true;
          if (pn === "handler") handler = p;
        }
      }
      const kind = SKLOP.has(callee) ? "sklop" : INTERNAL.has(callee) ? "internal" : "raw-public";
      const entry = { file: rel, line: lineOf(decl), name, builder: callee, kind, hasArgs, hasReturns };
      results.push(entry);
      if (kind === "raw-public" && callee !== "httpAction")
        flags.push({ ...entry, issue: "public export not built with SKLOP builders" });
      if (!hasArgs && callee !== "httpAction") flags.push({ ...entry, issue: "missing args validator" });
      if (!hasReturns && kind !== "internal" && callee !== "httpAction")
        flags.push({ ...entry, issue: "public function missing returns validator" });
      if (!hasReturns && kind === "internal") entry.internalNoReturns = true;
      // Wall clock inside query handlers
      if (handler && QUERY_BUILDERS.has(callee)) {
        const text = handler.getText(sf);
        if (/Date\.now\(\)|new Date\(\)/.test(text))
          flags.push({ ...entry, issue: "wall clock read inside a query handler (direct)" });
      }
    }
  }
  // .collect() and .filter( on db queries anywhere in the file
  src.split(/\r?\n/).forEach((l, i) => {
    if (/\.collect\(\)/.test(l)) flags.push({ file: rel, line: i + 1, issue: ".collect()", text: l.trim() });
    if (/\.query\("[^"]+"\)\s*\.filter\(/.test(l) || /^\s*\.filter\(\(q\)\s*=>/.test(l))
      flags.push({ file: rel, line: i + 1, issue: "db .filter()", text: l.trim() });
    if (/runAfter\([^,]+,\s*api\.|runAt\([^,]+,\s*api\./.test(l))
      flags.push({ file: rel, line: i + 1, issue: "scheduled api.* function", text: l.trim() });
  });
}

const summary = {
  files: new Set(results.map((r) => r.file)).size,
  functions: results.length,
  byKind: results.reduce((a, r) => ((a[r.kind] = (a[r.kind] ?? 0) + 1), a), {}),
  byBuilder: results.reduce((a, r) => ((a[r.builder] = (a[r.builder] ?? 0) + 1), a), {}),
  internalWithoutReturns: results.filter((r) => r.internalNoReturns).length,
  flags: flags.length,
};
writeFileSync(path.join(OUT, "function-scan.json"), JSON.stringify({ summary, flags, results }, null, 2));
console.log(JSON.stringify(summary, null, 2));
for (const f of flags) console.log(`${f.file}:${f.line} ${f.name ?? ""} [${f.builder ?? ""}] ${f.issue} ${f.text ?? ""}`);
