// Writes 3d/build/taxonomy.json from lib/catalog/taxonomy.ts (the single source of slugs,
// labels, systems, instances and stages) so the Blender scripts can read it.
// Node >= 22.18 strips TypeScript types natively.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tax = await import("../../lib/catalog/taxonomy.ts");

const out = {
  systems: tax.SYSTEMS,
  categories: tax.CATEGORIES,
  subcategories: tax.SUBCATEGORIES,
  stages: tax.STAGES,
  partNodes: tax.allPartNodes(),
};
const file = resolve(root, "3d/build/taxonomy.json");
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out, null, 2) + "\n", "utf8");
console.log(`taxonomy.json: ${out.categories.length} categories, ${out.partNodes.length} nodes`);
