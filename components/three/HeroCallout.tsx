"use client";

/**
 * Callout + leader (DESIGN-SYSTEM §5.7): a 4 px accent anchor dot on the part's label anchor,
 * a 1 px accent leader straight up to the annotation box (flips below near the top edge). The
 * box is a level-3 surface like a popover: surface-3, 1 px line-strong, radius 6, lit edge and
 * contact shadow — category name, one mechanic's note, the live count. The dot and the leader
 * are drawing and stay square. Hover callouts appear for fine pointers only; phones show the
 * selected category's name. Informational only (`pointer-events: none`): clicking the part
 * itself selects it, so the box never traps the pointer.
 *
 * Two layers, so the canvas and the motion never write the same property: the outer elements
 * are placed from the canvas every rendered frame (transient store updates → `translate3d`,
 * never through React renders, sizes cached by a ResizeObserver so placing reads no layout);
 * the inner ones are what GSAP moves. Entrance, on the first placed frame: the dot lands
 * (140 ms), the leader draws from the part to the label and the box settles 6 px along it with
 * opacity (220 ms, `sk.out`) — the popover entrance of `components/ui`, read as a drawing.
 * Each category mounts a fresh callout (keyed); the last one stays mounted and fades in place
 * (140 ms, `sk.in`) when the pointer leaves. Reduced motion: no entrance, no exit.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { findCategory } from "@/lib/catalog/taxonomy";
import { PART_NOTES } from "@/lib/catalog/partNotes";
import { countSr } from "@/lib/format/plural";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { ARTICLE_FORMS } from "@/lib/i18n/sr/catalog";
import { HERO_COPY } from "@/lib/i18n/sr/hero";
import { DUR, EASE } from "@/constants/motion";
import { heroStore, useHeroStore } from "@/components/three/heroStore";
import { useCategoryCounts } from "@/components/three/useCategoryCounts";

const LEADER_DESKTOP = 72;
const LEADER_TOUCH = 44;
const EDGE = 12;
/** How far the box travels along the leader as it settles (px). */
const RISE = 6;

export function HeroCallout() {
  const selected = useHeroStore((s) => s.selected);
  const hovered = useHeroStore((s) => s.hovered);
  const finePointer = useHeroStore((s) => s.finePointer);
  const ready = useHeroStore((s) => s.status === "ready");
  const slug = selected ?? (finePointer ? hovered : null);
  const counts = useCategoryCounts(ready);
  // The callout that is leaving stays mounted until it has faded.
  const [shown, setShown] = useState(slug);
  if (slug !== null && slug !== shown) setShown(slug);
  const onLeft = useCallback(() => setShown(null), []);

  if (shown === null || !findCategory(shown)) return null;
  return (
    <Callout
      key={shown}
      slug={shown}
      leaving={slug === null}
      compact={!finePointer || selected !== null}
      finePointer={finePointer}
      productCount={counts?.get(shown)?.productCount}
      onLeft={onLeft}
    />
  );
}

function Callout({
  slug,
  leaving,
  compact,
  finePointer,
  productCount,
  onLeft,
}: {
  slug: string;
  leaving: boolean;
  compact: boolean;
  finePointer: boolean;
  productCount: number | undefined;
  onLeft: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const leaderRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const leavingRef = useRef(leaving);
  const enteredRef = useRef(false);
  const enterRef = useRef<((above: boolean) => void) | null>(null);

  // Entrance: created inside the GSAP context, so an unmount mid-flight reverts it.
  useGSAP(
    (_context, contextSafe) => {
      enterRef.current =
        contextSafe?.((above: boolean) => {
          const root = rootRef.current;
          if (!root || prefersReducedMotion()) return;
          const pick = gsap.utils.selector(root);
          gsap.fromTo(
            pick("[data-callout-dot]"),
            { scale: 0 },
            { scale: 1, duration: DUR.quick, ease: EASE.out },
          );
          gsap.fromTo(
            pick("[data-callout-line]"),
            { scaleY: 0, transformOrigin: above ? "50% 100%" : "50% 0%" },
            { scaleY: 1, duration: DUR.base, ease: EASE.out },
          );
          gsap.fromTo(
            pick("[data-callout-box]"),
            { opacity: 0, y: above ? RISE : -RISE },
            { opacity: 1, y: 0, duration: DUR.base, ease: EASE.out, delay: 0.06 },
          );
        }) ?? null;
    },
    { scope: rootRef },
  );

  // Exit in place; a pointer that comes back to the same part before it is gone restores it.
  useGSAP(
    () => {
      leavingRef.current = leaving;
      const root = rootRef.current;
      if (!root) return;
      if (leaving) {
        if (prefersReducedMotion() || !enteredRef.current) {
          onLeft();
          return;
        }
        gsap.to(root, {
          opacity: 0,
          duration: DUR.quick,
          ease: EASE.in,
          overwrite: true,
          onComplete: onLeft,
        });
      } else if (enteredRef.current) {
        gsap.to(root, { opacity: 1, duration: DUR.instant, ease: "none", overwrite: true });
      }
    },
    { dependencies: [leaving, onLeft], scope: rootRef },
  );

  useEffect(() => {
    const root = rootRef.current;
    const dot = dotRef.current;
    const leader = leaderRef.current;
    const box = boxRef.current;
    if (!root || !dot || !leader || !box) return;
    // Sizes change with the content and the stage, not with the camera: read them when they
    // change and place from the cache on every frame.
    const size = { stage: 0, boxW: 0, boxH: 0 };
    const place = () => {
      // While it fades the callout stays where it was (the canvas has dropped its anchor).
      if (leavingRef.current) return;
      const { anchor } = heroStore.getState();
      if (!anchor || anchor.slug !== slug || !anchor.visible || size.boxW === 0) {
        root.style.visibility = "hidden";
        return;
      }
      const leaderLength = finePointer ? LEADER_DESKTOP : LEADER_TOUCH;
      const above = anchor.y - leaderLength - size.boxH > EDGE;
      const boxTop = above ? anchor.y - leaderLength - size.boxH : anchor.y + leaderLength;
      const boxLeft = Math.min(
        Math.max(anchor.x - 24, EDGE),
        Math.max(EDGE, size.stage - size.boxW - EDGE),
      );
      dot.style.transform = `translate3d(${anchor.x - 4}px, ${anchor.y - 4}px, 0)`;
      leader.style.transform = `translate3d(${anchor.x - 0.5}px, ${Math.min(anchor.y, boxTop + (above ? size.boxH : 0))}px, 0)`;
      leader.style.height = `${leaderLength}px`;
      box.style.transform = `translate3d(${boxLeft}px, ${boxTop}px, 0)`;
      root.style.visibility = "visible";
      if (!enteredRef.current) {
        enteredRef.current = true;
        enterRef.current?.(above);
      }
    };
    const measure = () => {
      size.stage = root.clientWidth;
      size.boxW = box.offsetWidth;
      size.boxH = box.offsetHeight;
      place();
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(box);
    const unsubscribe = heroStore.subscribe((state, prev) => {
      if (state.anchor !== prev.anchor) place();
    });
    return () => {
      observer.disconnect();
      unsubscribe();
      // A re-run (pointer type changed; React's double mount in development) starts over, as
      // the GSAP context has reverted the entrance by then.
      enteredRef.current = false;
    };
  }, [slug, finePointer]);

  const category = findCategory(slug);
  if (!category) return null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-reveal="off"
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
      style={{ visibility: "hidden" }}
    >
      <span ref={dotRef} className="absolute left-0 top-0 block size-2">
        <span
          data-callout-dot=""
          className="block size-2 rounded-full border-2 border-bg bg-accent"
        />
      </span>
      <span ref={leaderRef} className="absolute left-0 top-0 block w-px">
        <span data-callout-line="" className="block h-full w-px bg-accent" />
      </span>
      <div ref={boxRef} className="absolute left-0 top-0">
        <div
          data-callout-box=""
          className={cn(
            "flex flex-col gap-1 rounded-sm border border-line-strong bg-surface-3 px-3.5 py-2.5 shadow-overlay",
            compact ? "max-w-[16rem]" : "w-[18.5rem]",
          )}
        >
          <span className="text-[0.875rem] font-semibold leading-snug text-ink-1">
            {category.labelSr}
          </span>
          {!compact ? (
            <>
              <span className="text-[0.78125rem] leading-snug text-ink-2">{PART_NOTES[slug]}</span>
              {productCount !== undefined ? (
                <span className="mt-1 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-1">
                  {countSr(productCount, ARTICLE_FORMS)}
                  <span className="font-normal text-ink-3">· {HERO_COPY.calloutHint}</span>
                  <ArrowRightIcon size={14} aria-hidden="true" />
                </span>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
