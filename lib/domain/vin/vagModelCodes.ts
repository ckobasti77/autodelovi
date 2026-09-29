/**
 * VAG model code from VIN positions 7–8 (e.g. `WVWZZZ1KZ8W000001` → `1K`).
 *
 * European VAG VINs fill positions 4–6 with `ZZZ` and keep the model code in 7–8. Škoda
 * (`TMB`) encodes body/engine in 4–6 instead of `ZZZ` but keeps the model code in 7–8, so it
 * is accepted without `ZZZ`. The result is a **hint** for the vehicle picker, never a fact:
 * the owner confirms model and generation.
 */
import { normalizeVin } from "./validate";
import { decodeWmi, type VagMake } from "./wmi";

export type VagModelHint = { code: string; make: VagMake; model: string };

/** Deliberately small: only codes we are confident about. */
export const vagModelCodes: Readonly<Record<string, Omit<VagModelHint, "code">>> = {
  // Volkswagen
  "1K": { make: "Volkswagen", model: "Golf V / Golf VI, Jetta" },
  "5K": { make: "Volkswagen", model: "Golf VI" },
  "5G": { make: "Volkswagen", model: "Golf VII" },
  AU: { make: "Volkswagen", model: "Golf VII" },
  CD: { make: "Volkswagen", model: "Golf VIII" },
  "3C": { make: "Volkswagen", model: "Passat B6 / B7" },
  "3G": { make: "Volkswagen", model: "Passat B8" },
  "5N": { make: "Volkswagen", model: "Tiguan" },
  "6R": { make: "Volkswagen", model: "Polo V" },
  "6C": { make: "Volkswagen", model: "Polo V (facelift)" },
  AW: { make: "Volkswagen", model: "Polo VI" },
  "1T": { make: "Volkswagen", model: "Touran I" },
  "7N": { make: "Volkswagen", model: "Sharan II" },
  // Audi
  "8P": { make: "Audi", model: "A3 (8P)" },
  "8V": { make: "Audi", model: "A3 (8V)" },
  "8K": { make: "Audi", model: "A4 B8" },
  "8W": { make: "Audi", model: "A4 B9" },
  "4F": { make: "Audi", model: "A6 C6" },
  "4G": { make: "Audi", model: "A6 C7" },
  // Škoda
  "1Z": { make: "Škoda", model: "Octavia II" },
  "5E": { make: "Škoda", model: "Octavia III" },
  NE: { make: "Škoda", model: "Octavia III" },
  NX: { make: "Škoda", model: "Octavia IV" },
  "3T": { make: "Škoda", model: "Superb II" },
  "3V": { make: "Škoda", model: "Superb III" },
  "5J": { make: "Škoda", model: "Fabia II" },
  NJ: { make: "Škoda", model: "Fabia III" },
  // SEAT / Cupra
  "1P": { make: "SEAT", model: "Leon II" },
  "5F": { make: "SEAT", model: "Leon III" },
  KL: { make: "SEAT", model: "Leon IV (SEAT / Cupra)" },
  "6J": { make: "SEAT", model: "Ibiza IV" },
  KJ: { make: "SEAT", model: "Ibiza V" },
};

/** Positions 7–8 of a European VAG VIN, or `null` when the VIN does not carry one. */
export function vagModelCode(vin: string): string | null {
  const normalized = normalizeVin(vin);
  if (normalized.length < 8) return null;
  const { isVag, make } = decodeWmi(normalized);
  if (!isVag) return null;
  const hasFiller = normalized.slice(3, 6) === "ZZZ";
  if (!hasFiller && !(make === "Škoda" && normalized.startsWith("TMB"))) return null;
  const code = normalized.slice(6, 8);
  return /^[A-Z0-9]{2}$/.test(code) ? code : null;
}

const sameBrand = (a: VagMake, b: VagMake) =>
  a === b || ((a === "SEAT" || a === "Cupra") && (b === "SEAT" || b === "Cupra"));

/** Known model for the VIN's code, only when it belongs to the WMI's brand. */
export function vagModelHint(vin: string): VagModelHint | null {
  const code = vagModelCode(vin);
  if (!code) return null;
  const entry = vagModelCodes[code];
  const { make } = decodeWmi(vin);
  if (!entry || !make || !sameBrand(entry.make, make)) return null;
  return { code, ...entry };
}
