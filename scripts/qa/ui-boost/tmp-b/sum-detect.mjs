import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const root = path.resolve(decodeURIComponent(dir), "../../../..");
for (const f of readdirSync(decodeURIComponent(dir)).filter((n) => /^d\d+\.json$/.test(n)).sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)))) {
  const raw = readFileSync(path.join(decodeURIComponent(dir), f), "utf8");
  let a;
  try {
    a = JSON.parse(raw);
  } catch (e) {
    console.log("==", f, "PARSE ERROR", raw.slice(0, 300));
    continue;
  }
  console.log("==", f, a.length);
  for (const x of a) {
    console.log(" ", x.antipattern, "|", x.severity, "|", path.relative(root, x.file), ":", x.line, "|", x.snippet);
  }
}
