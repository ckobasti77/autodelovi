/** Step 21 audit (backend): staff/owner mutations whose handler text never calls audit(...) directly. */
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
const scan = JSON.parse(readFileSync("docs/qa/audit/backend/function-scan.json", "utf8"));
const out = [];
for (const r of scan.results.filter((x) => x.builder === "staffMutation" || x.builder === "ownerMutation")) {
  const src = readFileSync(r.file, "utf8");
  const sf = ts.createSourceFile(r.file, src, ts.ScriptTarget.Latest, true);
  let text = "";
  sf.forEachChild((n) => {
    if (ts.isVariableStatement(n) && n.declarationList.declarations.some((d) => d.name.getText(sf) === r.name)) text = n.getText(sf);
  });
  if (!/\baudit\(|Audit\(|auditRow|writeAudit|actor:\s*actorOf/.test(text)) out.push(`${r.file}:${r.line} ${r.name} [${r.builder}]`);
}
writeFileSync("docs/qa/audit/backend/unaudited-staff-mutations.txt", out.join("\n") + "\n");
console.log(out.join("\n"));
