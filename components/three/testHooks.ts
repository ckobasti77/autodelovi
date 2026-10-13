"use client";

/**
 * Playwright hooks (contract F8): `window.__sklop3d` outside production builds, or in a
 * production build made with `NEXT_PUBLIC_TEST_HOOKS=1` (the e2e server). Never shipped to
 * real visitors.
 */
import {
  heroStore,
  selectCategory,
  type OutlineProbe,
  type SelectSource,
  type SlotProbe,
} from "@/components/three/heroStore";
import { foundCount, pageRest } from "@/lib/three/pages";
import { isPanelSlug } from "@/lib/three/stages";
import type { Tier } from "@/lib/three/tier";

export const TEST_HOOKS_ENABLED =
  process.env.NEXT_PUBLIC_TEST_HOOKS === "1" || process.env.NODE_ENV !== "production";

/** QA only: `?3d=low|mid|high` forces a tier (ignored in real production builds). */
export function tierOverride(): Tier | null {
  if (!TEST_HOOKS_ENABLED || typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search).get("3d");
  return value === "low" || value === "mid" || value === "high" ? value : null;
}

export type Sklop3dHooks = {
  readonly ready: boolean;
  readonly tier: string | null;
  selectPart: (slug: string) => boolean;
  /** Jump the scroll progress (0 … 1). */
  explode: (progress: number) => void;
  /** Jump to a page of the grid with every part docked (1 … 6). */
  page: (page: number) => void;
  /** Docked slots as the scene draws them: projected size and distance from the cell. */
  slots: () => SlotProbe[];
  /** Outline (canvas px) of what is on the car and of what is in flight; null without a canvas. */
  car: () => OutlineProbe | null;
  getState: () => {
    ready: boolean;
    tier: string | null;
    status: string;
    progress: number;
    page: number;
    ended: boolean;
    found: number;
    slotMode: string;
    selected: string | null;
    hovered: string | null;
    focusedSlot: string | null;
    reducedMotion: boolean;
  };
};

declare global {
  interface Window {
    __sklop3d?: Sklop3dHooks;
  }
}

export function installTestHooks(): (() => void) | undefined {
  if (!TEST_HOOKS_ENABLED || typeof window === "undefined") return undefined;
  const hooks: Sklop3dHooks = {
    get ready() {
      return heroStore.getState().status === "ready";
    },
    get tier() {
      return heroStore.getState().tier;
    },
    selectPart(slug: string) {
      if (!isPanelSlug(slug)) return false;
      selectCategory(slug, "hook" satisfies SelectSource);
      return true;
    },
    explode(progress: number) {
      heroStore.getState().controller?.goToProgress(progress, { instant: true });
    },
    page(page: number) {
      heroStore.getState().controller?.goToProgress(pageRest(page), { instant: true });
    },
    slots() {
      return heroStore.getState().probe?.() ?? [];
    },
    car() {
      return heroStore.getState().probeOutline?.() ?? null;
    },
    getState() {
      const s = heroStore.getState();
      return {
        ready: s.status === "ready",
        tier: s.tier,
        status: s.status,
        progress: s.progress,
        page: s.page,
        ended: s.ended,
        found: foundCount(s.progress),
        slotMode: s.slotMode,
        selected: s.selected,
        hovered: s.hovered,
        focusedSlot: s.focusedSlot,
        reducedMotion: s.reducedMotion,
      };
    },
  };
  window.__sklop3d = hooks;
  return () => {
    if (window.__sklop3d === hooks) delete window.__sklop3d;
  };
}
