"use client";

/**
 * Two small overlays of the hero grid (docs/3d/HERO-V2.md §8, §9):
 *
 * - `HeroLeader`: a 1 px leader from the focused slot to its part's place on the car, with a
 *   dot at the origin. The scene reports the origin every frame; this writes two transforms
 *   and reads no layout.
 * - `HeroEnd`: the end state — „Ceo auto rastavljen“ with the next steps.
 */
import { useEffect, useRef } from "react";
import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react/dist/ssr";

import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { openVehiclePicker } from "@/lib/vehicle/picker";
import { HERO_COPY } from "@/lib/i18n/sr/hero";
import { DUR, EASE } from "@/constants/motion";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { RouteLink } from "@/components/ui/RouteLink";
import { clearSelection, heroStore, useHeroStore } from "@/components/three/heroStore";

export function HeroLeader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const place = () => {
      const root = rootRef.current;
      const line = lineRef.current;
      const dot = dotRef.current;
      if (!root || !line || !dot) return;
      const { focusedSlot, origin, slotRects, selected } = heroStore.getState();
      const cell = focusedSlot ? slotRects.find((r) => r.slug === focusedSlot)?.rect : undefined;
      if (!cell || !origin || origin.slug !== focusedSlot || !origin.visible || selected) {
        root.style.visibility = "hidden";
        return;
      }
      const cx = cell.x + cell.w / 2;
      const cy = cell.y + cell.h / 2;
      const dx = origin.x - cx;
      const dy = origin.y - cy;
      const length = Math.hypot(dx, dy);
      // The line starts at the edge of the cell, not inside the part.
      const start = Math.min(cell.w * 0.52, length);
      const angle = Math.atan2(dy, dx);
      line.style.transform = `translate3d(${cx + Math.cos(angle) * start}px, ${cy + Math.sin(angle) * start}px, 0) rotate(${angle}rad) scaleX(${Math.max(length - start, 0)})`;
      dot.style.transform = `translate3d(${origin.x - 4}px, ${origin.y - 4}px, 0)`;
      root.style.visibility = "visible";
    };
    place();
    return heroStore.subscribe((state, prev) => {
      if (
        state.origin !== prev.origin ||
        state.focusedSlot !== prev.focusedSlot ||
        state.slotRects !== prev.slotRects ||
        state.selected !== prev.selected
      ) {
        place();
      }
    });
  }, []);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-reveal="off"
      data-hero-leader=""
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
      style={{ visibility: "hidden" }}
    >
      <span ref={lineRef} className="absolute left-0 top-0 block h-px w-px origin-left bg-accent" />
      <span
        ref={dotRef}
        className="absolute left-0 top-0 block size-2 rounded-full border-2 border-bg bg-accent"
      />
    </div>
  );
}

export function HeroEnd({ className }: { className?: string }) {
  const ended = useHeroStore((s) => s.ended);
  const blocked = useHeroStore((s) => s.selected !== null);
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || !ended || prefersReducedMotion()) return;
      gsap.fromTo(
        root,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: DUR.panel, ease: EASE.out },
      );
    },
    { dependencies: [ended], scope: rootRef },
  );

  if (!ended || blocked) return null;
  const assemble = () => {
    clearSelection();
    heroStore.getState().controller?.goToProgress(0);
  };
  return (
    <div
      ref={rootRef}
      data-reveal="off"
      data-testid={TEST_IDS.heroEnd}
      className={cn(
        // The empty shell stays behind the copy as a faint drawing: the field under the text is
        // the page colour, fading out, so no line of the shell crosses a letter.
        "pointer-events-none flex flex-col items-center justify-center gap-2 bg-[radial-gradient(closest-side,var(--color-bg)_62%,transparent)] px-4 text-center lg:gap-3",
        className,
      )}
    >
      <p className="type-display-m text-ink-1">{HERO_COPY.endTitle}</p>
      <p className="hidden max-w-[36ch] type-body-s text-ink-2 sm:block">{HERO_COPY.endSentence}</p>
      <div className="pointer-events-auto mt-1 flex items-center justify-center gap-2">
        {/* The end of the track is a region of its own: its one next step is the primary. */}
        <Button variant="primary" size="md" onClick={openVehiclePicker}>
          {HERO_COPY.endVehicle}
        </Button>
        <Button variant="secondary" size="md" asChild>
          <RouteLink href={ROUTES.parts}>{HERO_COPY.endAll}</RouteLink>
        </Button>
        {/* Three names do not fit one row of a phone: there the quiet button keeps its icon and
            its accessible name. */}
        <Button
          variant="quiet"
          size="md"
          icon={<ArrowCounterClockwiseIcon size={20} />}
          onClick={assemble}
          data-testid={TEST_IDS.heroAssemble}
          aria-label={HERO_COPY.endAssemble}
          className="max-sm:w-11 max-sm:px-0"
        >
          <span className="max-sm:sr-only">{HERO_COPY.endAssemble}</span>
        </Button>
      </div>
    </div>
  );
}
