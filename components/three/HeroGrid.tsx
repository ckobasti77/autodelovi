"use client";

/**
 * The parts grid of the hero (docs/3d/HERO-V2.md §3–§8, §11–§12).
 *
 * Six lists, one per page; the page in view is laid out as the grid, the others are clipped
 * (`sr-only` — they stay in the accessibility tree, and focusing one of their links brings its
 * page up). A slot is a link to the category: a square cell the scene docks the part into, and
 * the name under it. No box, border or background.
 *
 * The grid is the layout source of the 3D: cell rectangles are read on resize only and handed
 * to the scene, which unprojects them every frame — nothing here reads layout or writes a label
 * per frame. A name enters the layout when its part seats and arrives word by word through the
 * shared splitter (this grid owns its copy's opacity, so the root opts out of the site-wide
 * pass). In `image` mode (reduced motion, low tier, model still loading, context lost) a seated
 * cell shows the category's thumbnail instead of a mesh.
 *
 * A seat re-renders one slot, not the grid (`Slot` is memoised): the seats of a page come a few
 * frames apart while its parts are still flying.
 */
import Image from "next/image";
import { memo, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { gsap, useGSAP } from "@/lib/gsap/client";
import { cn } from "@/lib/cn";
import { findSystem, type TaxonomyCategory } from "@/lib/catalog/taxonomy";
import { categoryImage } from "@/lib/catalog/types";
import { restoreWords, splitWords } from "@/lib/textReveal";
import { clamp01 } from "@/lib/three/explode";
import { HERO_PAGES, isSeated, slotOf } from "@/lib/three/pages";
import { useSelectedVehicle } from "@/lib/vehicle/store";
import { HERO_COPY, SLOT_LABEL_SHORT, SYSTEM_SHORT } from "@/lib/i18n/sr/hero";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";
import { RouteLink } from "@/components/ui/RouteLink";
import { heroStore, setFocusedSlot, useHeroStore, type SlotRect } from "@/components/three/heroStore";
import { heroDom } from "@/components/three/heroDom";

/** Runs on every progress change: no closure, no array. */
function seatedMask(progress: number, page: number): number {
  const entry = HERO_PAGES[page - 1];
  if (!entry) return 0;
  let mask = 0;
  for (let index = 0; index < entry.categories.length; index += 1) {
    const address = slotOf(entry.categories[index].slug);
    if (address && isSeated(progress, address)) mask |= 1 << index;
  }
  return mask;
}

/** The seat beat (HERO-V2 §9): seconds, and the lift of a word in px. */
const SEAT = { word: 0.25, tick: 0.18, stagger: 0.03, spread: 0.12, lift: 4 } as const;
/** From this width a slot shows the category's full name (`min-[90rem]` below). */
const FULL_NAMES = "(min-width: 90rem)";

type SeatReveal = { tween: gsap.core.Tween; copy: HTMLElement; tick: HTMLElement | null };

/** Ends a slot's reveal: the words go back into one text node, the tick drops its inline style. */
function settle(reveals: Map<HTMLElement, SeatReveal>, link: HTMLElement): void {
  const reveal = reveals.get(link);
  if (!reveal) return;
  reveals.delete(link);
  reveal.tween.kill();
  restoreWords(reveal.copy);
  if (reveal.tick) reveal.tick.style.transform = "";
}

/** Cells of the active page and the car's band, relative to the canvas. Called on resize only. */
function measure(root: HTMLElement): void {
  const main = heroDom.main?.getBoundingClientRect();
  if (!main || main.width === 0) return;
  const rects: SlotRect[] = [];
  for (const cell of root.querySelectorAll<HTMLElement>("[data-page-active] [data-cell]")) {
    const r = cell.getBoundingClientRect();
    rects.push({
      slug: cell.dataset.cell ?? "",
      rect: { x: r.left - main.left, y: r.top - main.top, w: r.width, h: r.height },
    });
  }
  const bandEl = root.parentElement?.querySelector<HTMLElement>("[data-hero-band]");
  const b = bandEl?.getBoundingClientRect();
  heroStore.setState({
    ...(rects.length > 0 ? { slotRects: rects } : {}),
    band: b ? { x: b.left - main.left, y: b.top - main.top, w: b.width, h: b.height } : null,
  });
}

export function HeroGrid({ className }: { className?: string }) {
  const page = useHeroStore((s) => s.page);
  const mode = useHeroStore((s) => s.slotMode);
  const reduced = useHeroStore((s) => s.reducedMotion);
  const blocked = useHeroStore((s) => s.selected !== null);
  const vehicle = useSelectedVehicle();
  const rootRef = useRef<HTMLElement>(null);
  const previous = useRef({ page: 0, mask: 0 });
  const reveals = useRef(new Map<HTMLElement, SeatReveal>());
  const [seated, setSeated] = useState(0);

  // Progress → which slots of the page are seated (state changes a few times per page).
  useEffect(() => {
    const apply = () => {
      const { progress, page: current } = heroStore.getState();
      setSeated(seatedMask(progress, current));
    };
    apply();
    return heroStore.subscribe((state, prev) => {
      if (state.progress !== prev.progress || state.page !== prev.page) apply();
    });
  }, []);

  // Layout source of the scene: read on resize and on a page change (cells and rows have fixed
  // sizes, so a late font moves nothing the observer would not report). A page needs its cells in the frame it appears, so that read is synchronous. The assembled
  // car needs nothing yet: its first read rides the observer's own first delivery, where the
  // layout is already clean — a read here would force a layout of the whole page in the middle
  // of hydration.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const run = () => measure(root);
    if (page > 0) run();
    const observer = new ResizeObserver(run);
    observer.observe(root);
    if (heroDom.main) observer.observe(heroDom.main);
    return () => observer.disconnect();
  }, [page]);

  // A name arrives word by word when its part seats (≤ 300 ms), and the tick under the cell
  // draws. One tween per slot runs a clock and writes opacity and transform itself: tweening
  // the words through GSAP's CSS plugin reads every word's computed style and converts an em
  // lift with a measured probe — a style pass and a forced layout per word, in the very frames
  // where the parts are flying. A reveal runs to its end (the next seat does not cut it).
  // Reduced motion: both simply appear.
  useGSAP(
    () => {
      const root = rootRef.current;
      const last = previous.current;
      const fresh = last.page === page ? seated & ~last.mask : seated;
      previous.current = { page, mask: seated };
      if (!root || fresh === 0 || reduced) return;
      const ease = gsap.parseEase("sk.out");
      const full = window.matchMedia(FULL_NAMES).matches;
      const running = reveals.current;
      const links = root.querySelectorAll<HTMLElement>("[data-page-active] [data-slot]");
      for (let index = 0; index < links.length; index += 1) {
        const link = links[index];
        if (!(fresh & (1 << index)) || running.has(link)) continue;
        const label = link.querySelector<HTMLElement>("[data-label]");
        if (!label) continue;
        // Only the name on screen is split (the other width's name is not displayed).
        const copy =
          label.querySelector<HTMLElement>(full ? '[data-name="full"]' : '[data-name="short"]') ?? label;
        const tick = link.querySelector<HTMLElement>("[data-tick]");
        const words = splitWords(copy);
        const stagger = words.length > 1 ? Math.min(SEAT.stagger, SEAT.spread / words.length) : 0;
        const total = Math.max(SEAT.tick, SEAT.word + stagger * (words.length - 1));
        const clock = { t: 0 };
        const render = () => {
          for (let i = 0; i < words.length; i += 1) {
            const k = ease(clamp01((clock.t - i * stagger) / SEAT.word));
            const style = words[i].style;
            style.opacity = k.toFixed(3);
            style.transform = `translateY(${((1 - k) * SEAT.lift).toFixed(2)}px)`;
          }
          if (tick) tick.style.transform = `scaleX(${ease(clamp01(clock.t / SEAT.tick)).toFixed(3)})`;
        };
        render();
        const tween = gsap.to(clock, {
          t: total,
          duration: total,
          ease: "none",
          onUpdate: render,
          onComplete: () => settle(running, link),
        });
        running.set(link, { tween, copy, tick });
      }
    },
    { dependencies: [seated, page, reduced], scope: rootRef },
  );

  useEffect(() => {
    const running = reveals.current;
    return () => {
      for (const link of Array.from(running.keys())) settle(running, link);
    };
  }, []);

  const active = HERO_PAGES[page - 1];
  const cols = active && active.categories.length <= 8 ? 4 : 5;

  return (
    <section
      ref={rootRef}
      aria-label={HERO_COPY.gridLabel}
      data-hero-grid=""
      data-testid={TEST_IDS.heroGrid}
      data-reveal="off"
      inert={blocked}
      className={cn(
        // The cell follows the room there is: a third (a fifth from 768 px) of the grid's own
        // width, and the screen's height — so two-line names fit and the car keeps a band on
        // short laptops and phones. Never smaller than a part needs to read.
        "flex flex-col gap-2 transition-opacity duration-(--dur-base) [container-type:inline-size] [--slot-cols:3] [--slot-rows:3] md:gap-3 md:[--slot-rows:2]",
        "[--slot-cell:max(4rem,min(4.75rem,calc((100cqw_-_1rem)_/_3_-_0.75rem),calc((100svh_-_36.5rem)_/_3)))]",
        "md:[--slot-cell:max(5.25rem,min(7.75rem,calc((100cqw_-_3rem)_/_5_-_0.5rem),calc((100svh_-_35rem)_/_2)))]",
        blocked && "opacity-30",
        className,
      )}
      style={{ "--slot-cols-wide": cols } as CSSProperties}
    >
      {/* Only a page of the grid can show a thumbnail; the assembled car ships without it. */}
      {page > 0 ? <SlotTone /> : null}
      <p aria-hidden="true" className="min-h-5 truncate type-label-l text-ink-2">
        {active ? (
          <>
            <span className="md:hidden">{active.systems.map((s) => SYSTEM_SHORT[s]).join(" · ")}</span>
            <span className="hidden md:inline">
              {active.systems.map((s) => findSystem(s)?.labelSr ?? s).join(" · ")}
            </span>
          </>
        ) : null}
      </p>

      {/* Height of the fullest page is reserved, so the car's band never changes between pages. */}
      <div className="relative type-caption [--slot-row:calc(var(--slot-cell)_+_0.375rem_+_2lh_+_0.25rem)] min-h-[calc(var(--slot-rows)_*_var(--slot-row)_+_(var(--slot-rows)_-_1)_*_0.5rem)]">
        {HERO_PAGES.map((entry) => (
          <Page
            key={entry.page}
            entry={entry}
            active={entry.page === page}
            // The pages out of view keep their props across seats and re-render on a page change only.
            seated={entry.page === page ? seated : 0}
            image={mode === "image"}
            vehicle={vehicle}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Tone of a slot's thumbnail on the night field. The thumbnails are rendered for the catalog's
 * cards: mid-grey parts over a soft black contact shadow. In a slot that shadow is a dark box
 * behind the part and the part is dimmer than its docked mesh, so the filter drops what is black
 * and translucent (alpha follows the colour) and lifts the rest — no frame, no background, the
 * same picture. Colours in sRGB, as the numbers were tuned.
 */
function SlotTone() {
  return (
    <svg aria-hidden="true" focusable="false" width="0" height="0" className="absolute">
      <filter id="hero-slot-tone" colorInterpolationFilters="sRGB">
        <feColorMatrix
          type="matrix"
          values="1.18 0 0 0 0.05  0 1.18 0 0 0.05  0 0 1.18 0 0.06  1.5 1.5 1.5 1 -1"
          result="tone"
        />
        {/* Never more opaque than the picture was: an all but transparent pixel has no colour to trust. */}
        <feComposite in="tone" in2="SourceGraphic" operator="in" />
      </filter>
    </svg>
  );
}

/** One page of the grid: the list in view is laid out, the others are clipped. */
const Page = memo(function Page({
  entry,
  active,
  seated,
  image,
  vehicle,
}: {
  entry: (typeof HERO_PAGES)[number];
  active: boolean;
  seated: number;
  image: boolean;
  vehicle: Vehicle;
}) {
  return (
    <ul
      data-page={entry.page}
      data-page-active={active ? "" : undefined}
      aria-label={listName(entry.page)}
      className={
        active
          ? "grid auto-rows-(--slot-row) grid-cols-[repeat(var(--slot-cols),minmax(0,1fr))] gap-x-2 gap-y-2 md:grid-cols-[repeat(var(--slot-cols-wide),minmax(0,1fr))] md:gap-x-3"
          : "sr-only"
      }
    >
      {entry.categories.map((category, index) => (
        <Slot
          key={category.slug}
          category={category}
          active={active}
          seated={active && (seated & (1 << index)) !== 0}
          image={image || category.instances.length === 0}
          href={categoryHref(category.slug, vehicle)}
        />
      ))}
    </ul>
  );
});

/** Accessible name of a page's list; a system on two pages says which part it is. */
function listName(page: number): string {
  const entry = HERO_PAGES[page - 1];
  const names = entry.systems.map((s) => findSystem(s)?.labelSr ?? s).join(", ");
  const same = HERO_PAGES.filter((p) => p.systems.join() === entry.systems.join());
  return same.length > 1 ? `${names}, ${same.indexOf(entry) + 1}. deo` : names;
}

type Vehicle = ReturnType<typeof useSelectedVehicle>;

/** Category page for the selected vehicle (the part panel's footer link builds the same). */
function categoryHref(slug: string, vehicle: Vehicle): string {
  const params = new URLSearchParams();
  if (vehicle) {
    params.set("marka", vehicle.brand.slug);
    params.set("model", vehicle.model.slug);
    if (vehicle.generation) params.set("generacija", vehicle.generation.slug);
    if (vehicle.engine) params.set("motor", vehicle.engine.slug);
  }
  const query = params.toString();
  return query ? `${ROUTES.category(slug)}?${query}` : ROUTES.category(slug);
}

const Slot = memo(function Slot({
  category,
  active,
  seated,
  image,
  href,
}: {
  category: TaxonomyCategory;
  active: boolean;
  seated: boolean;
  image: boolean;
  href: string;
}) {
  const short = SLOT_LABEL_SHORT[category.slug];
  const focus = () => {
    setFocusedSlot(category.slug);
    // A link of another page took focus (screen reader, programmatic): bring its page up.
    const address = slotOf(category.slug);
    const state = heroStore.getState();
    if (address && address.page !== state.page) state.controller?.goToPage(address.page, { instant: true });
  };
  // A page that is not in view is a plain list of links for the accessibility tree: the name
  // as text, no cell, no label box. Five such pages (all six at the assembled car) cost every
  // layout and style pass of the document next to nothing; the full slot is built when its
  // page comes up, on the same <a>, so a link that had focus keeps it.
  return (
    <li className={active ? "flex min-w-0 justify-center" : undefined}>
      <RouteLink
        href={href}
        prefetch={false}
        data-slot={category.slug}
        data-seated={seated ? "" : undefined}
        aria-label={active ? category.labelSr : undefined}
        tabIndex={active ? 0 : -1}
        onFocus={focus}
        onBlur={() => setFocusedSlot(null)}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setFocusedSlot(category.slug);
        }}
        onPointerLeave={() => setFocusedSlot(null)}
        className={
          active
            ? "group pointer-events-auto flex w-full min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-sm pb-1 text-ink-1 focus-ring-inset hover-hover:hover:text-accent-hover"
            : undefined
        }
      >
        {active ? (
          <>
            <span data-cell={category.slug} className="relative block size-(--slot-cell) shrink-0">
              {seated && image ? (
                <Image
                  src={categoryImage(category.slug)}
                  alt=""
                  fill
                  sizes="(min-width: 48rem) 124px, 76px"
                  className="object-contain [filter:url(#hero-slot-tone)]"
                />
              ) : null}
              <span
                data-tick=""
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-[34%] -bottom-1 h-px origin-center bg-line-strong",
                  !seated && "hidden",
                )}
              />
            </span>
            <span className="flex h-[2lh] w-full items-start justify-center text-center">
              <span data-label="" className={seated ? "text-balance" : "sr-only"}>
                {short ? (
                  <>
                    <span data-name="short" className="min-[90rem]:hidden">
                      {short}
                    </span>
                    <span data-name="full" className="hidden min-[90rem]:inline">
                      {category.labelSr}
                    </span>
                  </>
                ) : (
                  category.labelSr
                )}
              </span>
            </span>
          </>
        ) : (
          category.labelSr
        )}
      </RouteLink>
    </li>
  );
});
