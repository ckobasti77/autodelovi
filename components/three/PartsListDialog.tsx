"use client";

/**
 * „Lista delova“ (contract F8, DESIGN-SYSTEM §12.1 rule 6): the accessible equivalent of the
 * 3D car — every category grouped by system, each item selects exactly like a click (explodes
 * to its stage when needed, frames it, opens the part panel). Radix dialog: focus moves in,
 * Esc closes, focus returns to the trigger; after a selection the panel takes focus and gives
 * it back to the trigger when it closes.
 *
 * A row is what the car shows, as a list: the category's render (40 px, 4 px — concentric with
 * the 6 px row at 6 px padding), its name and the live count. The system heading stays at the
 * top of the list while its rows scroll under it, so a long list keeps saying where you are.
 */
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr";

import { countSr } from "@/lib/format/plural";
import { ARTICLE_FORMS } from "@/lib/i18n/sr/catalog";
import { HERO_COPY } from "@/lib/i18n/sr/hero";
import { CATEGORIES_BY_SYSTEM } from "@/lib/three/stages";
import { TEST_IDS } from "@/constants/testIds";
import { Dialog } from "@/components/ui/Dialog";
import { ProductThumb } from "@/components/catalog/ProductThumb";
import { selectCategory, useHeroStore } from "@/components/three/heroStore";
import { useCategoryCounts } from "@/components/three/useCategoryCounts";

export function PartsListDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const counts = useCategoryCounts(open);
  const selected = useHeroStore((s) => s.selected);

  const choose = (slug: string) => {
    onOpenChange(false);
    // Let the dialog hand focus back before the panel opens and takes it.
    window.setTimeout(() => selectCategory(slug, "list"), 0);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={HERO_COPY.partsListTitle}
      description={HERO_COPY.partsListDescription}
      className="[&_[data-parts-list]]:min-h-0"
    >
      <div
        data-parts-list=""
        data-testid={TEST_IDS.partsListDialog}
        className="flex flex-col gap-5"
      >
        {CATEGORIES_BY_SYSTEM.map(({ system, categories }) => (
          <section key={system.slug} aria-labelledby={`pl-${system.slug}`}>
            <h3
              id={`pl-${system.slug}`}
              // Sticks to the top edge of the dialog's scroller; its own ground covers the rows.
              className="sticky top-0 z-[1] mb-1.5 border-b border-line bg-surface-3 pb-2 pt-3 type-label uppercase text-ink-3"
            >
              {system.labelSr}
            </h3>
            <ul className="grid gap-x-3 gap-y-0.5 sm:grid-cols-2">
              {categories.map((c) => {
                const count = counts?.get(c.slug)?.productCount;
                return (
                  <li key={c.slug}>
                    <button
                      type="button"
                      onClick={() => choose(c.slug)}
                      aria-current={selected === c.slug ? "true" : undefined}
                      data-category={c.slug}
                      className="group flex min-h-13 w-full cursor-pointer items-center gap-3 rounded-sm p-1.5 pr-2 text-left transition-control hover:bg-surface-4 active:bg-surface-4 aria-[current=true]:bg-accent-subtle"
                    >
                      <ProductThumb
                        imageUrl={null}
                        categorySlug={c.slug}
                        alt=""
                        sizes="40px"
                        className="size-10 shrink-0 rounded-xs"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.9375rem] font-medium leading-snug text-ink-1">
                          {c.labelSr}
                        </span>
                        {/* The line is reserved, so the counts arrive without moving the rows. */}
                        <span className="block min-h-[1lh] type-caption text-ink-3">
                          {count !== undefined ? (
                            <>
                              {countSr(count, ARTICLE_FORMS)}
                              {c.instances.length === 0 ? ` · ${HERO_COPY.noMesh}` : ""}
                            </>
                          ) : null}
                        </span>
                      </span>
                      <CaretRightIcon
                        size={16}
                        aria-hidden="true"
                        className="shrink-0 text-ink-3 transition-control group-hover:text-accent"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
