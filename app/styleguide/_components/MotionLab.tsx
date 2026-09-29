"use client";

import { useRef, useState } from "react";
import { PlayIcon } from "@phosphor-icons/react/dist/ssr";

import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import {
  DISTANCE,
  DUR,
  DURATION_MS,
  EASE,
  EASE_CURVES,
  STAGGER,
  type EaseName,
} from "@/constants/motion";
import { useMotionMedia } from "@/lib/gsap/useMotionMedia";
import { Button } from "@/components/ui/Button";

const EASE_NOTES: Record<EaseName, string> = {
  "sk.out": "potpis\u00a0— ulasci, paneli, otkrivanje (≈ 80 % UI)",
  "sk.inOut": "pomeranja na ekranu, skokovi faza",
  "sk.in": "izlasci, zatvaranja",
  "sk.snap": "pritisak, prekidači, indikator taba",
};

function curvePath(curve: string): string {
  const [x1, y1, x2, y2] = curve.split(",").map(Number) as [number, number, number, number];
  const w = 120;
  const h = 80;
  return `M0 ${h} C ${x1 * w} ${h - y1 * h} ${x2 * w} ${h - y2 * h} ${w} 0`;
}

/** Ease and duration tokens, played live with GSAP (reduced motion: jumps to the end state). */
export function MotionLab() {
  const scope = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope });

  // Handlers find the lab root from the event target (no ref reads during render).
  const play = contextSafe((root: Element | null, ease: EaseName) => {
    const track = root?.querySelector<HTMLElement>(`[data-track="${ease}"]`);
    const dot = track?.querySelector<HTMLElement>("[data-dot]");
    if (!track || !dot) return;
    const distance = track.clientWidth - dot.offsetWidth;
    gsap.fromTo(
      dot,
      { x: 0 },
      {
        x: distance,
        duration: prefersReducedMotion() ? 0 : (DURATION_MS.panel / 1000) * 2,
        ease,
        overwrite: true,
      },
    );
  });

  const playAll = (root: Element | null) => {
    (Object.keys(EASE_CURVES) as EaseName[]).forEach((ease) => play(root, ease));
  };

  return (
    <div ref={scope} data-motion-lab="" className="flex flex-col gap-10">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-[60ch] type-body-s text-ink-3" data-reveal="off">
            Ličnost „Instrument“: kruti metal, bez odskoka, odlučno usporavanje. Svaka kriva se
            pokreće dvostrukim trajanjem panela da bi se oblik video.
          </p>
          <Button
            variant="secondary"
            size="sm"
            icon={<PlayIcon size={16} />}
            onClick={(event) => playAll(event.currentTarget.closest("[data-motion-lab]"))}
          >
            Pokreni sve
          </Button>
        </div>
        <ul className="flex flex-col gap-4">
          {(Object.keys(EASE_CURVES) as EaseName[]).map((ease) => (
            <li key={ease} className="grid items-center gap-4 md:grid-cols-[9rem_8rem_1fr_auto]">
              <span className="flex flex-col">
                <span className="type-code text-ink-1">{ease}</span>
                <span className="type-code-s text-ink-3">{EASE_CURVES[ease]}</span>
              </span>
              <svg viewBox="-4 -4 128 88" className="hidden h-16 w-24 md:block" aria-hidden="true">
                <path d="M0 80 H120 M0 0 V80" className="stroke-line" strokeWidth="1" fill="none" />
                <path
                  d={curvePath(EASE_CURVES[ease])}
                  className="stroke-accent"
                  strokeWidth="2"
                  fill="none"
                />
              </svg>
              <div
                data-track={ease}
                className="relative h-8 rounded-xs border border-line bg-surface-1"
              >
                <span
                  data-dot=""
                  className="absolute left-0 top-1/2 block size-6 -translate-y-1/2 rounded-xs bg-accent"
                />
              </div>
              <Button
                variant="quiet"
                size="sm"
                onClick={(event) => play(event.currentTarget.closest("[data-motion-lab]"), ease)}
                aria-label={`Pokreni ${ease}`}
              >
                <PlayIcon size={16} aria-hidden="true" />
              </Button>
              <span className="type-caption-s text-ink-3 md:col-start-3 md:-mt-2">
                {EASE_NOTES[ease]}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-3">
        <h3 className="type-h3 text-ink-1">Trajanja</h3>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(DURATION_MS).map(([name, ms]) => (
            <li
              key={name}
              className="flex flex-col gap-1 rounded-sm border border-line bg-surface-1 p-3"
            >
              <span className="type-numeral-s text-ink-1">{ms} ms</span>
              <span className="type-code-s text-ink-3">
                --dur-{name.replace(/([A-Z])/g, "-$1").toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * List choreography sample (§8.4): ≤ 30 ms per item, ≤ 360 ms in total, 8 px lift. Built with
 * useMotionMedia (gsap.matchMedia): reduced motion gets the end state without movement.
 * The tiles own their opacity, so the subtree opts out of the text reveal.
 */
export function StaggerDemo() {
  const scope = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);

  useMotionMedia(
    ({ reduced }) => {
      if (run === 0) return;
      const tiles = gsap.utils.toArray<HTMLElement>("[data-tile]");
      if (reduced) {
        gsap.set(tiles, { opacity: 1, y: 0 });
        return;
      }
      const each = Math.min(STAGGER.eachMax, STAGGER.totalMax / tiles.length);
      gsap.fromTo(
        tiles,
        { opacity: 0, y: DISTANCE.ui },
        { opacity: 1, y: 0, duration: DUR.base, ease: EASE.out, stagger: each },
      );
    },
    { scope, dependencies: [run] },
  );

  return (
    <div ref={scope} className="flex flex-col gap-4" data-reveal="off">
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            data-tile=""
            className="flex h-12 items-center justify-center rounded-xs border border-line bg-surface-1 type-numeral-s text-ink-2"
          >
            {String(i + 1).padStart(2, "0")}
          </span>
        ))}
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        icon={<PlayIcon size={16} />}
        onClick={() => setRun((n) => n + 1)}
      >
        Pokreni listu
      </Button>
    </div>
  );
}
