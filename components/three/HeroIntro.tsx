"use client";

/**
 * Caption of the assembled car (docs/3d/HERO-V2.md §1.5, §7): what the drawing is, how much is
 * in it and what scrolling does — on every width, so a desktop visitor is told too. It is
 * first-screen copy: LCP-safe `RevealText`, no JS at hydration. Gone once the first page of the
 * grid starts (the page heading takes its place) and while a part is selected.
 */
import { SYSTEMS } from "@/lib/catalog/taxonomy";
import { CATEGORY_COUNT } from "@/lib/three/stages";
import { HERO_COPY } from "@/lib/i18n/sr/hero";
import { cn } from "@/lib/cn";
import { RevealText } from "@/components/text-reveal/RevealText";
import { useHeroStore } from "@/components/three/heroStore";

export function HeroIntro({ className }: { className?: string }) {
  const visible = useHeroStore((s) => s.page === 0 && s.selected === null);
  const reduced = useHeroStore((s) => s.reducedMotion);
  if (!visible) return null;
  return (
    <div
      data-reveal="off"
      data-hero-intro=""
      className={cn("pointer-events-none flex flex-col gap-1.5", className)}
    >
      <RevealText className="type-display-m text-ink-1">{HERO_COPY.introTitle}</RevealText>
      <RevealText className="type-code-s uppercase text-ink-3">
        {HERO_COPY.introCounts(SYSTEMS.length, CATEGORY_COUNT)}
      </RevealText>
      <RevealText className="max-w-[40ch] type-body-s text-ink-2">
        {reduced ? HERO_COPY.introSentenceStatic : HERO_COPY.introSentence}
      </RevealText>
    </div>
  );
}
