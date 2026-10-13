"use client";

/**
 * Shared state of the 3D hero: the orchestrator (scroll, poster, stage UI), the lazily loaded
 * canvas, the part panel and the parts list all read and write this one store.
 *
 * `progress` changes on every scroll frame — React components never subscribe to it; the stage
 * UI and the canvas use `useHeroStore.subscribe` (transient updates) and write DOM / GPU state
 * directly. Everything else changes rarely and may be selected in components.
 */
import { create } from "zustand";

import type { Tier } from "@/lib/three/tier";
import type { Rect } from "@/lib/three/slots";

/**
 * idle → loading (chunk + model) → ready (first frame drawn) · lost (WebGL context lost, the
 * posters take over; one restore attempt) · failed (no 3D for this page view).
 */
export type HeroStatus = "idle" | "loading" | "ready" | "lost" | "failed";

/** Screen position of the hovered/selected category's label anchor (stage box px). */
export type HeroAnchor = { slug: string; x: number; y: number; visible: boolean };

/** Where a selection came from — decides explode/scroll behaviour and focus return. */
export type SelectSource = "canvas" | "list" | "deeplink" | "hook" | "stage";

export type HeroController = {
  /** Scroll (or, without scrubbing, jump) so the progress reaches `p`. */
  goToProgress: (p: number, opts?: { instant?: boolean }) => void;
  /** Open the car up to a category's layer: its page's parts are still on the car. */
  revealCategory: (slug: string, opts?: { instant?: boolean }) => void;
  /** Show a page with every part docked (chips, a focused slot link). */
  goToPage: (page: number, opts?: { instant?: boolean }) => void;
};

/** What a grid slot shows: the docked mesh (the canvas draws it) or the category's image. */
export type SlotMode = "mesh" | "image";

export type SlotRect = { slug: string; rect: Rect };

/**
 * One docked slot as the scene sees it (QA hook, canvas px): projected size, distance from the
 * cell it was given, the drawn centre (`cx`, `cy`) and the resting centre without the float
 * (`rx`, `ry`).
 */
export type SlotProbe = {
  slug: string;
  w: number;
  h: number;
  dx: number;
  dy: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  angle: number;
};

/** A box on the canvas (CSS px). */
export type ScreenBox = { left: number; top: number; right: number; bottom: number };
/**
 * Outline of what is on the car and of what is flying to a slot, and the car's assembled
 * bounding box as the camera frames it (QA hook).
 */
export type OutlineProbe = { car: ScreenBox | null; flight: ScreenBox | null; box: ScreenBox };

type HeroState = {
  tier: Tier | null;
  reducedMotion: boolean;
  status: HeroStatus;
  /** Bytes loaded / expected (0 … 1) while status is „loading“. */
  loadProgress: number;
  /** Scroll progress 0 … 1 (transient: subscribe, do not select). */
  progress: number;
  /** Page of the grid (0 = the assembled car, 1 … 6). */
  page: number;
  /** The end state: every part taken off. */
  ended: boolean;
  slotMode: SlotMode;
  /** Cells of the page in the grid (canvas px), read on resize only. */
  slotRects: readonly SlotRect[];
  /** Where the docked car sits (canvas px). */
  band: Rect | null;
  /** Centre of each page's navigator cluster (canvas px; index = page). */
  chipPoints: readonly ({ x: number; y: number } | null)[];
  /** Slot under the pointer or the keyboard focus: its origin lights up on the car. */
  focusedSlot: string | null;
  /** Origin of the focused slot on the car (canvas px; transient, written by the canvas). */
  origin: HeroAnchor | null;
  /** Docked slots as the scene sees them (QA hook; null without a canvas). */
  probe: (() => SlotProbe[]) | null;
  /** Outline of the car as the scene draws it (QA hook; null without a canvas). */
  probeOutline: (() => OutlineProbe) | null;
  hovered: string | null;
  selected: string | null;
  selectSource: SelectSource | null;
  /** Last selected category and its source — kept while the panel animates out. */
  panelSlug: string | null;
  panelSource: SelectSource | null;
  /** The hero stage intersects the viewport (the canvas stops rendering otherwise). */
  inView: boolean;
  /** Pointer can hover (fine pointer) — hover callouts only then. */
  finePointer: boolean;
  /** Label anchor for the callout (canvas px; transient, written by the canvas every frame). */
  anchor: HeroAnchor | null;
  /** Where a focused part should land (stage box px, centre + height of the free area). */
  freeArea: { x: number; y: number; h: number } | null;
  controller: HeroController | null;
};

export const useHeroStore = create<HeroState>(() => ({
  tier: null,
  reducedMotion: false,
  status: "idle",
  loadProgress: 0,
  progress: 0,
  page: 0,
  ended: false,
  slotMode: "image",
  slotRects: [],
  band: null,
  chipPoints: [],
  focusedSlot: null,
  origin: null,
  probe: null,
  probeOutline: null,
  hovered: null,
  selected: null,
  selectSource: null,
  panelSlug: null,
  panelSource: null,
  inView: true,
  finePointer: true,
  anchor: null,
  freeArea: null,
  controller: null,
}));

export const heroStore = useHeroStore;

/** Select a category (all its nodes) and open the part panel. */
export function selectCategory(slug: string, source: SelectSource): void {
  const { controller, selected } = heroStore.getState();
  if (source !== "canvas") {
    controller?.revealCategory(slug, { instant: source === "deeplink" || source === "hook" });
  }
  if (selected === slug && heroStore.getState().selectSource === source) return;
  heroStore.setState({
    selected: slug,
    selectSource: source,
    panelSlug: slug,
    panelSource: source,
    hovered: null,
  });
}

/** Close the panel; the camera glides back to the scroll camera. */
export function clearSelection(): void {
  heroStore.setState({ selected: null, selectSource: null });
}

export function setHovered(slug: string | null): void {
  if (heroStore.getState().hovered !== slug) heroStore.setState({ hovered: slug });
}

/** A grid slot under the pointer or the keyboard focus (null when it leaves). */
export function setFocusedSlot(slug: string | null): void {
  if (heroStore.getState().focusedSlot !== slug) heroStore.setState({ focusedSlot: slug });
}
