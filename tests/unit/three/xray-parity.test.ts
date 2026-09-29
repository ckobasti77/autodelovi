import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import { XRAY } from "@/constants/xray";

/**
 * The posters were rendered with `3d/blender/config/xray.py`; the canvas uses constants/xray.ts.
 * If one changes without the other, the poster → canvas crossfade shows a jump (D88).
 */
const py = readFileSync(resolve(__dirname, "../../../3d/blender/config/xray.py"), "utf8");

function pyNumber(block: string, key: string): number {
  const section = py.slice(py.indexOf(`"${block}"`));
  const match = section.match(new RegExp(`"${key}":\\s*([0-9.]+)`));
  if (!match) throw new Error(`${block}.${key} missing in xray.py`);
  return Number(match[1]);
}

function pyString(block: string, key: string): string {
  const section = py.slice(py.indexOf(`"${block}"`));
  const match = section.match(new RegExp(`"${key}":\\s*"([^"]+)"`));
  if (!match) throw new Error(`${block}.${key} missing in xray.py`);
  return match[1];
}

describe("X-ray values match the poster renders", () => {
  test("body", () => {
    expect(XRAY.body.rimPower).toBe(pyNumber("body", "rim_power"));
    expect(XRAY.body.rimPowerMobile).toBe(pyNumber("body", "rim_power_mobile"));
    expect(XRAY.body.rimScale).toBe(pyNumber("body", "rim_scale"));
    expect(XRAY.body.baseAlpha).toBe(pyNumber("body", "base_alpha"));
    expect(XRAY.body.baseAlphaExploded).toBe(pyNumber("body", "base_alpha_exploded"));
    expect(XRAY.body.tint.toLowerCase()).toBe(pyString("body", "tint").toLowerCase());
    expect(XRAY.body.rim.toLowerCase()).toBe(pyString("body", "rim").toLowerCase());
  });

  test("glass and environment", () => {
    expect(XRAY.glass.rimPower).toBe(pyNumber("glass", "rim_power"));
    expect(XRAY.glass.rimScale).toBe(pyNumber("glass", "rim_scale"));
    expect(XRAY.glass.baseAlpha).toBe(pyNumber("glass", "base_alpha"));
    expect(XRAY.glass.tint.toLowerCase()).toBe(pyString("glass", "tint").toLowerCase());
    expect(XRAY.env).toBe(Number(py.match(/"env":\s*([0-9.]+)/)![1]));
  });
});
