/** Serbian labels for the import and export screens (step 16). */
import type { BadgeTone } from "@/components/ui/Badge";

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
