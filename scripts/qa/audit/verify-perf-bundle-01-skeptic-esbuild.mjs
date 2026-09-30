// Verifier (skeptic) for perf-bundle-01: attribute zod bytes by source file with esbuild metafiles,
// for the real client schemas (checkout + inquiry + mechanicRegistration) imported the way the app does
// (`import { z } from "zod"`) vs a patched copy using `import * as z from "zod"`. Temp files live in
// os.tmpdir() and are removed afterwards. No app files are touched.
//   node scripts/qa/audit/verify-perf-bundle-01-skeptic-esbuild.mjs
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";

import * as esbuild from "esbuild";

const root = process.cwd();
const tmp = mkdtempSync(path.join(os.tmpdir(), "pb01-"));
const out = [];
const log = (s) => {
  out.push(s);
  console.log(s);
};

const schemas = ["checkout", "inquiry", "mechanicRegistration"];

async function bundle(label, entrySource, extra = {}) {
  const entry = path.join(tmp, `${label}.ts`);
  writeFileSync(entry, entrySource);
  const res = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    write: false,
    metafile: true,
    absWorkingDir: root,
    tsconfig: path.join(root, "tsconfig.json"),
    nodePaths: [path.join(root, "node_modules")],
    logLevel: "silent",
    ...extra,
  });
  const code = res.outputFiles[0].contents;
  const gz = zlib.gzipSync(code, { level: 9 }).length;
  const inputs = Object.values(res.metafile.outputs)[0].inputs;
  let locales = 0,
    jsonSchema = 0,
    zodTotal = 0,
    app = 0;
  for (const [file, info] of Object.entries(inputs)) {
    const f = file.replace(/\\/g, "/");
    if (f.includes("node_modules/zod/")) {
      zodTotal += info.bytesInOutput;
      if (f.includes("/locales/")) locales += info.bytesInOutput;
      if (/json-schema|from-json-schema|to-json-schema/.test(f)) jsonSchema += info.bytesInOutput;
    } else app += info.bytesInOutput;
  }
  const s = Buffer.from(code).toString("utf8");
  log(
    `${label.padEnd(34)} raw ${(code.length / 1024).toFixed(1).padStart(6)} KiB  gz ${(gz / 1024).toFixed(1).padStart(5)} KiB  | zod ${(zodTotal / 1024).toFixed(1)} KiB (locales ${(locales / 1024).toFixed(1)}, json-schema ${(jsonSchema / 1024).toFixed(1)}) app ${(app / 1024).toFixed(1)} KiB | "Nieprawid" x${s.split("Nieprawid").length - 1}`,
  );
}

// 1) Real schemas as they are in the repo (import { z } from "zod").
await bundle(
  "real-schemas-as-is",
  schemas.map((s, i) => `import * as m${i} from ${JSON.stringify(path.join(root, "lib/validation", s + ".ts").replace(/\\/g, "/"))}; console.log(m${i});`).join("\n"),
);

// 2) Same schemas, copied with the import rewritten to `import * as z from "zod"`.
mkdirSync(path.join(tmp, "ns"), { recursive: true });
for (const s of schemas) {
  const src = readFileSync(path.join(root, "lib/validation", s + ".ts"), "utf8").replace(
    'import { z } from "zod";',
    'import * as z from "zod";',
  );
  writeFileSync(path.join(tmp, "ns", s + ".ts"), src);
}
await bundle(
  "real-schemas-namespace-import",
  schemas.map((s, i) => `import * as m${i} from "./ns/${s}.ts"; console.log(m${i});`).join("\n"),
);

// 3) Same, plus react-hook-form + zodResolver (what the production chunk contains).
await bundle(
  "as-is + rhf + zodResolver",
  schemas.map((s, i) => `import * as m${i} from ${JSON.stringify(path.join(root, "lib/validation", s + ".ts").replace(/\\/g, "/"))}; console.log(m${i});`).join("\n") +
    `\nimport { useForm } from "react-hook-form"; import { zodResolver } from "@hookform/resolvers/zod"; console.log(useForm, zodResolver);`,
  { external: ["react", "react-dom"] },
);
await bundle(
  "namespace + rhf + zodResolver",
  schemas.map((s, i) => `import * as m${i} from "./ns/${s}.ts"; console.log(m${i});`).join("\n") +
    `\nimport { useForm } from "react-hook-form"; import { zodResolver } from "@hookform/resolvers/zod"; console.log(useForm, zodResolver);`,
  { external: ["react", "react-dom"] },
);

rmSync(tmp, { recursive: true, force: true });
mkdirSync("docs/qa/audit/verify/perf-bundle", { recursive: true });
writeFileSync(
  "docs/qa/audit/verify/perf-bundle/perf-bundle-01-skeptic-esbuild.txt",
  `esbuild ${esbuild.version}, --bundle --minify --format=esm --platform=browser; gzip level 9. ${new Date().toISOString()}\n` +
    out.join("\n") +
    "\n",
);
