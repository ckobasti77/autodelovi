"use client";

/**
 * Callout + leader (DESIGN-SYSTEM §5.7): a 4 px accent anchor dot on the part's label anchor,
 * a 1 px accent leader straight up to the annotation box (flips below near the top edge). The
 * box: surface-3, 1 px line-strong, radius 6, lit edge — category name, one mechanic's note,
 * the live count. Hover callouts appear for fine pointers only; phones show the selected
 * category's name. Positions come from the canvas every rendered frame (transient store
 * updates → transforms), never through React renders. Informational only (`pointer-events:
 * none`): clicking the part itself selects it, so the box never traps the pointer.
 */
import { useEffect, useRef } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { findCategory } from "@/lib/catalog/taxonomy";
import { PART_NOTES } from "@/lib/catalog/partNotes";
import { countSr } from "@/lib/format/plural";
import { heroStore, useHeroStore } from "@/components/three/heroStore";
import { useCategoryCounts } from "@/components/three/useCategoryCounts";

const LEADER_DESKTOP = 72;
const LEADER_TOUCH = 44;
const EDGE = 12;

export function HeroCallout() {
  const selected = useHeroStore((s) => s.selected);
  const hovered = useHeroStore((s) => s.hovered);
  const finePointer = useHeroStore((s) => s.finePointer);
  const ready = useHeroStore((s) => s.status === "ready");
  const slug = selected ?? (finePointer ? hovered : null);
  const counts = useCategoryCounts(ready);
  const rootRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const leaderRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const place = () => {
      const root = rootRef.current;
      const dot = dotRef.current;
      const leader = leaderRef.current;
      const box = boxRef.current;
      if (!root || !dot || !leader || !box) return;
      const { anchor } = heroStore.getState();
      if (!anchor || anchor.slug !== slug || !anchor.visible) {
        root.style.visibility = "hidden";
        return;
      }
      const width = root.clientWidth;
      const leaderLength = finePointer ? LEADER_DESKTOP : LEADER_TOUCH;
      const boxW = box.offsetWidth;
      const boxH = box.offsetHeight;
      const above = anchor.y - leaderLength - boxH > EDGE;
      const boxTop = above ? anchor.y - leaderLength - boxH : anchor.y + leaderLength;
      const boxLeft = Math.min(Math.max(anchor.x - 24, EDGE), Math.max(EDGE, width - boxW - EDGE));
      dot.style.transform = `translate3d(${anchor.x - 4}px, ${anchor.y - 4}px, 0)`;
      leader.style.transform = `translate3d(${anchor.x - 0.5}px, ${Math.min(anchor.y, boxTop + (above ? boxH : 0))}px, 0)`;
      leader.style.height = `${leaderLength}px`;
      box.style.transform = `translate3d(${boxLeft}px, ${boxTop}px, 0)`;
      root.style.visibility = "visible";
    };
    place();
    return heroStore.subscribe((state, prev) => {
      if (state.anchor !== prev.anchor) place();
    });
  }, [slug, finePointer]);

  const category = slug ? findCategory(slug) : undefined;
  if (!slug || !category) return null;
  const count = counts?.get(slug);
  const compact = !finePointer || selected !== null;

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      data-reveal="off"
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
      style={{ visibility: "hidden" }}
    >
      <span
        ref={dotRef}
        className="absolute left-0 top-0 block size-2 rounded-full border-2 border-bg bg-accent"
      />
      <span ref={leaderRef} className="absolute left-0 top-0 block w-px bg-accent" />
      <div
        ref={boxRef}
        className={cn(
          "absolute left-0 top-0 flex flex-col gap-1 rounded-sm border border-line-strong bg-surface-3 px-3.5 py-2.5",
          compact ? "max-w-[16rem]" : "w-[18.5rem]",
        )}
      >
        <span className="text-[0.875rem] font-semibold leading-snug text-ink-1">
          {category.labelSr}
        </span>
        {!compact ? (
          <>
            <span className="text-[0.78125rem] leading-snug text-ink-2">{PART_NOTES[slug]}</span>
            {count ? (
              <span className="mt-1 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink-1">
                {countSr(count.productCount, ["artikal", "artikla", "artikala"])}
                <span className="font-normal text-ink-3">· kliknite na deo</span>
                <ArrowRightIcon size={14} aria-hidden="true" />
              </span>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
