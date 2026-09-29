import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";
import {
  CATEGORIES,
  STAGES,
  SUBCATEGORIES,
  SYSTEMS,
  allPartNodes,
  partNodeName,
} from "@/lib/catalog/taxonomy";
import { explodeFactor, parseCarManifest } from "@/lib/three/manifest";

const ROOT = resolve(__dirname, "../..");
const manifest = parseCarManifest(
  JSON.parse(readFileSync(resolve(ROOT, "public/models/car.manifest.json"), "utf8")),
);

describe("3D manifest ↔ taxonomy (contract F4)", () => {
  test("categories match the taxonomy 1:1 (slug, label, system, nodes, mesh flag)", () => {
    expect(manifest.categories.map((c) => c.slug)).toEqual(CATEGORIES.map((c) => c.slug));
    for (const c of CATEGORIES) {
      const m = manifest.categories.find((x) => x.slug === c.slug)!;
      expect(m.labelSr).toBe(c.labelSr);
      expect(m.system).toBe(c.system);
      expect(m.nodes).toEqual(c.instances.map((i) => partNodeName(c.slug, i.instance)));
      expect(m.hasMesh).toBe(c.instances.length > 0);
      expect(m.thumbnail).toBe(`/images/parts/${c.slug}.webp`);
    }
  });

  test("every clickable node is a part with its taxonomy label, stage and a unit explode direction", () => {
    const nodes = manifest.parts.map((p) => p.node);
    expect(new Set(nodes)).toEqual(new Set(allPartNodes()));
    expect(nodes).toHaveLength(allPartNodes().length);
    for (const c of CATEGORIES) {
      for (const i of c.instances) {
        const part = manifest.parts.find((p) => p.node === partNodeName(c.slug, i.instance))!;
        expect(part.labelSr).toBe(i.labelSr);
        expect(part.category).toBe(c.slug);
        expect(part.system).toBe(c.system);
        expect(part.explode.stage).toBe(i.stage ?? c.stage);
        expect(Math.hypot(...part.explode.dir)).toBeCloseTo(1, 3);
        expect(part.clickable).toBe(true);
      }
    }
  });

  test("systems and stage windows come from the taxonomy", () => {
    expect(manifest.systems.map((s) => s.slug)).toEqual(SYSTEMS.map((s) => s.slug));
    expect(manifest.stages).toEqual(
      STAGES.map((s) => ({ stage: s.stage, key: s.key, labelSr: s.labelSr, scroll: s.scroll })),
    );
  });

  test("both GLBs exist within the contract budgets", () => {
    const { desktop, lite } = manifest.models;
    expect(desktop.bytes).toBeLessThanOrEqual(8_000_000);
    expect(desktop.triangles).toBeLessThan(800_000);
    expect(desktop.drawCalls).toBeLessThanOrEqual(220);
    expect(lite.bytes).toBeLessThanOrEqual(3_000_000);
    expect(lite.triangles).toBeLessThanOrEqual(250_000);
    expect(lite.drawCalls).toBeLessThanOrEqual(150);
    for (const m of [desktop, lite])
      expect(existsSync(resolve(ROOT, "public", m.url.slice(1)))).toBe(true);
  });

  test("thumbnails exist for every category and filter subcategory", () => {
    for (const slug of [...CATEGORIES.map((c) => c.slug), ...SUBCATEGORIES.map((s) => s.slug)]) {
      expect(existsSync(resolve(ROOT, "public/images/parts", `${slug}.webp`)), slug).toBe(true);
    }
  });

  test("x-ray slots are flagged for the runtime shader", () => {
    const byName = Object.fromEntries(manifest.materials.map((m) => [m.name, m.override]));
    expect(byName.mat_body_xray).toBe("xray-body");
    expect(byName.mat_glass_xray).toBe("xray-glass");
    expect(manifest.materials.length).toBeLessThanOrEqual(24);
  });
});

describe("explode timing (PLAN §6.2)", () => {
  test("holds before the window, eases through it, completes after it", () => {
    expect(explodeFactor(0.0, [0.28, 0.46], 0)).toBe(0);
    expect(explodeFactor(0.46, [0.28, 0.46], 0)).toBe(1);
    expect(explodeFactor(0.37, [0.28, 0.46], 0)).toBeGreaterThan(0.5);
    expect(explodeFactor(1.0, [0.28, 0.46], 1)).toBe(1);
  });

  test("order staggers a part by up to 35 % of its window", () => {
    const early = explodeFactor(0.33, [0.28, 0.46], 0);
    const late = explodeFactor(0.33, [0.28, 0.46], 1);
    expect(late).toBe(0);
    expect(early).toBeGreaterThan(0);
  });
});
