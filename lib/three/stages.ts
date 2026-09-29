/**
 * Stage facts for the HTML overlays (captions, title block, parts list) from the taxonomy —
 * the same data the manifest is generated from, without shipping the manifest to the page.
 */
import { CATEGORIES, STAGES, SYSTEMS, type TaxonomyCategory } from "@/lib/catalog/taxonomy";

export type StageSummary = {
  stage: number;
  key: string;
  labelSr: string;
  categories: number;
  parts: number;
};

function instanceStage(c: TaxonomyCategory, i: TaxonomyCategory["instances"][number]): number | null {
  return i.stage ?? c.stage;
}

export const STAGE_SUMMARIES: readonly StageSummary[] = STAGES.map((s) => {
  let categories = 0;
  let parts = 0;
  for (const c of CATEGORIES) {
    const inStage = c.instances.filter((i) => instanceStage(c, i) === s.stage).length;
    if (inStage > 0) categories += 1;
    parts += inStage;
  }
  if (s.stage === 0) {
    categories = CATEGORIES.filter((c) => c.instances.length > 0).length;
    parts = CATEGORIES.reduce((n, c) => n + c.instances.length, 0);
  }
  return { stage: s.stage, key: s.key, labelSr: s.labelSr, categories, parts };
});

/** Stage whose end reveals a category (the latest stage among its nodes); null without mesh. */
export function categoryRevealStage(slug: string): number | null {
  const c = CATEGORIES.find((x) => x.slug === slug);
  if (!c || c.instances.length === 0) return null;
  return Math.max(...c.instances.map((i) => instanceStage(c, i) ?? 0));
}

/** Categories grouped by system in display order (parts list, SSR systems index). */
export const CATEGORIES_BY_SYSTEM = [...SYSTEMS]
  .sort((a, b) => a.order - b.order)
  .map((system) => ({
    system,
    categories: CATEGORIES.filter((c) => c.system === system.slug),
  }));

/** Slugs a `?deo=` deep link may open: the 44 taxonomy categories (contract F8). */
export function isPanelSlug(slug: string): boolean {
  return CATEGORIES.some((c) => c.slug === slug);
}

export const CATEGORY_COUNT = CATEGORIES.length;
export const LAST_STAGE_INDEX = STAGES[STAGES.length - 1]?.stage ?? 7;
