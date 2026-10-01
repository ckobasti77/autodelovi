import { afterEach, describe, expect, test, vi } from "vitest";

import { classifyTier, isSoftwareRenderer, msaaFor, quickTier } from "@/lib/three/tier";

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

  test("software WebGL renderers are low (PERF-23)", () => {
    for (const renderer of [
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)",
      "llvmpipe (LLVM 15.0.7, 256 bits)",
      "softpipe",
      "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0, D3D11)",
    ]) {
      expect(isSoftwareRenderer(renderer)).toBe(true);
    }
    for (const renderer of [
      "ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU (0x000028E0) Direct3D11 vs_5_0 ps_5_0, D3D11)",
      "Apple GPU",
      "Adreno (TM) 740",
      "Mali-G78",
      "",
    ]) {
      expect(isSoftwareRenderer(renderer)).toBe(false);
    }
    expect(
      classifyTier({ width: 1440, webgl2: true, cores: 8, deviceMemory: 8, softwareRenderer: true }),
    ).toBe("low");
  });

  test("MSAA only on the high tier below DPR 1.5 (PERF-16)", () => {
    expect(msaaFor("high", 1)).toBe(true);
    expect(msaaFor("high", 1.25)).toBe(true);
    expect(msaaFor("high", 1.5)).toBe(false);
    expect(msaaFor("high", 2)).toBe(false);
    expect(msaaFor("mid", 1)).toBe(false);
  });
});

describe("quick tier (no WebGL probe during hydration)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const browser = (nav: Record<string, unknown>, webgl2 = true) => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", nav);
    vi.stubGlobal("WebGL2RenderingContext", webgl2 ? function WebGL2RenderingContext() {} : undefined);
  };

  test("on the server it decides nothing", () => {
    vi.stubGlobal("window", undefined);
    expect(quickTier()).toBeNull();
  });

  test("cheap signals that already mean low", () => {
    browser({}, false);
    expect(quickTier()).toBe("low");
    browser({ connection: { saveData: true } });
    expect(quickTier()).toBe("low");
    browser({ deviceMemory: 2 });
    expect(quickTier()).toBe("low");
  });

  test("everything else waits for the probe at start", () => {
    browser({ deviceMemory: 8, hardwareConcurrency: 8 });
    expect(quickTier()).toBeNull();
    browser({});
    expect(quickTier()).toBeNull();
  });
});
