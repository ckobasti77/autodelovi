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
import type { Timeline } from "@/lib/three/explode";

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
  /** Scroll (or, without scrubbing, jump) so the explode reaches `p`. */
  goToProgress: (p: number, opts?: { instant?: boolean }) => void;
  /** Explode just enough to show a category (its stage end) — no-op when already past it. */
  revealCategory: (slug: string, opts?: { instant?: boolean }) => void;
};

type HeroState = {
  tier: Tier | null;
  timeline: Timeline;
  reducedMotion: boolean;
  status: HeroStatus;
  /** Bytes loaded / expected (0 … 1) while status is „loading“. */
  loadProgress: number;
  /** Explode progress 0 … 1 (transient: subscribe, do not select). */
  progress: number;
  /** Stage shown by the index (0 … 7). */
  stage: number;
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
  /** Label anchor for the callout (transient, written by the canvas every frame). */
  anchor: HeroAnchor | null;
  /** Where a focused part should land (stage box px, centre + height of the free area). */
  freeArea: { x: number; y: number; h: number } | null;
  controller: HeroController | null;
};

export const useHeroStore = create<HeroState>(() => ({
  tier: null,
  timeline: "desktop",
  reducedMotion: false,
  status: "idle",
  loadProgress: 0,
  progress: 0,
  stage: 0,
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
