"use client";

/**
 * Title block (DESIGN-SYSTEM §5.7): the drawing's honest facts — „Prikaz: Generički kompaktni
 * hečbek, nije konkretan model“, the live stage „Faza 03 / 07“ and „Kategorije 44“. A cell
 * grid on the stage frame's top-right from 1440 px; below that one line under the drawing (the
 * honesty note is never hidden). Static copy uses the LCP-safe RevealText (it is on the first
 * screen); the stage value is live and never animated.
 */
import { cn } from "@/lib/cn";
import { CATEGORY_COUNT, LAST_STAGE_INDEX } from "@/lib/three/stages";
import { HERO_COPY } from "@/lib/i18n/sr/hero";
import { RevealText } from "@/components/text-reveal/RevealText";
import { useHeroStore } from "@/components/three/heroStore";

const pad = (n: number) => String(n).padStart(2, "0");

export function TitleBlock({ className }: { className?: string }) {
  const stage = useHeroStore((s) => s.stage);
  return (
    <dl
      data-reveal="off"
      className={cn(
        // A sheet's title block is a resting surface like any other: 8 px, hairline, lit edge.
        "grid grid-cols-[auto_auto] overflow-hidden rounded-md border border-line bg-bg/80 text-[0.75rem] shadow-rest reduced-transparency:bg-bg",
        className,
      )}
    >
      <div className="col-span-2 flex flex-col gap-1 border-b border-line px-3 py-2">
        <dt className="type-code-s uppercase text-ink-3">
          <RevealText as="span">{HERO_COPY.titleBlockView}</RevealText>
        </dt>
        <dd className="text-ink-2">
          <RevealText as="span">{HERO_COPY.honesty}</RevealText>
        </dd>
      </div>
      <div className="flex flex-col gap-1 border-r border-line px-3 py-2">
        <dt className="type-code-s uppercase text-ink-3">
          <RevealText as="span">{HERO_COPY.titleBlockStage}</RevealText>
        </dt>
        <dd className="type-code text-ink-1 tabular-nums">
          {pad(stage)} / {pad(LAST_STAGE_INDEX)}
        </dd>
      </div>
      <div className="flex flex-col gap-1 px-3 py-2">
        <dt className="type-code-s uppercase text-ink-3">
          <RevealText as="span">{HERO_COPY.titleBlockCategories}</RevealText>
        </dt>
        <dd className="type-code text-ink-1 tabular-nums">
          {CATEGORY_COUNT}
        </dd>
      </div>
    </dl>
  );
}

/** The honesty note as one line (below 1440 px). */
export function HonestyLine({ className }: { className?: string }) {
  return (
    <p className={cn("type-caption-s text-ink-3", className)}>
      <RevealText as="span">{HERO_COPY.honesty}</RevealText>
    </p>
  );
}
