/**
 * X-ray look (DESIGN-SYSTEM §7.2, §7.5) — the web mirror of `3d/blender/config/xray.py`, the
 * values the posters were rendered with (D88: poster ↔ canvas parity). Change both files
 * together and re-render the posters; `tests/unit/xray-parity.test.ts` keeps them equal.
 */
export const XRAY = {
  body: {
    rimPower: 2.6,
    rimPowerMobile: 2.2,
    rimScale: 1.0,
    baseAlpha: 0.22,
    baseAlphaExploded: 0.1,
    tint: "#123642",
    rim: "#9FE9FF",
  },
  glass: { rimPower: 3.2, rimScale: 0.7, baseAlpha: 0.06, tint: "#9FE9FF", rim: "#9FE9FF" },
  /** Glossy environment share of the shell (Blender: transparent/glossy mix factor). */
  env: 0.35,
} as const;

/** Runtime-only values (not in the posters): edges, selection, hover. */
export const XRAY_RUNTIME = {
  /** Rim alpha at grazing angles (Blender map range upper bound). */
  rimAlpha: 0.92,
  /** Back faces render at half alpha (the far side of the car stays faint). */
  backFaceAlpha: 0.5,
  /** Shell base alpha while a category is selected (reveals the parts). */
  selectedBaseAlpha: 0.06,
  /** Edge lines (desktop only): EdgesGeometry threshold and opacity before/after stage 1. */
  edgeThresholdDeg: 28,
  edgeOpacity: 0.35,
  edgeOpacityExploded: 0.2,
  edgeColor: "#9FE9FF",
} as const;

/**
 * Part highlight (§7.5, tuned on the runtime — D100): an accent fresnel rim with a faint warm
 * lift. The DS starting values (rim 0.6 / 1.0, emissive 0.12 / 0.18, power 2) flooded the dark
 * metals in solid orange; a tighter rim keeps the material readable under the tint.
 */
export const HIGHLIGHT = {
  color: "#FF6B1A",
  rimPower: 3.2,
  hoverRim: 0.55,
  hoverEmissive: 0.025,
  selectedRim: 0.9,
  selectedEmissive: 0.045,
  /** Other parts while something is selected: 55 % brightness, 40 % desaturated. */
  dimBrightness: 0.55,
  dimDesaturate: 0.4,
} as const;

/** Lighting rig (§7.4) — mirrors `3d/blender/posters.py` `studio_rig()`. */
export const LIGHT_RIG = {
  environmentIntensity: 0.6,
  key: { color: "#FFF4E8", intensity: 1.6, azimuth: 35, elevation: 40 },
  rim: { color: "#CFEFFF", intensity: 1.2, azimuth: 200, elevation: 25 },
  hemisphere: { sky: "#1C2530", ground: "#0D0F11", intensity: 0.35 },
} as const;

/** Floor (§7.1): disc gradient, ruler lines, baked contact shadows. */
export const FLOOR = {
  radius: 3.2,
  centre: "#15191D",
  discOpacity: 0.55,
  line: "#9FE9FF",
  minorStep: 0.5,
  minorOpacity: 0.06,
  majorStep: 1.0,
  majorOpacity: 0.1,
  fadeFrom: 2.2,
  shadowAssembledSize: 5.2,
  shadowExplodedSize: 6.4,
} as const;
