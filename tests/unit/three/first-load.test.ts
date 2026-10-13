/**
 * three.js stays out of the first-load JS (docs/3d/HERO-V2.md §13.1, D380). The stage, the grid,
 * the navigator and the overlays are ordinary client components; only `components/three/canvas/`
 * is loaded lazily, after intent. One value import of a module that imports three — a helper
 * from `lib/three/slots.ts`, say — puts the whole library in the first chunk: +100 KB and twice
 * the blocking time on a phone, with nothing failing but the Lighthouse gate.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

const root = resolve(__dirname, "../../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

/** Module specifiers a file imports for their values (type-only imports are erased). */
function valueImports(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/import\s+(type\s+)?([^;]*?)\s+from\s+"([^"]+)"/g)) {
    const [, typeOnly, clause, specifier] = match;
    if (typeOnly) continue;
    const named = clause.match(/\{([^}]*)\}/);
    const onlyTypes =
      named !== null &&
      clause.trim().startsWith("{") &&
      named[1]
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean)
        .every((name) => name.startsWith("type "));
    if (!onlyTypes) out.push(specifier);
  }
  return out;
}

const importsThree = (source: string) => valueImports(source).some((s) => s === "three" || s.startsWith("three/"));

describe("first-load JS of the hero", () => {
  const threeModules = readdirSync(resolve(root, "lib/three"))
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => importsThree(read(`lib/three/${file}`)))
    .map((file) => `@/lib/three/${file.replace(/\.ts$/, "")}`);

  test("the slot maths and the camera are the modules with three.js in them", () => {
    expect(threeModules.sort()).toEqual(["@/lib/three/camera", "@/lib/three/slots"]);
  });

  const eager = readdirSync(resolve(root, "components/three")).filter((file) => /\.tsx?$/.test(file));

  test.each(eager)("components/three/%s imports no three.js", (file) => {
    const imports = valueImports(read(`components/three/${file}`));
    expect(imports.filter((s) => s === "three" || s.startsWith("three/") || s.startsWith("@react-three/"))).toEqual([]);
    expect(imports.filter((s) => threeModules.includes(s))).toEqual([]);
    // the canvas is reached through `next/dynamic` only
    expect(imports.filter((s) => s.startsWith("@/components/three/canvas/"))).toEqual([]);
  });

  test("the modules they share with the canvas import none either", () => {
    for (const name of ["framing", "pages", "explode", "stages", "tier", "assets", "contain", "floatGovernor"]) {
      const imports = valueImports(read(`lib/three/${name}.ts`));
      expect(imports.filter((s) => s === "three" || threeModules.includes(s)), name).toEqual([]);
    }
  });
});
