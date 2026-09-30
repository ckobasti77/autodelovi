// verify track: print one module factory's head/exports by chunk and id.
import { readFileSync } from "node:fs";
import vm from "node:vm";
const [chunk, id, n = "600"] = process.argv.slice(2);
const pushed = [];
vm.runInNewContext(readFileSync(`.next/static/chunks/${chunk}.js`, "utf8"), { TURBOPACK: { push: (a) => pushed.push(a) } });
for (const arr of pushed) { let cur = null; for (const it of arr.slice(1)) { if (typeof it !== "function") { cur = it; continue; } if (String(cur) === id) { const c = it.toString(); console.log("len", c.length, "maps", (c.match(/new Map\(/g) || []).length, "exports", (c.match(/e\.s\(\[[^\]]*\]/g) || []).join(" | ")); console.log(c.slice(0, +n)); } } }
