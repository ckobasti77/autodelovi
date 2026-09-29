/**
 * Fitment check — product vs. selected vehicle (docs/ARCHITECTURE.md §E9). Pure.
 *
 * fits            a fitment matches the generation, has no engine restriction or the same
 *                 engine, and the year (if both known) is inside its range;
 * generation_only the generation matches but the engine is not selected while the fitment
 *                 names one (engine unverified);
 * universal       the product fits every vehicle (oils by spec, universal wipers …);
 * unknown         nothing matches.
 */

export type FitmentRow = {
  generationId: string;
  engineId?: string;
  yearFrom?: number;
  yearTo?: number;
};

export type SelectedVehicle = {
  generationId?: string;
  engineId?: string;
  year?: number;
};

export type FitStatus = "fits" | "generation_only" | "universal" | "unknown";

function yearOk(row: FitmentRow, year: number | undefined): boolean {
  if (year === undefined) return true;
  if (row.yearFrom !== undefined && year < row.yearFrom) return false;
  if (row.yearTo !== undefined && year > row.yearTo) return false;
  return true;
}

export function fitStatus(
  rows: readonly FitmentRow[],
  vehicle: SelectedVehicle,
  universal: boolean,
): FitStatus {
  if (!vehicle.generationId) return universal ? "universal" : "unknown";
  let generationOnly = false;
  for (const row of rows) {
    if (row.generationId !== vehicle.generationId || !yearOk(row, vehicle.year)) continue;
    if (!row.engineId) return "fits";
    if (vehicle.engineId === undefined) generationOnly = true;
    else if (row.engineId === vehicle.engineId) return "fits";
  }
  if (generationOnly) return "generation_only";
  return universal ? "universal" : "unknown";
}

/** Sort rank: exact fit first, then universal, then unverified engine, then unknown. */
export const FIT_RANK: Readonly<Record<FitStatus, number>> = {
  fits: 0,
  universal: 1,
  generation_only: 2,
  unknown: 3,
};
