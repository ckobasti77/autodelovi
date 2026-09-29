import { decodeModelYear, modelYearCandidates, type DecodeModelYearOptions } from "./modelYear";
import { vagModelCode, vagModelHint, type VagModelHint } from "./vagModelCodes";
import { normalizeVin, validateVin, type VinValidation } from "./validate";
import { decodeWmi, type WmiInfo } from "./wmi";

export * from "./modelYear";
export * from "./vagModelCodes";
export * from "./validate";
export * from "./wmi";

export type DecodedVin = {
  normalized: string;
  validation: VinValidation;
  wmi: WmiInfo;
  /** Resolved model year (hint), see `decodeModelYear`. */
  modelYear: number | null;
  modelYearCandidates: number[];
  /** VAG positions 7–8, e.g. `1K`. */
  modelCode: string | null;
  /** Known model for `modelCode` (hint for the vehicle picker). */
  model: VagModelHint | null;
};

/** Everything the VIN field can tell the customer and the vehicle picker. */
export function decodeVin(input: string, opts: DecodeModelYearOptions = {}): DecodedVin {
  const normalized = normalizeVin(input);
  return {
    normalized,
    validation: validateVin(normalized),
    wmi: decodeWmi(normalized),
    modelYear: decodeModelYear(normalized, opts),
    modelYearCandidates: modelYearCandidates(normalized),
    modelCode: vagModelCode(normalized),
    model: vagModelHint(normalized),
  };
}
