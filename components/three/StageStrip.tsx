"use client";

/**
 * Stage index + explode controls (DESIGN-SYSTEM §5.7 „Stage index“, §7.7, §7.9).
 *
 * Desktop: `00–07` as buttons (detents — a click scrolls to that stage's end), numbers in
 * `numeral-s`, labels from 1280 px; the active cell has a 2 px accent bar that fills with the
 * progress inside the stage (written straight to the DOM, never through React state), an
 * accent number and `aria-current="step"`. Phones: „03 / 07 Kočnice i vešanje“ with previous /
 * next buttons (44 px). Both end with „Rasklopi / Sklopi“ and „Lista delova“.
 */
import { useEffect, useRef } from "react";
import {
  CaretLeftIcon,
  CaretRightIcon,
  CubeIcon,
  ListBulletsIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { STAGES } from "@/lib/catalog/taxonomy";
import { stageLocal, stageWindows } from "@/lib/three/explode";
import { STAGE_SHORT, HERO_COPY } from "@/lib/i18n/sr/hero";
import { TEST_IDS } from "@/constants/testIds";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { heroStore, useHeroStore } from "@/components/three/heroStore";
import { heroDom } from "@/components/three/heroDom";

const pad = (n: number) => String(n).padStart(2, "0");
const LAST = STAGES[STAGES.length - 1].stage;

export function StageStrip({
  onStage,
  onToggle,
  onOpenList,
}: {
  onStage: (stage: number) => void;
  onToggle: () => void;
  onOpenList: () => void;
}) {
  const stage = useHeroStore((s) => s.stage);
  const exploded = useHeroStore((s) => s.progress >= 0.5);
  const barRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const mobileBar = useRef<HTMLSpanElement | null>(null);
  const listRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    heroDom.listTrigger = listRef.current;
    return () => {
      heroDom.listTrigger = null;
    };
  }, []);

  // Progress inside the current stage → bar scale (transient, no re-render per frame).
  useEffect(() => {
    const apply = () => {
      const { progress, stage: current, timeline } = heroStore.getState();
      const local = stageLocal(progress, current, stageWindows(timeline));
      barRefs.current.forEach((bar, index) => {
        if (!bar) return;
        const value = index < current ? 1 : index === current ? Math.max(local, 0.04) : 0;
        bar.style.transform = `scaleX(${value})`;
        bar.dataset.state = index < current ? "done" : index === current ? "active" : "next";
      });
      if (mobileBar.current) {
        mobileBar.current.style.transform = `scaleX(${Math.max(progressOverall(), 0.02)})`;
      }
    };
    const progressOverall = () => heroStore.getState().progress;
    apply();
    return heroStore.subscribe((state, prev) => {
      if (state.progress !== prev.progress || state.stage !== prev.stage) apply();
    });
  }, []);

  const current = STAGES.find((s) => s.stage === stage) ?? STAGES[0];

  return (
    <div data-reveal="off" className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-6">
      {/* Desktop index */}
      <nav aria-label={HERO_COPY.stageNavLabel} className="hidden min-w-0 flex-1 lg:block">
        <ol className="grid grid-cols-8">
          {STAGES.map((s) => {
            const active = s.stage === stage;
            return (
              <li key={s.stage} className="relative min-w-0">
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-px bg-line-strong"
                />
                <span
                  aria-hidden="true"
                  ref={(el) => {
                    barRefs.current[s.stage] = el;
                  }}
                  className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-accent data-[state=done]:bg-ink-4"
                />
                <button
                  type="button"
                  onClick={() => onStage(s.stage)}
                  aria-current={active ? "step" : undefined}
                  aria-label={`${pad(s.stage)} ${s.labelSr}`}
                  className={cn(
                    "group flex h-16 w-full min-w-0 cursor-pointer flex-col items-start justify-center gap-0.5 rounded-xs pr-3 pt-2 text-left transition-control focus-ring-inset",
                    active ? "text-ink-1" : "text-ink-3 hover:text-ink-1",
                  )}
                >
                  <span
                    className={cn(
                      "type-numeral-s tabular-nums",
                      active ? "text-accent" : "text-ink-2 group-hover:text-ink-1",
                    )}
                  >
                    {pad(s.stage)}
                  </span>
                  <span className="hidden w-full truncate text-[0.8125rem] leading-tight xl:block">
                    {STAGE_SHORT[s.key]}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Phone index */}
      <div className="relative flex items-center gap-1 pt-1 lg:hidden">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-line-strong" />
        <span
          aria-hidden="true"
          ref={mobileBar}
          className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-accent"
        />
        <IconButton
          label={HERO_COPY.prevStage}
          icon={<CaretLeftIcon size={20} />}
          disabled={stage <= 0}
          onClick={() => onStage(Math.max(0, stage - 1))}
        />
        <p className="min-w-0 flex-1 truncate text-center">
          <span className="type-numeral-s tabular-nums text-accent">{pad(stage)}</span>
          <span className="type-numeral-s tabular-nums text-ink-3"> / {pad(LAST)} </span>
          <span className="type-caption text-ink-1">{STAGE_SHORT[current.key]}</span>
        </p>
        <IconButton
          label={HERO_COPY.nextStage}
          icon={<CaretRightIcon size={20} />}
          disabled={stage >= LAST}
          onClick={() => onStage(Math.min(LAST, stage + 1))}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 lg:flex lg:shrink-0 lg:gap-3">
        <Button
          variant="secondary"
          size="md"
          icon={<CubeIcon size={20} />}
          onClick={onToggle}
          data-testid={TEST_IDS.explodeToggle}
          aria-pressed={exploded}
        >
          {exploded ? HERO_COPY.assemble : HERO_COPY.explode}
        </Button>
        <Button
          ref={listRef}
          variant="secondary"
          size="md"
          icon={<ListBulletsIcon size={20} />}
          onClick={onOpenList}
          data-testid={TEST_IDS.partsListTrigger}
          aria-haspopup="dialog"
        >
          {HERO_COPY.partsList}
        </Button>
      </div>
    </div>
  );
}
