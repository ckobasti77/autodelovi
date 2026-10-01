"use client";

/**
 * Stage caption (DESIGN-SYSTEM §7.7): system title (`display-m`), „{n} kategorija · {m}
 * delova“ (`code-s`) and one sentence (`body-s`, ink-2). Captions change by hard cut at the
 * stage boundary and replay the word reveal (≤ 450 ms) with the shared splitter — the caption
 * owns its opacity, so it opts out of the site-wide pass (text-reveal rule, case 2). Each stage
 * mounts a fresh element (keyed), so React never rewrites a split text node.
 *
 * Stage 0 speaks on phones only (the stage sits under the copy there; on desktop the headline
 * speaks); the exploded hold says „Kliknite / Dodirnite deo“. Hidden while a part is selected
 * (the panel carries the name).
 *
 * The caption present at page load is first-screen copy: it arrives through RevealText (CSS,
 * server-split words, no JS at hydration); only later stage changes replay through GSAP.
 */
import { useRef, useState } from "react";

import { gsap, useGSAP } from "@/lib/gsap/client";
import { countSr } from "@/lib/format/plural";
import { restoreWords, shuffledOrder, splitWords } from "@/lib/textReveal";
import { STAGE_SUMMARIES } from "@/lib/three/stages";
import { HERO_COPY, STAGE_SENTENCE } from "@/lib/i18n/sr/hero";
import { cn } from "@/lib/cn";
import { RevealText } from "@/components/text-reveal/RevealText";
import { useHeroStore } from "@/components/three/heroStore";

const pad = (n: number) => String(n).padStart(2, "0");

function CaptionBody({
  stage,
  hold,
  touch,
  initial,
}: {
  stage: number;
  hold: boolean;
  touch: boolean;
  initial: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const summary = STAGE_SUMMARIES.find((s) => s.stage === stage);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root || initial || useHeroStore.getState().reducedMotion) return;
      const lines = Array.from(root.querySelectorAll<HTMLElement>("[data-caption-line]"));
      const words = lines.flatMap((line) => splitWords(line));
      if (words.length === 0) return;
      const order = shuffledOrder(words.length, root.textContent ?? "");
      const each = Math.min(0.024, 0.2 / words.length);
      gsap.set(words, { opacity: 0, filter: "blur(8px)", y: "0.35em" });
      const tl = gsap.timeline({
        onComplete: () => lines.forEach((line) => restoreWords(line)),
      });
      words.forEach((word, index) => {
        tl.to(
          word,
          { opacity: 1, filter: "blur(0px)", y: 0, duration: 0.25, ease: "sk.out" },
          (order[index] ?? index) * each,
        );
      });
      return () => {
        tl.kill();
        lines.forEach((line) => restoreWords(line));
      };
    },
    { scope: ref },
  );

  if (!summary) return null;
  const title = hold
    ? touch
      ? HERO_COPY.holdHintTouch
      : HERO_COPY.holdHintPointer
    : summary.labelSr;
  const sentence = hold ? HERO_COPY.holdHintSub : STAGE_SENTENCE[summary.key];
  const counts = `${pad(stage)} · ${countSr(summary.categories, ["kategorija", "kategorije", "kategorija"])} · ${countSr(summary.parts, ["deo", "dela", "delova"])}`;
  if (initial) {
    return (
      <div ref={ref} className="flex flex-col gap-1.5">
        <RevealText className="type-display-m text-ink-1">{title}</RevealText>
        {!hold ? (
          <RevealText className="type-code-s uppercase text-ink-3">{counts}</RevealText>
        ) : null}
        <RevealText className="max-w-[40ch] type-body-s text-ink-2">{sentence}</RevealText>
      </div>
    );
  }
  return (
    <div ref={ref} className="flex flex-col gap-1.5">
      <p data-caption-line="" className="type-display-m text-ink-1">
        {title}
      </p>
      {!hold ? (
        <p data-caption-line="" className="type-code-s uppercase text-ink-3">
          {counts}
        </p>
      ) : null}
      <p data-caption-line="" className="max-w-[40ch] type-body-s text-ink-2">
        {sentence}
      </p>
    </div>
  );
}

export function StageCaption({ className }: { className?: string }) {
  const stage = useHeroStore((s) => s.stage);
  const hold = useHeroStore((s) => s.progress >= 0.92);
  const touch = useHeroStore((s) => !s.finePointer);
  const selected = useHeroStore((s) => s.selected !== null);
  const key = `${stage}-${hold ? "hold" : "run"}`;
  const [firstKey] = useState(key);
  const [changed, setChanged] = useState(false);
  if (!changed && key !== firstKey) setChanged(true);
  if (selected) return null;
  return (
    <div
      data-reveal="off"
      data-stage-caption=""
      className={cn("pointer-events-none", stage === 0 && "lg:hidden", className)}
    >
      <CaptionBody
        key={key}
        stage={stage}
        hold={hold}
        touch={touch}
        initial={!changed && key === firstKey}
      />
    </div>
  );
}
