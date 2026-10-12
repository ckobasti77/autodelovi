/**
 * Copy for the 3D hero (DESIGN-SYSTEM §7.7, §9.10, §11). Serbian Latin, ekavian; one place so
 * a second locale can replace it later. Stage keys match `lib/catalog/taxonomy.ts` STAGES.
 */

/** Short stage names for the stage index (00–07); captions use the full taxonomy label. */
export const STAGE_SHORT: Readonly<Record<string, string>> = {
  sklopljeno: "Sklopljeno",
  karoserija: "Karoserija i svetla",
  tockovi: "Točkovi",
  "kocnice-vesanje": "Kočnice i vešanje",
  agregati: "Agregati i hlađenje",
  motor: "Motor i turbina",
  transmisija: "Menjač i kvačilo",
  izduvni: "Izduvni sistem",
};

/** One sentence per stage caption (body-s, ink-2). */
export const STAGE_SENTENCE: Readonly<Record<string, string>> = {
  sklopljeno: "Skrolujte i auto se rasklapa po sistemima.",
  karoserija: "Prvo se skidaju limarija, stakla i svetla.",
  tockovi: "Točkovi se skidaju sa glavčina.",
  "kocnice-vesanje": "Ispod su diskovi, čeljusti, pločice, amortizeri, ramena i letva volana.",
  agregati: "Hladnjak, interkuler, klima, alternator, anlaser i akumulator.",
  motor: "Motor sa turbinom, brizgaljkama, paljenjem i setom zupčastog kaiša.",
  transmisija: "Menjač, kvačilo sa zamajcem i poluosovine.",
  izduvni: "Na kraju izduvni sistem: DPF, katalizator, lonci i cevi.",
};

export const HERO_COPY = {
  honesty: "Generički kompaktni hečbek, nije konkretan model",
  canvasLabel:
    "Interaktivni 3D prikaz automobila u rendgen stilu. Delove birate mišem, dodirom ili iz liste delova.",
  loading: "Učitava se 3D prikaz",
  loaded: "3D prikaz je spreman",
  explode: "Rasklopi",
  assemble: "Sklopi",
  partsList: "Lista delova",
  partsListTitle: "Lista delova po sistemima",
  partsListDescription: "Izaberite kategoriju — otvara se ista lista artikala kao klikom na deo.",
  holdHintPointer: "Kliknite na deo",
  holdHintTouch: "Dodirnite deo",
  holdHintSub: "ili otvorite listu delova",
  /** After the live count in the hover callout: „12 artikala · kliknite na deo“. */
  calloutHint: "kliknite na deo",
  /** Parts list: a category that exists in the catalogue but has no mesh on the car. */
  noMesh: "bez 3D prikaza",
  stageNavLabel: "Faze rasklapanja",
  prevStage: "Prethodna faza",
  nextStage: "Sledeća faza",
  titleBlockView: "Prikaz",
  titleBlockStage: "Faza",
  titleBlockCategories: "Kategorije",
  titleBlockUnits: "Mere",
  systemsSection: "Delovi po sistemima",
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
