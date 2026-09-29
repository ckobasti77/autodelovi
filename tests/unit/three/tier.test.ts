import { describe, expect, test } from "vitest";

import { classifyTier } from "@/lib/three/tier";

describe("device tier (contract F7.2)", () => {
  test("desktop with WebGL2 and enough cores/memory is high", () => {
    expect(classifyTier({ width: 1440, webgl2: true, cores: 8, deviceMemory: 8 })).toBe("high");
    // Safari/Firefox do not report deviceMemory
    expect(classifyTier({ width: 1280, webgl2: true, cores: 8 })).toBe("high");
  });

  test("phones and weak desktops are mid", () => {
    expect(classifyTier({ width: 390, webgl2: true, cores: 8, deviceMemory: 4 })).toBe("mid");
    expect(classifyTier({ width: 1440, webgl2: true, cores: 2, deviceMemory: 8 })).toBe("mid");
    expect(classifyTier({ width: 1440, webgl2: true, cores: 8, deviceMemory: 3 })).toBe("mid");
  });

  test("no WebGL2, Save-Data or very little memory is low", () => {
    expect(classifyTier({ width: 1440, webgl2: false, cores: 8 })).toBe("low");
    expect(classifyTier({ width: 390, webgl2: true, cores: 8, saveData: true })).toBe("low");
    expect(classifyTier({ width: 390, webgl2: true, cores: 4, deviceMemory: 2 })).toBe("low");
  });
});
