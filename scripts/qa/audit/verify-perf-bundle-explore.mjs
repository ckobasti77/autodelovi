// verify track (perf-bundle findings): list module factories in given chunks with size and a content hint.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { gzipSync } from "node:zlib";
const dir = ".next/static/chunks/";
for (const c of process.argv.slice(2)) {
  const src = readFileSync(dir + c + ".js", "utf8");
  const pushed = [];
  try { vm.runInNewContext(src, { TURBOPACK: { push: (a) => pushed.push(a) }, document: undefined }, { timeout: 2000 }); } catch (e) { console.log(c, "ERR", String(e).slice(0, 80)); continue; }
  console.log(`== ${c} raw ${src.length}`);
  for (const arr of pushed) {
    let id = null;
    for (const it of arr.slice(1)) {
      if (typeof it !== "function") { id = it; continue; }
      const code = it.toString();
      const words = (code.match(/"[A-Za-z][\w.\- ]{3,30}"/g) || []).slice(0, 6).join(" ");
      console.log(`  #${id} raw ${code.length} gz ${gzipSync(code).length}  ${words}`);
    }
  }
}
