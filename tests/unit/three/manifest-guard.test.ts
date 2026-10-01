import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import { parseCarManifest } from "@/lib/three/manifest";
import { readCarManifest } from "@/lib/three/manifestGuard";

const json = JSON.parse(
  readFileSync(resolve(__dirname, "../../../public/models/car.manifest.json"), "utf8"),
) as Record<string, unknown>;

describe("runtime manifest guard (no zod in the 3D chunk)", () => {
  test("accepts the generated manifest exactly like the zod schema", () => {
    expect(readCarManifest(json)).toBe(json);
    expect(() => parseCarManifest(json)).not.toThrow();
  });

  test("rejects what the runtime cannot use", () => {
    const clone = () => JSON.parse(JSON.stringify(json)) as Record<string, unknown>;
    const noVersion = clone();
    noVersion.schemaVersion = 2;
    expect(() => readCarManifest(noVersion)).toThrow(/schemaVersion/);
    const badPart = clone();
    (badPart.parts as Array<Record<string, unknown>>)[0].pivot = [0, 1];
    expect(() => readCarManifest(badPart)).toThrow(/pivot/);
    const badStage = clone();
    ((badStage.parts as Array<Record<string, unknown>>)[1].explode as Record<string, unknown>).stage = 9;
    expect(() => readCarManifest(badStage)).toThrow(/explode/);
    const noCams = clone();
    delete noCams.cameras;
    expect(() => readCarManifest(noCams)).toThrow(/cameras/);
    const noTablet = clone();
    delete ((noTablet.cameras as Record<string, Record<string, unknown>>).exploded).tablet;
    expect(() => readCarManifest(noTablet)).toThrow(/camera shape/);
    expect(() => parseCarManifest(noTablet)).toThrow();
  });

  test("every crop has a hero and an exploded camera", () => {
    const cams = json.cameras as Record<string, Record<string, unknown>>;
    for (const state of ["hero", "exploded"]) {
      expect(Object.keys(cams[state]).sort()).toEqual(["desktop", "mobile", "tablet"]);
    }
  });
});
