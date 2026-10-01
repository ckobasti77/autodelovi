/** Serbian labels for the import and export screens (step 16). */
import type { BadgeTone } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/format/number";
import { pluralSr } from "@/lib/format/plural";

type Forms = readonly [one: string, few: string, other: string];

/**
 * „1 red“, „3 reda“, „1.250 redova“: grouped number + the Serbian plural form, joined by a
 * no-break space (QA FLOW-24). The forms may carry the agreeing verb („artikal se upisuje“).
 */
export function countImport(count: number, forms: Forms): string {
  return `${formatNumber(count)}\u00a0${pluralSr(count, forms)}`;
}

export const ROWS: Forms = ["red", "reda", "redova"];
export const CELLS: Forms = ["ćelija", "ćelije", "ćelija"];
export const IMAGES: Forms = ["slika", "slike", "slika"];

/** Dry-run summary hint: „1 red sa upozorenjem“, „3 reda sa upozorenjem“. */
export const rowsWithWarning = (n: number) => `${countImport(n, ROWS)} sa upozorenjem`;

/** „1 artikal se upisuje“, „2 artikla se upisuju“, „5 artikala se upisuje“. */
export const productsWritten = (n: number) =>
  countImport(n, ["artikal se upisuje", "artikla se upisuju", "artikala se upisuje"]);

/** „Biće deaktiviran 1 artikal“, „Biće deaktivirana 2 artikla“, „Biće deaktivirano 5 artikala“. */
export const productsToDeactivate = (n: number) =>
  `Biće ${pluralSr(n, ["deaktiviran", "deaktivirana", "deaktivirano"])} ${countImport(n, ["artikal", "artikla", "artikala"])}`;

/** „1 artikal nije vraćen“, „2 artikla nisu vraćena“, „5 artikala nije vraćeno“. */
export const productsNotRestored = (n: number) =>
  countImport(n, ["artikal nije vraćen", "artikla nisu vraćena", "artikala nije vraćeno"]);

export type ImportBatchStatus =
  | "staging"
  | "validated"
  | "committing"
  | "committed"
  | "failed"
  | "rolling_back"
  | "rolled_back"
  | "cancelled";

export const IMPORT_STATUS: Readonly<
  Record<ImportBatchStatus, { label: string; tone: BadgeTone }>
> = {
  staging: { label: "Priprema", tone: "neutral" },
  validated: { label: "Proveren, čeka upis", tone: "info" },
  committing: { label: "Upis u toku", tone: "accent" },
  committed: { label: "Uvezen", tone: "success" },
  failed: { label: "Prekinut", tone: "danger" },
  rolling_back: { label: "Poništavanje u toku", tone: "warning" },
  rolled_back: { label: "Poništen", tone: "neutral" },
  cancelled: { label: "Otkazan", tone: "neutral" },
};

export type RowActionKey = "create" | "update" | "unchanged" | "skip" | "error";

export const ROW_ACTION: Readonly<
  Record<RowActionKey, { label: string; plural: string; tone: BadgeTone }>
> = {
  create: { label: "Nov", plural: "Novi", tone: "success" },
  update: { label: "Izmena", plural: "Izmene", tone: "info" },
  unchanged: { label: "Bez promena", plural: "Bez promena", tone: "neutral" },
  skip: { label: "Preskočen", plural: "Preskočeni", tone: "neutral" },
  error: { label: "Greška", plural: "Greške", tone: "danger" },
};

export const IMPORT_MODE_LABEL = {
  full: "Pun uvoz",
  stock_price: "Samo lager i cene",
} as const;

export const COMMIT_PHASE_LABEL: Readonly<Record<string, string>> = {
  rows: "Upisujem redove",
  deactivate: "Deaktiviram artikle kojih nema u fajlu",
  finalize: "Završavam",
  done: "Završeno",
};

export const CONFIDENCE_LABEL = {
  exact: "tačno",
  alias: "sinonim",
  fuzzy: "slično",
  partial: "delimično",
} as const;

export const IMPORT_STEPS = [
  { id: "datoteka", label: "Datoteka" },
  { id: "kolone", label: "Kolone" },
  { id: "provera", label: "Provera" },
  { id: "probni", label: "Probni uvoz" },
  { id: "upis", label: "Upis" },
];
