/**
 * Device tier for the hero (docs/3D-CONTRACT.md §F7.2):
 *
 * - high: ≥ 1024 px, WebGL2, ≥ 4 cores, `deviceMemory ≥ 4` when reported, no Save-Data →
 *   desktop GLB, DPR ≤ 2 (adaptive), full X-ray shader with edge lines, hover.
 * - mid: capable phones and tablets → lite GLB, DPR ≤ 1.5, simplified shader, tap only.
 * - low: no WebGL2, a software WebGL renderer (SwiftShader, llvmpipe, softpipe, Microsoft Basic
 *   Render — VMs, RDP, blocklisted GPUs; PERF-23), Save-Data, or `deviceMemory < 3` → no 3D; the
 *   posters crossfade along the same scroll track and the HTML panel/list work as usual.
 *   QA and e2e on SwiftShader force a tier with `?3d=high|mid` (components/three/testHooks.ts).
 */

export type Tier = "high" | "mid" | "low";

export type TierInput = {
  /** CSS px viewport width. */
  width: number;
  webgl2: boolean;
  /** `navigator.hardwareConcurrency` (undefined when not reported). */
  cores?: number;
  /** `navigator.deviceMemory` in GB (Chromium only; undefined elsewhere). */
  deviceMemory?: number;
  /** `navigator.connection.saveData`. */
  saveData?: boolean;
  /** The WebGL renderer is a CPU rasteriser (see `isSoftwareRenderer`). */
  softwareRenderer?: boolean;
};

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|basic render|software (adapter|rasterizer)/i;

/** True for WebGL renderer strings of CPU rasterisers, which cannot hold the hero's frame rate. */
export function isSoftwareRenderer(renderer: string): boolean {
  return SOFTWARE_RENDERER.test(renderer);
}

export function classifyTier(input: TierInput): Tier {
  if (!input.webgl2) return "low";
  if (input.softwareRenderer) return "low";
  if (input.saveData) return "low";
  if (input.deviceMemory !== undefined && input.deviceMemory < 3) return "low";
  const memoryOk = input.deviceMemory === undefined || input.deviceMemory >= 4;
  const coresOk = (input.cores ?? 4) >= 4;
  if (input.width >= 1024 && memoryOk && coresOk) return "high";
  return "mid";
}

/** Maximum device pixel ratio per tier (the canvas clamps `[1, max]`). */
export const TIER_MAX_DPR: Readonly<Record<Exclude<Tier, "low">, number>> = {
  high: 2,
  mid: 1.5,
};

/**
 * 4× MSAA only below DPR 1.5 (PERF-16, D244): on HiDPI screens the pixel ratio already
 * supersamples the edges, and a multisampled 2880 × 1672 drawing buffer alone would take about
 * 170 MB against the 60 MB GPU budget (contract F5). The mid tier never multisamples.
 */
export function msaaFor(tier: Exclude<Tier, "low">, devicePixelRatio: number): boolean {
  return tier === "high" && devicePixelRatio < 1.5;
}

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

type WebGLProbe = { webgl2: boolean; renderer: string };
let probeCache: WebGLProbe | null = null;

/** Creates (and immediately releases) a WebGL2 context once per page; reads its renderer. */
function probeWebGL2(): WebGLProbe {
  if (probeCache) return probeCache;
  if (typeof window === "undefined" || typeof WebGL2RenderingContext === "undefined") {
    probeCache = { webgl2: false, renderer: "" };
    return probeCache;
  }
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    let renderer = "";
    if (gl) {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
    }
    probeCache = { webgl2: Boolean(gl), renderer };
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    probeCache = { webgl2: false, renderer: "" };
  }
  return probeCache;
}

export function hasWebGL2(): boolean {
  return probeWebGL2().webgl2;
}

/**
 * The tier as far as it is known without the WebGL2 probe: `"low"` when a cheap signal already
 * decides it, otherwise `null` (the probe runs when the 3D actually starts, not during hydration).
 */
export function quickTier(): Tier | null {
  if (typeof window === "undefined") return null;
  if (typeof WebGL2RenderingContext === "undefined") return "low";
  const nav = navigator as NavigatorWithHints;
  if (nav.connection?.saveData === true) return "low";
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 3) return "low";
  return null;
}

/** Reads the browser signals (client only). Creates a throwaway WebGL2 context once. */
export function detectTier(): Tier {
  if (typeof window === "undefined") return "low";
  const nav = navigator as NavigatorWithHints;
  const probe = probeWebGL2();
  return classifyTier({
    width: window.innerWidth,
    webgl2: probe.webgl2,
    softwareRenderer: isSoftwareRenderer(probe.renderer),
    cores: nav.hardwareConcurrency || undefined,
    deviceMemory: nav.deviceMemory,
    saveData: nav.connection?.saveData === true,
  });
}
