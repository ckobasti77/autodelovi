/**
 * World Manufacturer Identifier (VIN positions 1–3) for the Volkswagen group.
 * Only codes we are sure about; anything else decodes to `make: null`.
 */
import { normalizeVin } from "./validate";

export type VagMake = "Volkswagen" | "Audi" | "Škoda" | "SEAT" | "Cupra" | "Porsche";

export type WmiInfo = {
  wmi: string;
  /** Short Serbian description of the manufacturer / plant. */
  manufacturer: string | null;
  make: VagMake | null;
  isVag: boolean;
  note?: string;
};

type WmiEntry = { manufacturer: string; make: VagMake; note?: string };

const OUTSIDE_EU = "Vozilo sa vanevropskog tržišta — oprema i kodovi delova mogu se razlikovati.";

export const VAG_WMI: Readonly<Record<string, WmiEntry>> = {
  WVW: { manufacturer: "Volkswagen, putnička vozila (Nemačka)", make: "Volkswagen" },
  WVG: { manufacturer: "Volkswagen, SUV i terenska vozila", make: "Volkswagen" },
  WV1: { manufacturer: "Volkswagen Gospodarska vozila — komercijalna", make: "Volkswagen" },
  WV2: { manufacturer: "Volkswagen Gospodarska vozila — kombi/bus", make: "Volkswagen" },
  WV3: { manufacturer: "Volkswagen, kamioni", make: "Volkswagen" },
  WAU: { manufacturer: "Audi", make: "Audi" },
  WA1: { manufacturer: "Audi, SUV", make: "Audi" },
  WUA: { manufacturer: "Audi Sport GmbH (quattro GmbH)", make: "Audi" },
  TRU: { manufacturer: "Audi, fabrika u Mađarskoj", make: "Audi" },
  TMB: { manufacturer: "Škoda Auto (Češka)", make: "Škoda" },
  TMP: {
    manufacturer: "Škoda",
    make: "Škoda",
    note: "Retka oznaka — marku i model potvrdite u saobraćajnoj dozvoli.",
  },
  VSS: {
    manufacturer: "SEAT / Cupra (Španija)",
    make: "SEAT",
    note: "Ista oznaka za SEAT i Cupra — marku potvrdite po modelu.",
  },
  "1VW": { manufacturer: "Volkswagen, SAD", make: "Volkswagen", note: OUTSIDE_EU },
  "3VW": { manufacturer: "Volkswagen, Meksiko", make: "Volkswagen", note: OUTSIDE_EU },
  "9BW": { manufacturer: "Volkswagen, Brazil", make: "Volkswagen", note: OUTSIDE_EU },
  AAV: { manufacturer: "Volkswagen, Južna Afrika", make: "Volkswagen", note: OUTSIDE_EU },
  LSV: { manufacturer: "SAIC Volkswagen, Kina", make: "Volkswagen", note: OUTSIDE_EU },
  LFV: { manufacturer: "FAW-Volkswagen, Kina", make: "Volkswagen", note: OUTSIDE_EU },
  XW8: { manufacturer: "Volkswagen Group Rus", make: "Volkswagen", note: OUTSIDE_EU },
  WP0: { manufacturer: "Porsche, putnička vozila", make: "Porsche" },
  WP1: { manufacturer: "Porsche, SUV", make: "Porsche" },
};

export function decodeWmi(vin: string): WmiInfo {
  const wmi = normalizeVin(vin).slice(0, 3);
  const entry = wmi.length === 3 ? VAG_WMI[wmi] : undefined;
  if (!entry) return { wmi, manufacturer: null, make: null, isVag: false };
  const info: WmiInfo = { wmi, manufacturer: entry.manufacturer, make: entry.make, isVag: true };
  if (entry.note) info.note = entry.note;
  return info;
}
