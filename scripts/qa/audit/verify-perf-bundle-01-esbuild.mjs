// verify track (perf-bundle-01): how much of the form chunk is zod classic's non-tree-shaken namespace?
// Bundles the real client schemas (+ react-hook-form + zodResolver) with esbuild in memory (write: false),
// once as-is (`import { z } from "zod"`) and once with the import rewritten to `import * as z from "zod"`.
// Also the production chunk for reference. Nothing is written except the report.
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = process.cwd();
const kb = (n) => (n / 1024).toFixed(1);
const size = (buf) => ({ raw: buf.length, gz: gzipSync(buf, { level: 9 }).length });

function rewritePlugin(mode) {
  return {
    name: "rewrite-zod-import",
    setup(b) {
      b.onLoad({ filter: /lib[\\/]validation[\\/](checkout|inquiry|mechanicRegistration)\.ts$/ }, (args) => {
        let src = readFileSync(args.path, "utf8");
        if (mode === "namespace") src = src.replace('import { z } from "zod";', 'import * as z from "zod";');
        return { contents: src, loader: "ts" };
      });
    },
  };
}

async function bundle(label, contents, mode, external = []) {
  const r = await build({
    stdin: { contents, resolveDir: root, loader: "ts", sourcefile: "entry.ts" },
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    write: false,
    tsconfig: path.join(root, "tsconfig.json"),
    external: ["react", "react-dom", ...external],
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [rewritePlugin(mode)],
    logLevel: "silent",
  });
  const buf = Buffer.from(r.outputFiles[0].contents);
  const s = size(buf);
  const txt = buf.toString("utf8");
  const pl = (txt.match(/Nieprawid/g) || []).length;
  const js = (txt.match(/toJSONSchema/g) || []).length;
  return `${label.padEnd(64)} ${kb(s.raw).padStart(7)} KiB raw ${kb(s.gz).padStart(6)} KiB gz   Nieprawid x${pl} toJSONSchema x${js}`;
}

const schemas = `
import { checkoutSchema } from "@/lib/validation/checkout";
import { inquirySchema } from "@/lib/validation/inquiry";
import * as mr from "@/lib/validation/mechanicRegistration";
export { checkoutSchema, inquirySchema, mr };
`;
const withForm = schemas + `
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
export { useForm, zodResolver };
`;
const rhfOnly = `
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
export { useForm, zodResolver };
`;

const lines = [];
lines.push("verify perf-bundle-01 - esbuild (write:false, minify, esm, browser, react external), gzip level 9, 2026-09-30");
try {
  lines.push(await bundle("3 real schemas, as-is (import { z } from \"zod\")", schemas, "asis"));
  lines.push(await bundle("3 real schemas, rewritten (import * as z from \"zod\")", schemas, "namespace"));
  lines.push(await bundle("3 schemas + RHF + zodResolver, as-is", withForm, "asis"));
  lines.push(await bundle("3 schemas + RHF + zodResolver, namespace import", withForm, "namespace"));
  lines.push(await bundle("RHF + zodResolver only (zod/v4/core pulled by resolver)", rhfOnly, "asis"));
  lines.push(await bundle("3 schemas, zod external (own code only)", schemas, "asis", ["zod"]));
} catch (e) {
  lines.push("ERROR " + String(e).slice(0, 2000));
}
const prod = readFileSync(".next/static/chunks/1uyyf-z7kpx1w.js");
const ps = size(prod);
lines.push(`production chunk 1uyyf-z7kpx1w.js                                 ${kb(ps.raw)} KiB raw (${ps.raw} B) ${kb(ps.gz)} KiB gz (${ps.gz} B)`);
const out = lines.join("\n");
console.log(out);
writeFileSync("docs/qa/audit/verify/perf-bundle/perf-bundle-01-reproduce-esbuild.txt", out + "\n");
