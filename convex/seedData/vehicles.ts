/**
 * Seed vehicles: VAG brands, models and generations sold in Serbia 1998–2025, common
 * engine codes. Everything here is „seed – proveriti“ (docs/HUMAN-TODO.md §6): years, VIN
 * model codes and engine codes must be confirmed by the owner before going live.
 *
 * `group` ties generations to the platform groups the demo fitments use.
 */

export type SeedBrand = {
  slug: string;
  name: string;
  aliases: string[];
  wmi: string[];
  sortOrder: number;
};

export type SeedGeneration = {
  slug: string;
  name: string;
  code?: string;
  vinModelCodes: string[];
  aliases: string[];
  yearFrom: number;
  yearTo?: number;
  platform?: string;
  group: PlatformGroup;
  engines: string[];
};

export type SeedModel = {
  brand: string;
  slug: string;
  name: string;
  aliases: string[];
  generations: SeedGeneration[];
};

export type SeedEngine = {
  slug: string;
  name: string;
  codes: string[];
  fuel: "benzin" | "dizel" | "hibrid" | "elektro" | "cng" | "lpg";
  displacementCc?: number;
  powerKw: number;
  powerHp: number;
};

export type PlatformGroup =
  | "pq34"
  | "pq35"
  | "mqb"
  | "mqb_evo"
  | "pq46"
  | "b5"
  | "pq25"
  | "mqb_a0"
  | "audi_b6b7"
  | "mlb"
  | "c6";

export const BRANDS: SeedBrand[] = [
  {
    slug: "volkswagen",
    name: "Volkswagen",
    aliases: ["vw", "volkswagen", "folksvagen", "folcvagen"],
    wmi: ["WVW", "WVG", "WV1", "WV2", "3VW", "1VW", "9BW"],
    sortOrder: 1,
  },
  {
    slug: "audi",
    name: "Audi",
    aliases: ["audi"],
    wmi: ["WAU", "WA1", "WUA", "TRU"],
    sortOrder: 2,
  },
  {
    slug: "skoda",
    name: "Škoda",
    aliases: ["skoda", "škoda", "scoda", "shkoda"],
    wmi: ["TMB", "XW8"],
    sortOrder: 3,
  },
  { slug: "seat", name: "SEAT", aliases: ["seat", "sead"], wmi: ["VSS"], sortOrder: 4 },
  { slug: "cupra", name: "Cupra", aliases: ["cupra", "kupra"], wmi: ["VSS"], sortOrder: 5 },
];

// prettier-ignore
export const ENGINES: SeedEngine[] = [
  { slug: "1-4-16v-55kw", name: "1.4 16V 55 kW", codes: ["AXP", "BCA"], fuel: "benzin", displacementCc: 1390, powerKw: 55, powerHp: 75 },
  { slug: "1-6-8v-75kw", name: "1.6 8V 75 kW", codes: ["AKL", "AVU", "BFQ", "BSE"], fuel: "benzin", displacementCc: 1595, powerKw: 75, powerHp: 102 },
  { slug: "1-8-t-110kw", name: "1.8 T 110 kW", codes: ["AGU", "ARZ", "AUM"], fuel: "benzin", displacementCc: 1781, powerKw: 110, powerHp: 150 },
  { slug: "1-2-htp-44kw", name: "1.2 HTP 44 kW", codes: ["AWY", "BMD"], fuel: "benzin", displacementCc: 1198, powerKw: 44, powerHp: 60 },
  { slug: "1-2-tsi-77kw", name: "1.2 TSI 77 kW", codes: ["CBZB"], fuel: "benzin", displacementCc: 1197, powerKw: 77, powerHp: 105 },
  { slug: "1-4-tsi-90kw", name: "1.4 TSI 90 kW", codes: ["CAXA"], fuel: "benzin", displacementCc: 1390, powerKw: 90, powerHp: 122 },
  { slug: "1-4-tsi-110kw", name: "1.4 TSI 110 kW", codes: ["CZDA"], fuel: "benzin", displacementCc: 1395, powerKw: 110, powerHp: 150 },
  { slug: "1-0-tsi-81kw", name: "1.0 TSI 81 kW", codes: ["CHZD", "DKLA"], fuel: "benzin", displacementCc: 999, powerKw: 81, powerHp: 110 },
  { slug: "1-5-tsi-110kw", name: "1.5 TSI 110 kW", codes: ["DADA", "DPCA"], fuel: "benzin", displacementCc: 1498, powerKw: 110, powerHp: 150 },
  { slug: "2-0-tfsi-147kw", name: "2.0 TFSI 147 kW", codes: ["BWA", "AXX"], fuel: "benzin", displacementCc: 1984, powerKw: 147, powerHp: 200 },
  { slug: "2-0-tsi-162kw", name: "2.0 TSI 162 kW", codes: ["CHHB"], fuel: "benzin", displacementCc: 1984, powerKw: 162, powerHp: 220 },
  { slug: "1-4-tdi-55kw", name: "1.4 TDI 55 kW", codes: ["AMF", "BNM"], fuel: "dizel", displacementCc: 1422, powerKw: 55, powerHp: 75 },
  { slug: "1-9-tdi-66kw", name: "1.9 TDI 66 kW", codes: ["ALH"], fuel: "dizel", displacementCc: 1896, powerKw: 66, powerHp: 90 },
  { slug: "1-9-tdi-74kw", name: "1.9 TDI 74 kW", codes: ["ATD", "AXR"], fuel: "dizel", displacementCc: 1896, powerKw: 74, powerHp: 100 },
  { slug: "1-9-tdi-77kw", name: "1.9 TDI 77 kW", codes: ["BKC", "BXE", "BLS"], fuel: "dizel", displacementCc: 1896, powerKw: 77, powerHp: 105 },
  { slug: "1-9-tdi-96kw", name: "1.9 TDI 96 kW", codes: ["ASZ", "AVF"], fuel: "dizel", displacementCc: 1896, powerKw: 96, powerHp: 130 },
  { slug: "2-0-tdi-103kw-pd", name: "2.0 TDI 103 kW (PD)", codes: ["BKD", "AZV", "BMM"], fuel: "dizel", displacementCc: 1968, powerKw: 103, powerHp: 140 },
  { slug: "1-2-tdi-55kw", name: "1.2 TDI 55 kW", codes: ["CFWA"], fuel: "dizel", displacementCc: 1199, powerKw: 55, powerHp: 75 },
  { slug: "1-6-tdi-77kw", name: "1.6 TDI 77 kW", codes: ["CAYC", "CLHA"], fuel: "dizel", displacementCc: 1598, powerKw: 77, powerHp: 105 },
  { slug: "2-0-tdi-103kw-cr", name: "2.0 TDI 103 kW (CR)", codes: ["CBAB", "CFFB"], fuel: "dizel", displacementCc: 1968, powerKw: 103, powerHp: 140 },
  { slug: "2-0-tdi-110kw", name: "2.0 TDI 110 kW", codes: ["CRLB", "DFGA"], fuel: "dizel", displacementCc: 1968, powerKw: 110, powerHp: 150 },
  { slug: "2-0-tdi-140kw", name: "2.0 TDI 140 kW", codes: ["CUAA", "DFHA"], fuel: "dizel", displacementCc: 1968, powerKw: 140, powerHp: 190 },
  { slug: "2-5-tdi-v6-132kw", name: "2.5 TDI V6 132 kW", codes: ["AKE", "BDH"], fuel: "dizel", displacementCc: 2496, powerKw: 132, powerHp: 180 },
  { slug: "2-7-tdi-132kw", name: "2.7 TDI 132 kW", codes: ["BPP", "CANK"], fuel: "dizel", displacementCc: 2698, powerKw: 132, powerHp: 180 },
  { slug: "3-0-tdi-171kw", name: "3.0 TDI 171 kW", codes: ["ASB", "BMK"], fuel: "dizel", displacementCc: 2967, powerKw: 171, powerHp: 233 },
];

const PQ34_ENGINES = [
  "1-4-16v-55kw",
  "1-6-8v-75kw",
  "1-8-t-110kw",
  "1-9-tdi-66kw",
  "1-9-tdi-74kw",
  "1-9-tdi-96kw",
];
const PQ35_ENGINES = [
  "1-4-tsi-90kw",
  "1-6-8v-75kw",
  "2-0-tfsi-147kw",
  "1-9-tdi-77kw",
  "2-0-tdi-103kw-pd",
  "1-6-tdi-77kw",
  "2-0-tdi-103kw-cr",
];
const MQB_ENGINES = [
  "1-2-tsi-77kw",
  "1-4-tsi-110kw",
  "1-0-tsi-81kw",
  "1-5-tsi-110kw",
  "2-0-tsi-162kw",
  "1-6-tdi-77kw",
  "2-0-tdi-110kw",
  "2-0-tdi-140kw",
];
const MQB_EVO_ENGINES = ["1-0-tsi-81kw", "1-5-tsi-110kw", "2-0-tsi-162kw", "2-0-tdi-110kw"];
const PQ46_ENGINES = [
  "1-4-tsi-90kw",
  "1-9-tdi-77kw",
  "2-0-tdi-103kw-pd",
  "2-0-tdi-103kw-cr",
  "1-6-tdi-77kw",
  "2-0-tfsi-147kw",
];
const B5_ENGINES = [
  "1-6-8v-75kw",
  "1-8-t-110kw",
  "1-9-tdi-74kw",
  "1-9-tdi-96kw",
  "2-5-tdi-v6-132kw",
];
const PQ25_ENGINES = [
  "1-2-htp-44kw",
  "1-4-16v-55kw",
  "1-2-tsi-77kw",
  "1-4-tdi-55kw",
  "1-2-tdi-55kw",
  "1-6-tdi-77kw",
  "1-9-tdi-74kw",
];
const MQB_A0_ENGINES = ["1-0-tsi-81kw", "1-5-tsi-110kw", "1-6-tdi-77kw"];
const AUDI_B6B7_ENGINES = [
  "1-8-t-110kw",
  "2-0-tfsi-147kw",
  "1-9-tdi-96kw",
  "2-0-tdi-103kw-pd",
  "2-5-tdi-v6-132kw",
];
const MLB_ENGINES = [
  "2-0-tdi-103kw-cr",
  "2-0-tdi-110kw",
  "2-0-tdi-140kw",
  "2-7-tdi-132kw",
  "3-0-tdi-171kw",
  "1-4-tsi-110kw",
];
const C6_ENGINES = ["2-0-tdi-103kw-pd", "2-7-tdi-132kw", "3-0-tdi-171kw", "2-0-tfsi-147kw"];

// prettier-ignore
export const MODELS: SeedModel[] = [
  { brand: "volkswagen", slug: "golf", name: "Golf", aliases: ["golf"], generations: [
    { slug: "golf-4", name: "Golf IV", code: "1J", vinModelCodes: ["1J"], aliases: ["golf 4", "golf iv", "mk4"], yearFrom: 1997, yearTo: 2006, platform: "PQ34", group: "pq34", engines: PQ34_ENGINES },
    { slug: "golf-5", name: "Golf V", code: "1K", vinModelCodes: ["1K"], aliases: ["golf 5", "golf v", "mk5"], yearFrom: 2003, yearTo: 2009, platform: "PQ35", group: "pq35", engines: PQ35_ENGINES },
    { slug: "golf-6", name: "Golf VI", code: "5K", vinModelCodes: ["1K", "5K"], aliases: ["golf 6", "golf vi", "mk6"], yearFrom: 2008, yearTo: 2013, platform: "PQ35", group: "pq35", engines: PQ35_ENGINES },
    { slug: "golf-7", name: "Golf VII", code: "5G", vinModelCodes: ["5G", "AU"], aliases: ["golf 7", "golf vii", "mk7"], yearFrom: 2012, yearTo: 2020, platform: "MQB", group: "mqb", engines: MQB_ENGINES },
    { slug: "golf-8", name: "Golf VIII", code: "CD", vinModelCodes: ["CD"], aliases: ["golf 8", "golf viii", "mk8"], yearFrom: 2019, platform: "MQB Evo", group: "mqb_evo", engines: MQB_EVO_ENGINES },
  ] },
  { brand: "volkswagen", slug: "passat", name: "Passat", aliases: ["passat", "pasat"], generations: [
    { slug: "passat-b5", name: "Passat B5", code: "3B", vinModelCodes: ["3B"], aliases: ["passat b5", "b5", "b5.5"], yearFrom: 1996, yearTo: 2005, platform: "B5", group: "b5", engines: B5_ENGINES },
    { slug: "passat-b6", name: "Passat B6", code: "3C", vinModelCodes: ["3C"], aliases: ["passat b6", "b6"], yearFrom: 2005, yearTo: 2010, platform: "PQ46", group: "pq46", engines: PQ46_ENGINES },
    { slug: "passat-b7", name: "Passat B7", code: "36", vinModelCodes: ["3C", "36"], aliases: ["passat b7", "b7"], yearFrom: 2010, yearTo: 2014, platform: "PQ46", group: "pq46", engines: PQ46_ENGINES },
    { slug: "passat-b8", name: "Passat B8", code: "3G", vinModelCodes: ["3G"], aliases: ["passat b8", "b8"], yearFrom: 2014, yearTo: 2023, platform: "MQB", group: "mqb", engines: MQB_ENGINES },
  ] },
  { brand: "volkswagen", slug: "polo", name: "Polo", aliases: ["polo"], generations: [
    { slug: "polo-4", name: "Polo IV", code: "9N", vinModelCodes: ["9N"], aliases: ["polo 4", "polo iv", "9n"], yearFrom: 2001, yearTo: 2009, platform: "PQ24", group: "pq25", engines: PQ25_ENGINES },
    { slug: "polo-5", name: "Polo V", code: "6R", vinModelCodes: ["6R", "6C"], aliases: ["polo 5", "polo v", "6r"], yearFrom: 2009, yearTo: 2017, platform: "PQ25", group: "pq25", engines: PQ25_ENGINES },
    { slug: "polo-6", name: "Polo VI", code: "AW", vinModelCodes: ["AW"], aliases: ["polo 6", "polo vi", "aw"], yearFrom: 2017, platform: "MQB A0", group: "mqb_a0", engines: MQB_A0_ENGINES },
  ] },
  { brand: "volkswagen", slug: "caddy", name: "Caddy", aliases: ["caddy", "kedi"], generations: [
    { slug: "caddy-3", name: "Caddy III", code: "2K", vinModelCodes: ["2K"], aliases: ["caddy 3", "caddy iii"], yearFrom: 2003, yearTo: 2020, platform: "PQ35", group: "pq35", engines: PQ35_ENGINES },
    { slug: "caddy-5", name: "Caddy V", code: "SB", vinModelCodes: ["SB"], aliases: ["caddy 5", "caddy v"], yearFrom: 2020, platform: "MQB Evo", group: "mqb_evo", engines: MQB_EVO_ENGINES },
  ] },
  { brand: "volkswagen", slug: "touran", name: "Touran", aliases: ["touran", "turan"], generations: [
    { slug: "touran-1", name: "Touran I", code: "1T", vinModelCodes: ["1T"], aliases: ["touran 1", "touran i"], yearFrom: 2003, yearTo: 2015, platform: "PQ35", group: "pq35", engines: PQ35_ENGINES },
    { slug: "touran-2", name: "Touran II", code: "5T", vinModelCodes: ["5T"], aliases: ["touran 2", "touran ii"], yearFrom: 2015, platform: "MQB", group: "mqb", engines: MQB_ENGINES },
  ] },
  { brand: "volkswagen", slug: "tiguan", name: "Tiguan", aliases: ["tiguan", "tigvan"], generations: [
    { slug: "tiguan-1", name: "Tiguan I", code: "5N", vinModelCodes: ["5N"], aliases: ["tiguan 1", "tiguan i"], yearFrom: 2007, yearTo: 2016, platform: "PQ35", group: "pq35", engines: PQ35_ENGINES },
    { slug: "tiguan-2", name: "Tiguan II", code: "AD", vinModelCodes: ["AD", "BW"], aliases: ["tiguan 2", "tiguan ii"], yearFrom: 2016, yearTo: 2024, platform: "MQB", group: "mqb", engines: MQB_ENGINES },
  ] },
  { brand: "audi", slug: "a3", name: "A3", aliases: ["a3"], generations: [
    { slug: "a3-8l", name: "A3 (8L)", code: "8L", vinModelCodes: ["8L"], aliases: ["a3 8l"], yearFrom: 1996, yearTo: 2003, platform: "PQ34", group: "pq34", engines: PQ34_ENGINES },
    { slug: "a3-8p", name: "A3 (8P)", code: "8P", vinModelCodes: ["8P"], aliases: ["a3 8p"], yearFrom: 2003, yearTo: 2013, platform: "PQ35", group: "pq35", engines: PQ35_ENGINES },
    { slug: "a3-8v", name: "A3 (8V)", code: "8V", vinModelCodes: ["8V"], aliases: ["a3 8v"], yearFrom: 2012, yearTo: 2020, platform: "MQB", group: "mqb", engines: MQB_ENGINES },
    { slug: "a3-8y", name: "A3 (8Y)", code: "8Y", vinModelCodes: ["8Y", "GY"], aliases: ["a3 8y"], yearFrom: 2020, platform: "MQB Evo", group: "mqb_evo", engines: MQB_EVO_ENGINES },
  ] },
  { brand: "audi", slug: "a4", name: "A4", aliases: ["a4"], generations: [
    { slug: "a4-b5", name: "A4 B5", code: "8D", vinModelCodes: ["8D"], aliases: ["a4 b5"], yearFrom: 1994, yearTo: 2001, platform: "B5", group: "b5", engines: B5_ENGINES },
    { slug: "a4-b6", name: "A4 B6", code: "8E", vinModelCodes: ["8E"], aliases: ["a4 b6"], yearFrom: 2000, yearTo: 2004, platform: "B6", group: "audi_b6b7", engines: AUDI_B6B7_ENGINES },
    { slug: "a4-b7", name: "A4 B7", code: "8E", vinModelCodes: ["8E", "8H"], aliases: ["a4 b7"], yearFrom: 2004, yearTo: 2008, platform: "B7", group: "audi_b6b7", engines: AUDI_B6B7_ENGINES },
    { slug: "a4-b8", name: "A4 B8", code: "8K", vinModelCodes: ["8K"], aliases: ["a4 b8"], yearFrom: 2007, yearTo: 2015, platform: "MLB", group: "mlb", engines: MLB_ENGINES },
    { slug: "a4-b9", name: "A4 B9", code: "8W", vinModelCodes: ["8W"], aliases: ["a4 b9"], yearFrom: 2015, platform: "MLB Evo", group: "mlb", engines: MLB_ENGINES },
  ] },
  { brand: "audi", slug: "a6", name: "A6", aliases: ["a6"], generations: [
    { slug: "a6-c5", name: "A6 C5", code: "4B", vinModelCodes: ["4B"], aliases: ["a6 c5"], yearFrom: 1997, yearTo: 2004, platform: "C5", group: "b5", engines: B5_ENGINES },
    { slug: "a6-c6", name: "A6 C6", code: "4F", vinModelCodes: ["4F"], aliases: ["a6 c6"], yearFrom: 2004, yearTo: 2011, platform: "C6", group: "c6", engines: C6_ENGINES },
    { slug: "a6-c7", name: "A6 C7", code: "4G", vinModelCodes: ["4G"], aliases: ["a6 c7"], yearFrom: 2011, yearTo: 2018, platform: "MLB", group: "mlb", engines: MLB_ENGINES },
    { slug: "a6-c8", name: "A6 C8", code: "4A", vinModelCodes: ["4A"], aliases: ["a6 c8"], yearFrom: 2018, platform: "MLB Evo", group: "mlb", engines: MLB_ENGINES },
  ] },
  { brand: "skoda", slug: "octavia", name: "Octavia", aliases: ["octavia", "oktavija", "oktavia"], generations: [
    { slug: "octavia-1", name: "Octavia I", code: "1U", vinModelCodes: ["1U"], aliases: ["octavia 1", "octavia i", "oktavija 1"], yearFrom: 1996, yearTo: 2010, platform: "PQ34", group: "pq34", engines: PQ34_ENGINES },
    { slug: "octavia-2", name: "Octavia II", code: "1Z", vinModelCodes: ["1Z"], aliases: ["octavia 2", "octavia ii", "oktavija 2"], yearFrom: 2004, yearTo: 2013, platform: "PQ35", group: "pq35", engines: PQ35_ENGINES },
    { slug: "octavia-3", name: "Octavia III", code: "5E", vinModelCodes: ["5E", "NE"], aliases: ["octavia 3", "octavia iii", "oktavija 3"], yearFrom: 2012, yearTo: 2020, platform: "MQB", group: "mqb", engines: MQB_ENGINES },
    { slug: "octavia-4", name: "Octavia IV", code: "NX", vinModelCodes: ["NX"], aliases: ["octavia 4", "octavia iv", "oktavija 4"], yearFrom: 2019, platform: "MQB Evo", group: "mqb_evo", engines: MQB_EVO_ENGINES },
  ] },
  { brand: "skoda", slug: "fabia", name: "Fabia", aliases: ["fabia", "fabija"], generations: [
    { slug: "fabia-1", name: "Fabia I", code: "6Y", vinModelCodes: ["6Y"], aliases: ["fabia 1", "fabia i"], yearFrom: 1999, yearTo: 2007, platform: "PQ24", group: "pq25", engines: PQ25_ENGINES },
    { slug: "fabia-2", name: "Fabia II", code: "5J", vinModelCodes: ["5J"], aliases: ["fabia 2", "fabia ii"], yearFrom: 2007, yearTo: 2014, platform: "PQ24", group: "pq25", engines: PQ25_ENGINES },
    { slug: "fabia-3", name: "Fabia III", code: "NJ", vinModelCodes: ["NJ"], aliases: ["fabia 3", "fabia iii"], yearFrom: 2014, yearTo: 2021, platform: "PQ26", group: "pq25", engines: PQ25_ENGINES },
    { slug: "fabia-4", name: "Fabia IV", code: "PJ", vinModelCodes: ["PJ"], aliases: ["fabia 4", "fabia iv"], yearFrom: 2021, platform: "MQB A0", group: "mqb_a0", engines: MQB_A0_ENGINES },
  ] },
  { brand: "skoda", slug: "superb", name: "Superb", aliases: ["superb", "superp"], generations: [
    { slug: "superb-1", name: "Superb I", code: "3U", vinModelCodes: ["3U"], aliases: ["superb 1", "superb i"], yearFrom: 2001, yearTo: 2008, platform: "B5", group: "b5", engines: B5_ENGINES },
    { slug: "superb-2", name: "Superb II", code: "3T", vinModelCodes: ["3T"], aliases: ["superb 2", "superb ii"], yearFrom: 2008, yearTo: 2015, platform: "PQ46", group: "pq46", engines: PQ46_ENGINES },
    { slug: "superb-3", name: "Superb III", code: "3V", vinModelCodes: ["3V"], aliases: ["superb 3", "superb iii"], yearFrom: 2015, yearTo: 2024, platform: "MQB", group: "mqb", engines: MQB_ENGINES },
  ] },
  { brand: "skoda", slug: "rapid", name: "Rapid", aliases: ["rapid"], generations: [
    { slug: "rapid", name: "Rapid", code: "NH", vinModelCodes: ["NH"], aliases: ["rapid", "rapid spaceback"], yearFrom: 2012, yearTo: 2019, platform: "PQ25", group: "pq25", engines: PQ25_ENGINES },
  ] },
  { brand: "skoda", slug: "kodiaq", name: "Kodiaq", aliases: ["kodiaq", "kodijak"], generations: [
    { slug: "kodiaq-1", name: "Kodiaq I", code: "NS", vinModelCodes: ["NS"], aliases: ["kodiaq", "kodiaq 1"], yearFrom: 2016, yearTo: 2024, platform: "MQB", group: "mqb", engines: MQB_ENGINES },
  ] },
  { brand: "skoda", slug: "karoq", name: "Karoq", aliases: ["karoq", "karok"], generations: [
    { slug: "karoq", name: "Karoq", code: "NU", vinModelCodes: ["NU"], aliases: ["karoq"], yearFrom: 2017, platform: "MQB", group: "mqb", engines: MQB_ENGINES },
  ] },
  { brand: "seat", slug: "leon", name: "Leon", aliases: ["leon"], generations: [
    { slug: "leon-1", name: "Leon I", code: "1M", vinModelCodes: ["1M"], aliases: ["leon 1", "leon i"], yearFrom: 1999, yearTo: 2005, platform: "PQ34", group: "pq34", engines: PQ34_ENGINES },
    { slug: "leon-2", name: "Leon II", code: "1P", vinModelCodes: ["1P"], aliases: ["leon 2", "leon ii"], yearFrom: 2005, yearTo: 2012, platform: "PQ35", group: "pq35", engines: PQ35_ENGINES },
    { slug: "leon-3", name: "Leon III", code: "5F", vinModelCodes: ["5F"], aliases: ["leon 3", "leon iii"], yearFrom: 2012, yearTo: 2020, platform: "MQB", group: "mqb", engines: MQB_ENGINES },
    { slug: "leon-4", name: "Leon IV", code: "KL", vinModelCodes: ["KL"], aliases: ["leon 4", "leon iv"], yearFrom: 2020, platform: "MQB Evo", group: "mqb_evo", engines: MQB_EVO_ENGINES },
  ] },
  { brand: "seat", slug: "ibiza", name: "Ibiza", aliases: ["ibiza", "ibica"], generations: [
    { slug: "ibiza-3", name: "Ibiza III", code: "6L", vinModelCodes: ["6L"], aliases: ["ibiza 3", "ibiza iii"], yearFrom: 2002, yearTo: 2008, platform: "PQ24", group: "pq25", engines: PQ25_ENGINES },
    { slug: "ibiza-4", name: "Ibiza IV", code: "6J", vinModelCodes: ["6J", "6P"], aliases: ["ibiza 4", "ibiza iv"], yearFrom: 2008, yearTo: 2017, platform: "PQ25", group: "pq25", engines: PQ25_ENGINES },
    { slug: "ibiza-5", name: "Ibiza V", code: "KJ", vinModelCodes: ["KJ"], aliases: ["ibiza 5", "ibiza v"], yearFrom: 2017, platform: "MQB A0", group: "mqb_a0", engines: MQB_A0_ENGINES },
  ] },
  { brand: "seat", slug: "ateca", name: "Ateca", aliases: ["ateca", "ateka"], generations: [
    { slug: "ateca", name: "Ateca", code: "KH", vinModelCodes: ["KH"], aliases: ["ateca"], yearFrom: 2016, platform: "MQB", group: "mqb", engines: MQB_ENGINES },
  ] },
  { brand: "cupra", slug: "formentor", name: "Formentor", aliases: ["formentor"], generations: [
    { slug: "formentor", name: "Formentor", code: "KM", vinModelCodes: ["KM"], aliases: ["formentor"], yearFrom: 2020, platform: "MQB Evo", group: "mqb_evo", engines: MQB_EVO_ENGINES },
  ] },
  { brand: "cupra", slug: "leon", name: "Leon", aliases: ["cupra leon"], generations: [
    { slug: "cupra-leon", name: "Leon (KL)", code: "KL", vinModelCodes: ["KL"], aliases: ["cupra leon"], yearFrom: 2020, platform: "MQB Evo", group: "mqb_evo", engines: MQB_EVO_ENGINES },
  ] },
  { brand: "cupra", slug: "ateca", name: "Ateca", aliases: ["cupra ateca"], generations: [
    { slug: "cupra-ateca", name: "Ateca", code: "KH", vinModelCodes: ["KH"], aliases: ["cupra ateca"], yearFrom: 2018, platform: "MQB", group: "mqb", engines: MQB_ENGINES },
  ] },
];
