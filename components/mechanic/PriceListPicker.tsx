"use client";

/**
 * `/majstor/cenovnik`: choose systems / categories → download the personal price list as
 * XLSX from the route handler (`/majstor/cenovnik/preuzmi?kategorije=`), which reads the
 * mechanic's own prices from Convex with his token.
 *
 * Every system is one panel: its own checkbox row as the header, its categories as rows with
 * the article count in a column. The panels pack into columns (a system has 1 to 12
 * categories, so a row-by-row grid left holes under the short ones) and, being a picker that
 * must be usable at once and almost all on the first screen at 1440 px, arrive as one eager
 * staggered group.
 */
import { useMemo, useRef, useState } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import type { CategoryTree } from "@/lib/catalog/types";
import { cn } from "@/lib/cn";
import { useBottomInset } from "@/lib/dom/bottomInset";
import { formatNumber } from "@/lib/format/number";
import { countSr } from "@/lib/format/plural";
import { RevealGroup, RevealItem } from "@/components/reveal/Reveal";
import { Button } from "@/components/ui/Button";
import { CheckboxBox } from "@/components/ui/Checkbox";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

export const PRICE_LIST_MAX_ROWS = 5_000;

type Group = {
  system: CategoryTree["systems"][number];
  categories: { slug: string; name: string; count: number }[];
};

function groups(tree: CategoryTree): Group[] {
  const childCount = new Map<string, number>();
  for (const s of tree.subcategories) {
    if (s.parentId) childCount.set(s.parentId, (childCount.get(s.parentId) ?? 0) + s.productCount);
  }
  return tree.systems
    .map((system) => ({
      system,
      categories: tree.categories
        .filter((c) => c.parentId === system._id)
        .map((c) => ({
          slug: c.slug,
          name: c.name,
          count: c.productCount || childCount.get(c._id) || 0,
        }))
        .filter((c) => c.count > 0),
    }))
    .filter((g) => g.categories.length > 0);
}

const NOTE = `Cene su sa PDV-om i vašim rabatom na dan preuzimanja. Najviše ${formatNumber(PRICE_LIST_MAX_ROWS)} artikala u jednom fajlu.`;

export function PriceListPicker({ tree }: { tree: CategoryTree }) {
  const all = useMemo(() => groups(tree), [tree]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // The download bar is sticky: focused checkboxes scroll clear of it (A11Y-14).
  const barRef = useRef<HTMLDivElement>(null);
  useBottomInset(barRef);

  const toggle = (slugs: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const s of slugs) {
        if (on) next.add(s);
        else next.delete(s);
      }
      return next;
    });

  const count = all
    .flatMap((g) => g.categories)
    .filter((c) => selected.has(c.slug))
    .reduce((sum, c) => sum + c.count, 0);
  const allSlugs = all.flatMap((g) => g.categories.map((c) => c.slug));
  const everything = selected.size === allSlugs.length && allSlugs.length > 0;
  const href = ROUTES.mechanicPriceListDownload([...selected]);

  return (
    <div className="flex flex-col gap-5" data-reveal="off">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button
          variant="quiet"
          size="sm"
          className="max-lg:h-11"
          onClick={() => toggle(allSlugs, !everything)}
        >
          {everything ? "Poništi izbor" : "Izaberi sve kategorije"}
        </Button>
        <span className="type-body-s text-ink-2">
          Izabrano: {countSr(selected.size, ["kategorija", "kategorije", "kategorija"])} · oko{" "}
          {countSr(count, ["artikal", "artikla", "artikala"])}
        </span>
        <p className="basis-full type-caption font-normal text-ink-3 sm:hidden">{NOTE}</p>
      </div>
      <RevealGroup className="columns-1 gap-4 sm:columns-2 xl:columns-3">
        {all.map((g, index) => {
          const slugs = g.categories.map((c) => c.slug);
          const on = slugs.every((s) => selected.has(s));
          const some = !on && slugs.some((s) => selected.has(s));
          const total = g.categories.reduce((sum, c) => sum + c.count, 0);
          return (
            <RevealItem
              key={g.system._id}
              eager
              index={index}
              className="mb-4 break-inside-avoid panel"
            >
              <fieldset className="flex min-w-0 flex-col pb-1.5">
                <legend className="sr-only">{g.system.name}</legend>
                <label className="flex min-h-13 cursor-pointer items-center gap-3 border-b border-line px-4 type-body font-semibold text-ink-1">
                  <CheckboxBox
                    aria-label={`${g.system.name} — sve kategorije`}
                    checked={on ? true : some ? "indeterminate" : false}
                    onCheckedChange={(c) => toggle(slugs, c === true)}
                  />
                  <span className="min-w-0 flex-1">{g.system.name}</span>
                  <span className="type-body-s font-normal tabular-nums text-ink-3">
                    {formatNumber(total)}
                  </span>
                </label>
                {g.categories.map((c) => (
                  <label
                    key={c.slug}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 px-4 type-body-s transition-control",
                      selected.has(c.slug) ? "text-ink-1" : "text-ink-2 hover:text-ink-1",
                    )}
                  >
                    <CheckboxBox
                      aria-label={c.name}
                      checked={selected.has(c.slug)}
                      onCheckedChange={(x) => toggle([c.slug], x === true)}
                    />
                    <span className="min-w-0 flex-1">{c.name}</span>
                    <span className="tabular-nums text-ink-3">{formatNumber(c.count)}</span>
                  </label>
                ))}
              </fieldset>
            </RevealItem>
          );
        })}
      </RevealGroup>
      <div
        ref={barRef}
        className="sticky bottom-0 z-sticky -mx-page flex flex-wrap items-center gap-4 border-t border-line-strong bg-bg/95 px-page py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-header before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-6 before:bg-linear-to-t before:from-bg before:to-transparent sm:mx-0 sm:px-0"
      >
        {selected.size > 0 ? (
          <Button
            asChild
            size="lg"
            icon={<DownloadSimpleIcon size={20} />}
            className="grow sm:grow-0"
          >
            <a href={href} download data-testid={TEST_IDS.mechanicPriceListDownload}>
              Preuzmi cenovnik (Excel)
            </a>
          </Button>
        ) : (
          <Button
            size="lg"
            icon={<DownloadSimpleIcon size={20} />}
            disabled
            className="grow sm:grow-0"
          >
            Preuzmi cenovnik (Excel)
          </Button>
        )}
        {/* Phones: the note sits above the list, so the bar stays one row. */}
        <p className="hidden type-caption font-normal text-ink-3 sm:block">{NOTE}</p>
      </div>
    </div>
  );
}
