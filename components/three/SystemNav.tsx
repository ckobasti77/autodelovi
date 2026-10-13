"use client";

/**
 * System navigator of the hero (docs/3d/HERO-V2.md §10): the counter „Pronađeno 23/44“, the ten
 * catalog systems as chips clustered by grid page, and „Lista delova“. A chip jumps to the rest
 * point of its system's page; a cluster's hairline fills with the page's progress (written
 * straight to the DOM, never through React state).
 *
 * One tab stop: a roving tabindex with Left/Right, Home/End; Enter or Space activates. On
 * phones the row scrolls sideways and keeps the active cluster centred. The chips are also where
 * a page's parts go when it leaves the grid, so their centres are reported to the scene.
 */
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon, ListBulletsIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { findSystem, type SystemSlug } from "@/lib/catalog/taxonomy";
import {
  HERO_PAGES,
  NAV_SYSTEMS,
  SLOT_TOTAL,
  foundCount,
  foundInSystem,
  pageLocal,
} from "@/lib/three/pages";
import { HERO_COPY, SYSTEM_SHORT } from "@/lib/i18n/sr/hero";
import { TEST_IDS } from "@/constants/testIds";
import { Button } from "@/components/ui/Button";
import { heroStore, useHeroStore } from "@/components/three/heroStore";
import { heroDom } from "@/components/three/heroDom";

type Cluster = { key: string; systems: SystemSlug[]; pages: number[] };

/** Chips that share a page (or a system that spans two pages) sit in one cluster. */
const CLUSTERS: readonly Cluster[] = HERO_PAGES.reduce<Cluster[]>((out, page) => {
  const key = page.systems.join("+");
  const last = out[out.length - 1];
  if (last && last.key === key) last.pages.push(page.page);
  else out.push({ key, systems: [...page.systems], pages: [page.page] });
  return out;
}, []);

const pad = (n: number) => String(n).padStart(2, "0");

type ChipState = "next" | "active" | "done";

function stateOf(pages: readonly number[], page: number, ended: boolean): ChipState {
  if (ended || page > pages[pages.length - 1]) return "done";
  return pages.includes(page) ? "active" : "next";
}

export function SystemNav({
  onSystem,
  onOpenList,
}: {
  onSystem: (system: SystemSlug) => void;
  onOpenList: () => void;
}) {
  const page = useHeroStore((s) => s.page);
  const ended = useHeroStore((s) => s.ended);
  const reduced = useHeroStore((s) => s.reducedMotion);
  const [found, setFound] = useState(0);
  const scroller = useRef<HTMLOListElement>(null);
  const listRef = useRef<HTMLButtonElement | null>(null);
  const bars = useRef<Array<HTMLSpanElement | null>>([]);
  const clusters = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    heroDom.listTrigger = listRef.current;
    return () => {
      heroDom.listTrigger = null;
    };
  }, []);

  // Progress → cluster hairlines (transient) and the counter (state, a few changes per page).
  useEffect(() => {
    const apply = () => {
      const { progress, page: current, ended: over } = heroStore.getState();
      CLUSTERS.forEach((cluster, index) => {
        const bar = bars.current[index];
        if (!bar) return;
        const first = cluster.pages[0];
        const last = cluster.pages[cluster.pages.length - 1];
        const value =
          over || current > last
            ? 1
            : current < first
              ? 0
              : (current - first + pageLocal(progress, current)) / cluster.pages.length;
        bar.style.transform = `scaleX(${value})`;
        bar.dataset.state = value >= 1 ? "done" : "active";
      });
      setFound(foundCount(progress));
    };
    apply();
    return heroStore.subscribe((state, prev) => {
      if (state.progress !== prev.progress) apply();
    });
  }, []);

  // Where each page's parts go when it leaves: the centre of its cluster (canvas px).
  useLayoutEffect(() => {
    const measure = () => {
      const main = heroDom.main?.getBoundingClientRect();
      if (!main) return;
      const points: ({ x: number; y: number } | null)[] = [null];
      CLUSTERS.forEach((cluster, index) => {
        const rect = clusters.current[index]?.getBoundingClientRect();
        for (const p of cluster.pages) {
          points[p] = rect
            ? {
                x: Math.min(Math.max(rect.left + rect.width / 2, main.left), main.right) - main.left,
                y: rect.top + rect.height / 2 - main.top,
              }
            : null;
        }
      });
      heroStore.setState({ chipPoints: points });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (scroller.current) observer.observe(scroller.current);
    return () => observer.disconnect();
  }, []);

  // Phones: keep the active cluster in the middle of the scrolling row.
  useEffect(() => {
    const row = scroller.current;
    const index = CLUSTERS.findIndex((c) => c.pages.includes(page));
    const item = clusters.current[index];
    if (!row || row.scrollWidth <= row.clientWidth) return;
    const box = item?.getBoundingClientRect();
    row.scrollTo({
      left: box
        ? row.scrollLeft + box.left - row.getBoundingClientRect().left - (row.clientWidth - box.width) / 2
        : 0,
      behavior: reduced ? "auto" : "smooth",
    });
  }, [page, reduced]);

  const onKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const chips = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-system]"),
    );
    const index = chips.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? chips.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + chips.length) % chips.length;
    chips[next]?.focus();
  };

  const progress = heroStore.getState().progress;
  const activeSystem = NAV_SYSTEMS.find((s) => s.pages.includes(page))?.system ?? NAV_SYSTEMS[0].system;

  return (
    <div data-reveal="off" className="flex items-center gap-3 lg:gap-5">
      <p className="shrink-0 whitespace-nowrap" data-hero-counter="">
        <span className="sr-only type-label text-ink-3 lg:not-sr-only lg:mr-2">
          {HERO_COPY.found}
        </span>
        <span className="type-numeral-s tabular-nums text-ink-1">{pad(found)}</span>
        <span className="type-numeral-s tabular-nums text-ink-3"> / {SLOT_TOTAL}</span>
      </p>

      <nav aria-label={HERO_COPY.navLabel} className="min-w-0 flex-1">
        <ol
          ref={scroller}
          onKeyDown={onKeyDown}
          className="flex gap-3 overflow-x-auto scroll-fade-x [scrollbar-width:none] lg:gap-4"
        >
          {CLUSTERS.map((cluster, index) => {
            const clusterState = stateOf(cluster.pages, page, ended);
            return (
              <li
                key={cluster.key}
                ref={(el) => {
                  clusters.current[index] = el;
                }}
                aria-current={clusterState === "active" ? "step" : undefined}
                className="relative flex shrink-0 gap-1 pb-2"
              >
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-line-strong" />
                <span
                  aria-hidden="true"
                  ref={(el) => {
                    bars.current[index] = el;
                  }}
                  className="absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-accent data-[state=done]:bg-ink-4"
                />
                {cluster.systems.map((system) => {
                  const entry = NAV_SYSTEMS.find((s) => s.system === system);
                  if (!entry) return null;
                  const state = stateOf(entry.pages, page, ended);
                  const label = findSystem(system)?.labelSr ?? system;
                  const seated = foundInSystem(progress, system);
                  return (
                    <button
                      key={system}
                      type="button"
                      data-system={system}
                      data-state={state}
                      tabIndex={system === activeSystem ? 0 : -1}
                      onClick={() => onSystem(system)}
                      aria-label={HERO_COPY.chipName(
                        label,
                        entry.count,
                        state === "active" ? HERO_COPY.chipShown : state === "done" ? HERO_COPY.chipDone : "",
                      )}
                      className={cn(
                        "inline-flex h-11 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-sm px-3 type-caption transition-control focus-ring-inset active:translate-y-px hover-hover:h-10",
                        state === "active" && "bg-accent-subtle text-accent",
                        state === "done" && "bg-surface-3 text-ink-2 hover-hover:hover:text-ink-1",
                        state === "next" &&
                          "bg-surface-2 text-ink-2 hover-hover:hover:bg-surface-3 hover-hover:hover:text-ink-1",
                      )}
                    >
                      {SYSTEM_SHORT[system]}
                      <span aria-hidden="true" className="inline-flex items-center tabular-nums text-ink-3">
                        {state === "done" ? (
                          <CheckIcon size={14} weight="bold" />
                        ) : state === "active" ? (
                          `${seated}/${entry.count}`
                        ) : (
                          entry.count
                        )}
                      </span>
                    </button>
                  );
                })}
              </li>
            );
          })}
        </ol>
      </nav>

      <Button
        ref={listRef}
        variant="quiet"
        size="md"
        icon={<ListBulletsIcon size={20} />}
        onClick={onOpenList}
        data-testid={TEST_IDS.partsListTrigger}
        aria-haspopup="dialog"
        className="shrink-0 max-lg:w-11 max-lg:px-0"
      >
        <span className="sr-only lg:not-sr-only">{HERO_COPY.partsList}</span>
      </Button>
    </div>
  );
}
