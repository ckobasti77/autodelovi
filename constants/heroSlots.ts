/**
 * Hero v2 grid slots (docs/3d/HERO-V2.md §3, §6.4): what a slot shows and from where.
 *
 * A slot shows the same composition as the category's thumbnail — the same instances from the
 * same camera — so the docked mesh and the fallback image are one picture. This file is the web
 * mirror of `3d/blender/config/thumbs.py`; `tests/unit/three/slots-parity.test.ts` keeps the two
 * equal. Change both together and re-render the thumbnails.
 */

/** Default thumbnail camera: three-quarter front-left (degrees; azimuth from +Z toward +X). */
export const SLOT_VIEW_DEFAULT = { az: 35, el: 20 } as const;

export type SlotView = {
  /** Instances in the picture (node suffixes); default: the first in `SLOT_PREFERRED` order. */
  nodes?: readonly string[];
  /** Camera overrides (degrees). */
  az?: number;
  el?: number;
  /** The set is turned 180° about its vertical axis (working face points to the right). */
  yaw?: number;
  /** Instances side by side along the screen axis instead of as assembled. */
  row?: boolean;
};

export const SLOT_VIEWS: Readonly<Record<string, SlotView>> = {
  motor: { nodes: ["block", "head"] },
  interkuler: { nodes: ["main"] },
  "usisna-grana": { nodes: ["manifold"], el: 26, yaw: 180 },
  "brizgaljke-pumpa-goriva": { nodes: ["injectors"], el: 26 },
  "zupcasti-kais-vodena-pumpa": { nodes: ["belt", "water-pump"], yaw: 180 },
  "kais-alternatora": { nodes: ["belt"], yaw: 180 },
  alternator: { nodes: ["main"], yaw: 180 },
  "nosaci-motora": { nodes: ["r"], yaw: 180 },
  auspuh: { nodes: ["rear"], az: 150, el: 18 },
  "hladnjak-ventilator": { nodes: ["radiator", "fan"] },
  "termostat-creva": { nodes: ["thermostat"] },
  klima: { nodes: ["compressor", "condenser"], row: true },
  poluosovine: { nodes: ["r"] },
  "spone-stabilizatori": { nodes: ["tie-rod-l"], el: 24 },
  brisaci: { nodes: ["main"], az: 20, el: 38 },
  senzori: { nodes: ["lambda", "coolant-temp"], row: true },
  "stop-svetla": { nodes: ["l"], az: 150, el: 16 },
  stakla: { nodes: ["windshield"] },
  branici: { nodes: ["front"] },
  "felne-gume": { nodes: ["fl"], az: 60, el: 14 },
  "kocione-celjusti": { nodes: ["fl"], yaw: 180, el: 24 },
};

/** Which instance represents a category that has no entry above (thumbs.py `PREFERRED`). */
export const SLOT_PREFERRED: readonly string[] = [
  "fl",
  "l",
  "front",
  "main",
  "windshield",
  "block",
  "radiator",
  "belt",
  "compressor",
  "manifold",
  "injectors",
  "thermostat",
  "tie-rod-l",
  "lambda",
  "mid",
];

/** Geometry of the docked state (docs/3d/HERO-V2.md §4.2, §6.4, §6.5). */
export const SLOT = {
  /** Share of the mesh cell the composition's projected extents may take. */
  fit: 0.78,
  /** View depth of the slot plane in front of the camera (m): parts dock ahead of the car. */
  depth: 3.2,
  /** Lift leg along the part's explode direction is capped at this distance (m). */
  hop: 0.3,
  /** The same where the grid is under the car (phones, tablets): the lift goes up, the slot is down. */
  hopTouch: 0.15,
  /** The arc rises by this share of the path on screen, toward camera-up. */
  arc: 0.1,
  /** Where the grid is under the car the path is straight: a rise would start by leaving the frame. */
  arcTouch: 0,
  /** Share of the flight spent on the lift leg; the carry starts at `carryFrom`. */
  liftSpan: 0.35,
  carryFrom: 0.2,
  /** Instances outside the composition shrink behind it over the last share of the flight. */
  tuckFrom: 0.7,
  /** The float fades in over the last share of the flight. */
  settleFrom: 0.9,
  /** Idle float: bob (CSS px) and pendulum yaw (degrees), periods in seconds. */
  bobPx: 3,
  bobPxTouch: 2,
  yawDeg: 10,
  bobPeriod: [4.2, 6] as const,
  yawPeriod: [7, 11] as const,
  /** The float eases out after this many seconds without input, over `floatFade`. */
  floatIdle: 6,
  floatFade: 1,
  /** Lens while docked (vertical FOV, degrees): longer, so slots stay near the optical axis. */
  dockFov: { desktop: 24, tablet: 24, mobile: 22 } as const,
  /**
   * Share of its band the car's projected bounding box may take. The box's far corners fall
   * outside the portrait crops, so those may exceed 1.
   */
  bandFill: {
    desktop: { width: 0.94, height: 0.9 },
    tablet: { width: 1.08, height: 1 },
    mobile: { width: 1.3, height: 1.24 },
  } as const,
  /**
   * Room the car leaves free at the top and the bottom of its band (shares of the band's
   * height). On phones the band starts under the header, so the roof — and a panel lifting off
   * it — needs headroom there; the car's outline sits above the centre of its bounding box,
   * hence the uneven pair.
   */
  bandInset: {
    desktop: { top: 0, bottom: 0 },
    tablet: { top: 0.04, bottom: 0 },
    mobile: { top: 0.07, bottom: 0 },
  } as const,
} as const;
