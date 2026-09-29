"use client";

/**
 * Playwright hooks (contract F8): `window.__sklop3d` outside production builds, or in a
 * production build made with `NEXT_PUBLIC_TEST_HOOKS=1` (the e2e server). Never shipped to
 * real visitors.
 */
import { heroStore, selectCategory, type SelectSource } from "@/components/three/heroStore";
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
  explode: (progress: number) => void;
  getState: () => {
    ready: boolean;
    tier: string | null;
    status: string;
    progress: number;
    stage: number;
    selected: string | null;
    hovered: string | null;
    timeline: string;
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
    getState() {
      const s = heroStore.getState();
      return {
        ready: s.status === "ready",
        tier: s.tier,
        status: s.status,
        progress: s.progress,
        stage: s.stage,
        selected: s.selected,
        hovered: s.hovered,
        timeline: s.timeline,
        reducedMotion: s.reducedMotion,
      };
    },
  };
  window.__sklop3d = hooks;
  return () => {
    if (window.__sklop3d === hooks) delete window.__sklop3d;
  };
}
