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
 */
import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import { gsap, useGSAP } from "@/lib/gsap/client";
import { cn } from "@/lib/cn";
import { findSystem, type TaxonomyCategory } from "@/lib/catalog/taxonomy";
import { categoryImage } from "@/lib/catalog/types";
import { restoreWords, splitWords } from "@/lib/textReveal";
import { HERO_PAGES, isSeated, slotOf } from "@/lib/three/pages";
import { useSelectedVehicle } from "@/lib/vehicle/store";
import { HERO_COPY, SLOT_LABEL_SHORT, SYSTEM_SHORT } from "@/lib/i18n/sr/hero";
import { ROUTES } from "@/constants/routes";
import { RouteLink } from "@/components/ui/RouteLink";
import { heroStore, setFocusedSlot, useHeroStore, type SlotRect } from "@/components/three/heroStore";
import { heroDom } from "@/components/three/heroDom";

function seatedMask(progress: number, page: number): number {
  const entry = HERO_PAGES[page - 1];
  if (!entry) return 0;
  let mask = 0;
  entry.categories.forEach((c, index) => {
    const address = slotOf(c.slug);
    if (address && isSeated(progress, address)) mask |= 1 << index;
  });
  return mask;
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

  // Layout source of the scene: read on resize, on a page change and when the fonts arrive.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const run = () => measure(root);
    run();
    const observer = new ResizeObserver(run);
    observer.observe(root);
    if (heroDom.main) observer.observe(heroDom.main);
    void document.fonts?.ready.then(run);
    return () => observer.disconnect();
  }, [page]);

  // A name arrives word by word when its part seats (≤ 300 ms), and the tick under the cell
  // draws. Reduced motion: both simply appear.
  useGSAP(
    () => {
      const root = rootRef.current;
      const last = previous.current;
      const fresh = last.page === page ? seated & ~last.mask : seated;
      previous.current = { page, mask: seated };
      if (!root || fresh === 0 || reduced) return;
      const links = Array.from(root.querySelectorAll<HTMLElement>("[data-page-active] [data-slot]"));
      const lines: HTMLElement[] = [];
      links.forEach((link, index) => {
        if (!(fresh & (1 << index))) return;
        const label = link.querySelector<HTMLElement>("[data-label]");
        const tick = link.querySelector<HTMLElement>("[data-tick]");
        if (tick) gsap.fromTo(tick, { scaleX: 0 }, { scaleX: 1, duration: 0.18, ease: "sk.out" });
        if (!label) return;
        const words = splitWords(label);
        if (words.length === 0) return;
        lines.push(label);
        gsap.fromTo(
          words,
          { opacity: 0, filter: "blur(6px)", y: "0.35em" },
          {
            opacity: 1,
            filter: "blur(0px)",
            y: 0,
            duration: 0.25,
            ease: "sk.out",
            stagger: Math.min(0.03, 0.12 / words.length),
            onComplete: () => restoreWords(label),
          },
        );
      });
      return () => lines.forEach((line) => restoreWords(line));
    },
    { dependencies: [seated, page, reduced], scope: rootRef, revertOnUpdate: true },
  );

  const active = HERO_PAGES[page - 1];
  const cols = active && active.categories.length <= 8 ? 4 : 5;

  return (
    <section
      ref={rootRef}
      aria-label={HERO_COPY.gridLabel}
      data-hero-grid=""
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
        {HERO_PAGES.map((entry) => {
          const isActive = entry.page === page;
          return (
            <ul
              key={entry.page}
              data-page={entry.page}
              data-page-active={isActive ? "" : undefined}
              aria-label={listName(entry.page)}
              className={
                isActive
                  ? "grid auto-rows-(--slot-row) grid-cols-[repeat(var(--slot-cols),minmax(0,1fr))] gap-x-2 gap-y-2 md:grid-cols-[repeat(var(--slot-cols-wide),minmax(0,1fr))] md:gap-x-3"
                  : "sr-only"
              }
            >
              {entry.categories.map((category, index) => (
                <Slot
                  key={category.slug}
                  category={category}
                  active={isActive}
                  seated={isActive && (seated & (1 << index)) !== 0}
                  image={mode === "image" || category.instances.length === 0}
                  href={categoryHref(category.slug, vehicle)}
                />
              ))}
            </ul>
          );
        })}
      </div>
    </section>
  );
}

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

function Slot({
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
  return (
    <li className="flex min-w-0 justify-center">
      <RouteLink
        href={href}
        prefetch={false}
        data-slot={category.slug}
        data-seated={seated ? "" : undefined}
        aria-label={category.labelSr}
        tabIndex={active ? 0 : -1}
        onFocus={focus}
        onBlur={() => setFocusedSlot(null)}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setFocusedSlot(category.slug);
        }}
        onPointerLeave={() => setFocusedSlot(null)}
        className="group pointer-events-auto flex w-full min-w-0 cursor-pointer flex-col items-center gap-1.5 rounded-sm pb-1 text-ink-1 focus-ring-inset hover-hover:hover:text-accent-hover"
      >
        <span data-cell={category.slug} className="relative block size-(--slot-cell) shrink-0">
          {active && seated && image ? (
            <Image
              src={categoryImage(category.slug)}
              alt=""
              fill
              sizes="(min-width: 48rem) 124px, 76px"
              className="object-contain"
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
                <span className="min-[90rem]:hidden">{short}</span>
                <span className="hidden min-[90rem]:inline">{category.labelSr}</span>
              </>
            ) : (
              category.labelSr
            )}
          </span>
        </span>
      </RouteLink>
    </li>
  );
}
