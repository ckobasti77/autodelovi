/** Small reference data for the import unit tests (mirrors the seed naming). */
import { buildVehicleIndex, type VehicleRef } from "@/lib/import/fitmentText";
import type { RefCategory, RefManufacturer, RowContext } from "@/lib/import/row";

export const VEHICLES: VehicleRef = {
  brands: [
    { id: "b-vw", name: "Volkswagen", aliases: ["vw", "volkswagen"] },
    { id: "b-audi", name: "Audi", aliases: ["audi"] },
    { id: "b-skoda", name: "Škoda", aliases: ["skoda", "škoda"] },
  ],
  models: [
    { id: "m-golf", brandId: "b-vw", name: "Golf", aliases: ["golf"] },
    { id: "m-passat", brandId: "b-vw", name: "Passat", aliases: ["passat"] },
    { id: "m-a4", brandId: "b-audi", name: "A4", aliases: ["a4"] },
    { id: "m-octavia", brandId: "b-skoda", name: "Octavia", aliases: ["octavia", "oktavija"] },
  ],
  generations: [
    { id: "g-golf7", brandId: "b-vw", modelId: "m-golf", name: "Golf VII", aliases: ["golf 7", "golf vii", "mk7"], yearFrom: 2012, yearTo: 2020 },
    { id: "g-golf8", brandId: "b-vw", modelId: "m-golf", name: "Golf VIII", aliases: ["golf 8", "golf viii"], yearFrom: 2019 },
    { id: "g-passatb6", brandId: "b-vw", modelId: "m-passat", name: "Passat B6", aliases: ["passat b6", "b6"], yearFrom: 2005, yearTo: 2010 },
    { id: "g-a4b6", brandId: "b-audi", modelId: "m-a4", name: "A4 B6", aliases: ["a4 b6"], yearFrom: 2000, yearTo: 2004 },
    { id: "g-a4b8", brandId: "b-audi", modelId: "m-a4", name: "A4 B8", aliases: ["a4 b8"], yearFrom: 2007, yearTo: 2015 },
    { id: "g-oct3", brandId: "b-skoda", modelId: "m-octavia", name: "Octavia III", aliases: ["octavia 3", "octavia iii", "oktavija 3"], yearFrom: 2012, yearTo: 2020 },
  ],
  engines: [
    { id: "e-20tdi110", name: "2.0 TDI 110 kW", codes: ["CRLB", "DFGA"] },
    { id: "e-16tdi77", name: "1.6 TDI 77 kW", codes: ["CAYC", "CLHA"] },
    { id: "e-20tdi103pd", name: "2.0 TDI 103 kW (PD)", codes: ["BKD", "AZV"] },
    { id: "e-20tdi103cr", name: "2.0 TDI 103 kW (CR)", codes: ["CBAB"] },
    { id: "e-14tsi90", name: "1.4 TSI 90 kW", codes: ["CAXA"] },
  ],
  links: [
    { generationId: "g-golf7", engineId: "e-20tdi110" },
    { generationId: "g-golf7", engineId: "e-16tdi77" },
    { generationId: "g-oct3", engineId: "e-20tdi110" },
    { generationId: "g-oct3", engineId: "e-16tdi77" },
    { generationId: "g-passatb6", engineId: "e-20tdi103pd" },
    { generationId: "g-passatb6", engineId: "e-20tdi103cr" },
    { generationId: "g-passatb6", engineId: "e-14tsi90" },
    { generationId: "g-a4b8", engineId: "e-20tdi103cr" },
  ],
};

export const CATEGORIES: RefCategory[] = [
  { id: "c-disk", name: "Kočioni diskovi", slug: "kocioni-diskovi", parentName: "Kočnice" },
  { id: "c-plocice", name: "Kočione pločice", slug: "kocione-plocice", parentName: "Kočnice" },
  { id: "c-filter-ulja", name: "Filter ulja", slug: "filter-ulja", parentName: "Filteri" },
  { id: "c-filter-vazduha", name: "Filter vazduha", slug: "filter-vazduha", parentName: "Filteri" },
  { id: "c-senzori-a", name: "Senzori", slug: "senzori-motor", parentName: "Motor" },
  { id: "c-senzori-b", name: "Senzori", slug: "senzori-elektrika", parentName: "Elektrika" },
];

export const MANUFACTURERS: RefManufacturer[] = [
  { id: "mf-ate", name: "ATE", slug: "ate", aliases: ["ate"] },
  { id: "mf-febi", name: "Febi Bilstein", slug: "febi-bilstein", aliases: ["febi"] },
  { id: "mf-vag", name: "VAG", slug: "vag", aliases: ["vw original"] },
];

export function context(overrides: Partial<RowContext> = {}): RowContext {
  return {
    mode: "full",
    numberFormat: "sr",
    warnAmbiguous: false,
    vatRateBp: 2000,
    categories: CATEGORIES,
    manufacturers: MANUFACTURERS,
    vehicles: buildVehicleIndex(VEHICLES),
    ...overrides,
  };
}
