import { describe, expect, test } from "vitest";
import { CATEGORIES, allPartNodes } from "@/lib/catalog/taxonomy";

describe("taxonomy node labels (3D extras labelSr)", () => {
  test("every clickable instance has a non-empty, unique Serbian label", () => {
    const labels = CATEGORIES.flatMap((c) => c.instances.map((i) => i.labelSr));
    expect(labels).toHaveLength(allPartNodes().length);
    for (const c of CATEGORIES) {
      for (const i of c.instances) {
        expect(i.labelSr.trim().length, `${c.slug}__${i.instance}`).toBeGreaterThan(2);
      }
    }
    expect(new Set(labels).size).toBe(labels.length);
  });
});
