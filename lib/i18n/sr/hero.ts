/**
 * Copy for the 3D hero (DESIGN-SYSTEM §7.7, §9.10, §11). Serbian Latin, ekavian; one place so
 * a second locale can replace it later. Stage keys match `lib/catalog/taxonomy.ts` STAGES.
 */

import type { SystemSlug } from "@/lib/catalog/taxonomy";

/** Short system names for the navigator chips (the full name stays the accessible name). */
export const SYSTEM_SHORT: Readonly<Record<SystemSlug, string>> = {
  karoserija: "Karoserija",
  "elektrika-i-svetla": "Elektrika",
  tockovi: "Točkovi",
  kocnice: "Kočnice",
  "vesanje-i-upravljanje": "Vešanje",
  "hladjenje-i-klima": "Hlađenje",
  "motor-i-usis": "Motor",
  transmisija: "Transmisija",
  "izduvni-sistem": "Izduv",
  servis: "Servis",
};

/**
 * Slot names that do not fit two lines in a narrow column (below 1440 px). Each is the start
 * of the category's full name (WCAG 2.5.3 — the full name stays the link's accessible name);
 * a unit test checks it.
 */
export const SLOT_LABEL_SHORT: Readonly<Record<string, string>> = {
  senzori: "Senzori",
  "usisna-grana": "Usisna grana",
  "kais-alternatora": "Kaiš alternatora",
  turbina: "Turbina",
  "brizgaljke-pumpa-goriva": "Brizgaljke",
  "zupcasti-kais-vodena-pumpa": "Set zupčastog kaiša",
  "karter-dihtunzi": "Karter, pumpa ulja",
  "termostat-creva": "Termostat i creva",
  poluosovine: "Poluosovine",
  auspuh: "Auspuh",
  klima: "Kompresor i kondenzator",
};

const kategorija = (n: number) => {
  const last = n % 10;
  const tens = n % 100;
  if (last === 1 && tens !== 11) return "kategorija";
  if (last >= 2 && last <= 4 && (tens < 12 || tens > 14)) return "kategorije";
  return "kategorija";
};

export const HERO_COPY = {
  honesty: "Generički kompaktni hečbek, nije konkretan model",
  canvasLabel:
    "Interaktivni 3D prikaz automobila u rendgen stilu. Delovi su nabrojani u mreži pored prikaza.",
  loading: "Učitava se 3D prikaz",
  loaded: "3D prikaz je spreman",
  partsList: "Lista delova",
  partsListTitle: "Lista delova po sistemima",
  partsListDescription: "Izaberite kategoriju — otvara se ista lista artikala kao klikom na deo.",
  /** After the live count in the hover callout: „12 artikala · kliknite na deo“. */
  calloutHint: "kliknite na deo",
  /** Parts list: a category that exists in the catalogue but has no mesh on the car. */
  noMesh: "bez 3D prikaza",
  titleBlockView: "Prikaz",
  titleBlockSystems: "Sistemi",
  titleBlockCategories: "Kategorije",
  systemsSection: "Delovi po sistemima",
  /** The assembled car, before the first page. */
  introTitle: "Sklopljen automobil",
  introCounts: (systems: number, categories: number) =>
    `${systems} sistema · ${categories} ${kategorija(categories)}`,
  introSentence: "Skrolujte: delovi izlaze iz auta i ređaju se po sistemima.",
  introSentenceStatic: "Izaberite sistem ispod: delovi se ređaju u mrežu.",
  /** Grid and navigator. */
  skip: "Preskoči 3D prikaz",
  gridLabel: "Delovi automobila po sistemima",
  navLabel: "Sistemi vozila",
  found: "Pronađeno",
  chipShown: "prikazano",
  chipDone: "pronađeno",
  chipName: (system: string, count: number, state: string) =>
    [system, `${count} ${kategorija(count)}`, state].filter(Boolean).join(", "),
  pageAnnounce: (systems: readonly string[], count: number) =>
    `${systems.join(", ")} — ${count} ${kategorija(count)}`,
  /** End state. */
  endTitle: "Ceo auto rastavljen",
  endSentence: "Sve kategorije su na stolu. Izaberite vozilo i videćete delove koji mu odgovaraju.",
  endVehicle: "Izaberite vozilo",
  endAll: "Svi delovi",
  endAssemble: "Sklopi auto",
} as const;

export const PANEL_COPY = {
  close: "Zatvori",
  loading: "Učitavaju se artikli",
  chooseVehicle: "Izaberite vozilo za tačno poklapanje",
  changeVehicle: "Promeni vozilo",
  empty: "U ovoj kategoriji trenutno nema delova na stanju.",
  emptyForVehicle: (vehicle: string) => `Za ${vehicle} trenutno nemamo delove iz ove kategorije.`,
  inquiry: "Pošaljite upit",
  error: "Artikli trenutno nisu dostupni. Pokušajte ponovo ili nas pozovite.",
  retry: "Pokušaj ponovo",
  allParts: "Svi delovi",
  inStock: (count: number) => `${count} na stanju`,
  listLabel: (category: string) => `Artikli: ${category}`,
  addToCart: "Dodaj u korpu",
  /** Visible label of a row button (the storefront card says the same). */
  addShort: "U korpu",
  backorder: "Poruči",
  added: "Dodato",
  addedToast: (name: string) => `Dodato u korpu: ${name}.`,
  viewCart: "Pogledaj korpu",
  priceOnRequest: "Cena na upit",
  signInForPrice: "Prijavite se za cenu",
  fits: (vehicle: string) => `Odgovara za ${vehicle}`,
  generationOnly: (vehicle: string) => `Odgovara za ${vehicle} — proverite motor`,
  universal: "Univerzalni deo",
  unknownFit: "Kompatibilnost nije potvrđena",
  mismatch: (count: string) => `${count} bez potvrđene kompatibilnosti — prikazani su na kraju`,
} as const;
