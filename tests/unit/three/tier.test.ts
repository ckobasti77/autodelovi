import { afterEach, describe, expect, test, vi } from "vitest";

import { classifyTier, quickTier } from "@/lib/three/tier";

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
