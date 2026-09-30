/**
 * Device tier for the hero (docs/3D-CONTRACT.md §F7.2):
 *
 * - high: ≥ 1024 px, WebGL2, ≥ 4 cores, `deviceMemory ≥ 4` when reported, no Save-Data →
 *   desktop GLB, DPR ≤ 2 (adaptive), full X-ray shader with edge lines, hover.
 * - mid: capable phones and tablets → lite GLB, DPR ≤ 1.5, simplified shader, tap only.
 * - low: no WebGL2, Save-Data, or `deviceMemory < 3` → no 3D; the posters crossfade along the
 *   same scroll track and the HTML panel/list work as usual.
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
};

export function classifyTier(input: TierInput): Tier {
  if (!input.webgl2) return "low";
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

type NavigatorWithHints = Navigator & {
  deviceMemory?: number;
  connection?: { saveData?: boolean };
};

let webgl2Cache: boolean | null = null;

/** Creates (and immediately releases) a WebGL2 context once per page. */
export function hasWebGL2(): boolean {
  if (webgl2Cache !== null) return webgl2Cache;
  if (typeof window === "undefined" || typeof WebGL2RenderingContext === "undefined") {
    webgl2Cache = false;
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    webgl2Cache = Boolean(gl);
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    webgl2Cache = false;
  }
  return webgl2Cache;
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
  return classifyTier({
    width: window.innerWidth,
    webgl2: hasWebGL2(),
    cores: nav.hardwareConcurrency || undefined,
    deviceMemory: nav.deviceMemory,
    saveData: nav.connection?.saveData === true,
  });
}
