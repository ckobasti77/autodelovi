// Demo content for the step 03 concept frames. Every value here is illustrative (DEMO) and never
// shipped: prices, stock and orders come from Convex from step 05 on.

export type Stock =
  | { kind: "in"; qty: number }
  | { kind: "low"; qty: number }
  | { kind: "order"; days: string }
  | { kind: "out" };

export type Fitment = "fits" | "engine" | "unknown";

export type DemoProduct = {
  id: string;
  art: "disc" | "pads" | "filter" | "turbo";
  quality: "Original VAG" | "OEM kvalitet" | "Aftermarket";
  maker: string;
  name: string;
  sku: string;
  oem: string;
  fitment: Fitment;
  stock: Stock;
  retail: number; // dinars, incl. PDV
  yours?: number; // approved mechanic price, dinars
  alternativesInStock?: number;
};

/** The vehicle chosen in the demo header (the concept shows fitment against it). */
export const demoVehicle = { short: "Golf VII · 2.0 TDI", full: "VW Golf VII 2.0 TDI (CRLB)" };

export const products: DemoProduct[] = [
  {
    id: "p1",
    art: "disc",
    quality: "OEM kvalitet",
    maker: "Brembo",
    name: "Kočioni disk prednji, Ø 312 mm, ventilirani",
    sku: "DEMO-10231",
    oem: "5Q0 615 301 F",
    fitment: "fits",
    stock: { kind: "in", qty: 4 },
    retail: 6990,
  },
  {
    id: "p2",
    art: "pads",
    quality: "OEM kvalitet",
    maker: "TRW",
    name: "Kočione pločice prednje, set za 2 točka",
    sku: "DEMO-10388",
    oem: "5Q0 698 151 B",
    fitment: "fits",
    stock: { kind: "low", qty: 2 },
    retail: 4290,
    yours: 3647,
  },
  {
    id: "p3",
    art: "turbo",
    quality: "Original VAG",
    maker: "Garrett",
    name: "Turbina 2.0 TDI, sa dihtunzima",
    sku: "DEMO-11902",
    oem: "04L 253 016 H",
    fitment: "engine",
    stock: { kind: "order", days: "3–5 dana" },
    retail: 89990,
  },
  {
    id: "p4",
    art: "filter",
    quality: "Aftermarket",
    maker: "Mann-Filter",
    name: "Filter ulja, uložak sa dihtungom",
    sku: "DEMO-12044",
    oem: "03N 115 562 B",
    fitment: "fits",
    stock: { kind: "out" },
    retail: 890,
    alternativesInStock: 2,
  },
];

export type OrderStatus = "nova" | "potvrdjena" | "spremna" | "poslata" | "ceka_deo" | "otkazana" | "isporucena";

export type DemoOrder = {
  prefix: string;
  seq: string;
  date: string;
  time: string;
  customer: string;
  company?: string;
  mechanic?: boolean;
  items: number;
  total: number;
  payment: string;
  delivery: string;
  status: OrderStatus;
  source: string;
};

export const orders: DemoOrder[] = [
  { prefix: "SK-2026-", seq: "000187", date: "29.09.", time: "11:42", customer: "Nikola Stanković", company: "Auto servis Stanković", mechanic: true, items: 3, total: 18470, payment: "Odloženo", delivery: "Kurir", status: "nova", source: "Google Ads" },
  { prefix: "SK-2026-", seq: "000186", date: "29.09.", time: "10:05", customer: "Jelena Marković", items: 1, total: 4290, payment: "Pouzeće", delivery: "Kurir", status: "potvrdjena", source: "Meta" },
  { prefix: "SK-2026-", seq: "000185", date: "28.09.", time: "17:51", customer: "Dragan Ilić", items: 2, total: 12980, payment: "Pri preuzimanju", delivery: "Lično", status: "spremna", source: "Direktno" },
  { prefix: "SK-2026-", seq: "000184", date: "28.09.", time: "14:20", customer: "Vesna Kovačević", company: "Kovačević Servis d.o.o.", mechanic: true, items: 6, total: 46320, payment: "Virman", delivery: "Kurir", status: "poslata", source: "Google" },
  { prefix: "SK-2026-", seq: "000183", date: "27.09.", time: "09:12", customer: "Marko Pavlović", items: 1, total: 89990, payment: "Pouzeće", delivery: "Kurir", status: "ceka_deo", source: "Direktno" },
  { prefix: "SK-2026-", seq: "000182", date: "26.09.", time: "18:40", customer: "Ana Jovanović", items: 2, total: 1780, payment: "Pouzeće", delivery: "Kurir", status: "otkazana", source: "Meta" },
  { prefix: "SK-2026-", seq: "000181", date: "26.09.", time: "12:03", customer: "Stefan Đorđević", items: 4, total: 21560, payment: "Pouzeće", delivery: "Kurir", status: "isporucena", source: "Google Ads" },
];

/** `12.990 RSD` style: dot thousands, no decimals when whole (docs: formatRSD). */
export const rsd = (dinars: number) => dinars.toLocaleString("sr-Latn-RS");
