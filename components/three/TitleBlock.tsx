/**
 * Title block (DESIGN-SYSTEM §5.7): the drawing's honest facts — „Prikaz: Generički kompaktni
 * hečbek, nije konkretan model“, „Sistemi 10“ and „Kategorije 44“. A cell grid on the
 * stage frame's top-right from 1440 px while the car is assembled; once the grid takes that
 * place, and below 1440 px, the note is one line under the drawing (it is never hidden).
 * Static copy uses the LCP-safe RevealText (it is on the first screen).
 */
import { cn } from "@/lib/cn";
import { SYSTEMS } from "@/lib/catalog/taxonomy";
import { CATEGORY_COUNT } from "@/lib/three/stages";
import { HERO_COPY } from "@/lib/i18n/sr/hero";
import { RevealText } from "@/components/text-reveal/RevealText";

export function TitleBlock({ className }: { className?: string }) {
  return (
    <dl
      data-reveal="off"
      data-hero-title-block=""
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
          <RevealText as="span">{HERO_COPY.titleBlockSystems}</RevealText>
        </dt>
        <dd className="type-code text-ink-1 tabular-nums">
          {SYSTEMS.length}
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
    <p data-hero-honesty="" className={cn("type-caption-s text-ink-3", className)}>
      <RevealText as="span">{HERO_COPY.honesty}</RevealText>
    </p>
  );
}
