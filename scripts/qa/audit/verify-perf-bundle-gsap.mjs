// verify track perf-bundle-03: esbuild-minified size of gsap core + useGSAP with and without the
// globally registered plugins (react external), plus what the served chunk contains.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const kb = (n) => (n / 1024).toFixed(1);
const variants = {
  core_useGSAP: `import {gsap} from "gsap"; import {useGSAP} from "@gsap/react"; gsap.registerPlugin(useGSAP); export {gsap,useGSAP};`,
  core_useGSAP_CustomEase: `import {gsap} from "gsap"; import {useGSAP} from "@gsap/react"; import {CustomEase} from "gsap/CustomEase"; gsap.registerPlugin(useGSAP,CustomEase); export {gsap,useGSAP,CustomEase};`,
  core_useGSAP_ScrollTrigger: `import {gsap} from "gsap"; import {useGSAP} from "@gsap/react"; import {ScrollTrigger} from "gsap/ScrollTrigger"; gsap.registerPlugin(useGSAP,ScrollTrigger); export {gsap,useGSAP,ScrollTrigger};`,
  core_useGSAP_ScrollToPlugin: `import {gsap} from "gsap"; import {useGSAP} from "@gsap/react"; import {ScrollToPlugin} from "gsap/ScrollToPlugin"; gsap.registerPlugin(useGSAP,ScrollToPlugin); export {gsap,useGSAP,ScrollToPlugin};`,
  as_shipped_all_three: `import {gsap} from "gsap"; import {useGSAP} from "@gsap/react"; import {CustomEase} from "gsap/CustomEase"; import {ScrollToPlugin} from "gsap/ScrollToPlugin"; import {ScrollTrigger} from "gsap/ScrollTrigger"; gsap.registerPlugin(useGSAP,ScrollTrigger,ScrollToPlugin,CustomEase); export {gsap,useGSAP,CustomEase,ScrollToPlugin,ScrollTrigger};`,
};
const out = [];
const res = {};
for (const [name, contents] of Object.entries(variants)) {
  const r = await build({ stdin: { contents, resolveDir: process.cwd(), loader: "js" }, bundle: true, minify: true, format: "esm", write: false, external: ["react", "react-dom"], platform: "browser", target: "es2020" });
  const code = r.outputFiles[0].contents;
  res[name] = { raw: code.length, gz: gzipSync(code, { level: 6 }).length };
  out.push(`${name.padEnd(30)} raw ${kb(res[name].raw).padStart(6)} KB  gz ${kb(res[name].gz).padStart(5)} KB`);
}
const b = res.core_useGSAP.gz;
out.push("");
out.push(`plugins total (as shipped - core): ${kb(res.as_shipped_all_three.gz - b)} KB gz / ${kb(res.as_shipped_all_three.raw - res.core_useGSAP.raw)} KB raw`);
for (const k of ["core_useGSAP_ScrollTrigger", "core_useGSAP_CustomEase", "core_useGSAP_ScrollToPlugin"]) out.push(`  ${k.replace("core_useGSAP_", "").padEnd(16)} +${kb(res[k].gz - b)} KB gz`);
const chunk = readFileSync(".next/static/chunks/1tr6a7zmh41cy.js", "utf8");
out.push("");
out.push(`served 1tr6a7zmh41cy.js raw ${kb(chunk.length)} KB gz ${kb(gzipSync(chunk, { level: 6 }).length)} KB; contains: ScrollTrigger=${chunk.includes("ScrollTrigger")} scrollTo=${/"scrollTo"|scrollTo:/.test(chunk)} CustomEase=${chunk.includes("CustomEase")} refreshInit=${chunk.includes("refreshInit")} ignoreMobileResize=${chunk.includes("ignoreMobileResize")}`);
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-03-reproduce-esbuild.txt", out.join("\n") + "\n");
console.log(out.join("\n"));
