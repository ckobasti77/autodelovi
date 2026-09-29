/**
 * ~150 DEMO products (`DEMO-` SKUs, `isDemo: true`). Prices are plausible retail prices in
 * RSD incl. PDV; OEM numbers follow the VAG format (prefix · group · part · suffix) but are
 * GENERATED and marked „VAG (demo)“ — they are not real part numbers. Cross numbers imitate
 * each manufacturer's format and are equally fictional. Deterministic: same output every run.
 */
import type { PlatformGroup } from "./vehicles";

type Spec = [label: string, value: string, unit?: string];

type Row = [
  category: string,
  name: string,
  manufacturer: string,
  priceDin: number,
  fits: PlatformGroup[] | "universal" | { gens: string[] },
  opts?: {
    engines?: string[];
    specs?: Spec[];
    quality?: "original" | "oem" | "aftermarket";
    enginePrefix?: string;
    note?: string;
  },
];

const ALL: PlatformGroup[] = [
  "pq34",
  "pq35",
  "mqb",
  "mqb_evo",
  "pq46",
  "b5",
  "pq25",
  "mqb_a0",
  "audi_b6b7",
  "mlb",
  "c6",
];
const TDI_PD = ["1-9-tdi-66kw", "1-9-tdi-74kw", "1-9-tdi-77kw", "1-9-tdi-96kw", "2-0-tdi-103kw-pd"];
const TDI_CR = ["1-6-tdi-77kw", "2-0-tdi-103kw-cr", "2-0-tdi-110kw", "2-0-tdi-140kw"];
const TSI_EA211 = ["1-2-tsi-77kw", "1-4-tsi-110kw", "1-0-tsi-81kw", "1-5-tsi-110kw"];

// prettier-ignore
const ROWS: Row[] = [
  // Kočnice
  ["kocioni-diskovi", "Kočioni disk prednji 288 × 25 mm, ventilirani", "ate", 5_490, ["pq35", "pq34"], { specs: [["Prečnik", "288", "mm"], ["Debljina", "25", "mm"], ["Tip", "ventilirani"]] }],
  ["kocioni-diskovi", "Kočioni disk prednji 312 × 25 mm, ventilirani", "brembo", 7_290, ["pq35", "mqb"], { specs: [["Prečnik", "312", "mm"], ["Debljina", "25", "mm"], ["Tip", "ventilirani"]] }],
  ["kocioni-diskovi", "Kočioni disk zadnji 272 × 10 mm, puni", "trw", 3_890, ["pq35", "mqb"], { specs: [["Prečnik", "272", "mm"], ["Debljina", "10", "mm"], ["Tip", "puni"]] }],
  ["kocioni-diskovi", "Kočioni disk prednji 276 × 24 mm", "febi-bilstein", 4_690, ["mqb", "mqb_a0"], { specs: [["Prečnik", "276", "mm"], ["Debljina", "24", "mm"]] }],
  ["kocioni-diskovi", "Kočioni disk prednji 340 × 30 mm, GTI", "original-vag", 18_900, ["mqb", "mqb_evo"], { specs: [["Prečnik", "340", "mm"], ["Debljina", "30", "mm"]] }],
  ["kocioni-diskovi", "Kočioni disk prednji 256 × 22 mm", "bosch", 3_990, ["pq25"], { specs: [["Prečnik", "256", "mm"], ["Debljina", "22", "mm"]] }],
  ["kocioni-diskovi", "Kočioni disk prednji 312 × 25 mm", "brembo", 7_490, ["pq46"], { specs: [["Prečnik", "312", "mm"], ["Debljina", "25", "mm"]] }],
  ["kocioni-diskovi", "Kočioni disk prednji 320 × 30 mm", "ate", 9_890, ["mlb"], { specs: [["Prečnik", "320", "mm"], ["Debljina", "30", "mm"]] }],
  ["kocione-plocice", "Kočione pločice prednje, sa senzorom", "ate", 4_290, ["pq35", "mqb"], { specs: [["Širina", "156,4", "mm"], ["Visina", "74,1", "mm"], ["Debljina", "19,5", "mm"]] }],
  ["kocione-plocice", "Kočione pločice prednje, sistem Teves", "brembo", 5_190, ["mqb"], { specs: [["Širina", "155,1", "mm"], ["Debljina", "20,3", "mm"]] }],
  ["kocione-plocice", "Kočione pločice zadnje", "trw", 3_190, ["pq35", "mqb"], { specs: [["Širina", "87,7", "mm"], ["Debljina", "17", "mm"]] }],
  ["kocione-plocice", "Kočione pločice prednje", "bosch", 2_990, ["pq25"], { specs: [["Širina", "131,1", "mm"], ["Debljina", "19,5", "mm"]] }],
  ["kocione-plocice", "Kočione pločice zadnje, elektronska ručna", "febi-bilstein", 3_490, ["mqb", "mqb_evo"] ],
  ["kocione-plocice", "Kočione pločice prednje", "original-vag", 8_900, ["mqb_evo"] ],
  ["kocione-plocice", "Kočione pločice prednje", "ate", 4_590, ["pq46"] ],
  ["kocione-plocice", "Kočione pločice prednje", "bosch", 3_790, ["b5", "audi_b6b7"] ],
  ["kocione-celjusti", "Kočiona čeljust prednja leva", "trw", 11_900, ["pq35"], { specs: [["Prečnik klipa", "54", "mm"], ["Strana", "leva"]] }],
  ["kocione-celjusti", "Kočiona čeljust zadnja desna, sa motorom ručne", "ate", 24_900, ["mqb"], { specs: [["Strana", "desna"], ["Ručna kočnica", "elektronska"]] }],
  ["kocione-celjusti", "Set za reparaciju kočione čeljusti, prednji", "febi-bilstein", 1_490, ["pq35", "pq46", "mqb"] ],
  ["abs-senzori", "ABS senzor prednji", "bosch", 4_190, ["mqb", "mqb_evo"] ],
  ["abs-senzori", "ABS senzor zadnji", "febi-bilstein", 2_790, ["pq35", "pq46"] ],
  ["abs-senzori", "ABS senzor prednji", "meyle", 2_590, ["pq25"] ],
  // Vešanje i upravljanje
  ["amortizeri-opruge", "Amortizer prednji, gasni", "sachs", 8_490, ["pq35"], { specs: [["Tip", "gasni"], ["Ugradnja", "prednja osovina"]] }],
  ["amortizeri-opruge", "Amortizer prednji Excel-G", "kyb", 7_990, ["mqb"] ],
  ["amortizeri-opruge", "Amortizer zadnji B4", "bilstein", 6_890, ["pq35", "mqb"] ],
  ["amortizeri-opruge", "Opruga prednja", "sachs", 4_990, ["mqb"] ],
  ["amortizeri-opruge", "Ležaj amortizera sa gumom, set", "meyle", 2_690, ["pq35", "pq46"] ],
  ["amortizeri-opruge", "Amortizer prednji", "sachs", 9_290, ["pq46"] ],
  ["ramena-selen-blokovi", "Rame prednje levo, sa kuglom", "lemforder", 7_990, ["pq35"] ],
  ["ramena-selen-blokovi", "Rame prednje desno, sa kuglom", "lemforder", 7_990, ["pq35"] ],
  ["ramena-selen-blokovi", "Rame prednje donje HD", "meyle", 6_490, ["mqb"] ],
  ["ramena-selen-blokovi", "Selen blok zadnjeg mosta", "febi-bilstein", 2_290, ["pq35", "pq25"] ],
  ["ramena-selen-blokovi", "Rame prednje gornje", "lemforder", 8_990, ["mlb", "audi_b6b7"] ],
  ["spone-stabilizatori", "Kraj spone", "lemforder", 2_390, ["pq35", "mqb"] ],
  ["spone-stabilizatori", "Spona aksijalna", "trw", 2_990, ["mqb"] ],
  ["spone-stabilizatori", "Štangla stabilizatora prednja", "febi-bilstein", 1_690, ["pq35", "mqb", "pq46"] ],
  ["spone-stabilizatori", "Štangla stabilizatora prednja HD", "meyle", 1_990, ["pq25"] ],
  ["letva-volana", "Manžetna letve volana, set", "original-vag", 3_290, ["pq35"] ],
  ["letva-volana", "Letva volana, hidraulična", "trw", 54_900, ["pq25"] ],
  ["lezaj-glavcina", "Ležaj prednjeg točka, set", "skf", 5_890, ["pq35", "pq46"] ],
  ["lezaj-glavcina", "Glavčina zadnja sa ležajem", "skf", 7_490, ["mqb", "mqb_evo"] ],
  ["lezaj-glavcina", "Ležaj prednjeg točka", "febi-bilstein", 3_990, ["pq25"] ],
  ["lezaj-glavcina", "Ležaj prednjeg točka, set", "skf", 8_290, ["mlb"] ],
  // Motor i usis
  ["motor", "Dihtung glave motora 2.0 TDI, 2 zareza", "original-vag", 7_900, ["pq35", "pq46", "mqb"], { engines: ["2-0-tdi-103kw-cr", "2-0-tdi-110kw"], enginePrefix: "04L" }],
  ["motor", "Dihtung poklopca ventila 1.9 TDI", "febi-bilstein", 1_990, ["pq34", "pq35", "pq46", "b5"], { engines: TDI_PD, enginePrefix: "038" }],
  ["motor", "Set klipnih karika 1.9 TDI", "mahle", 9_490, ["pq34", "pq35"], { engines: TDI_PD, enginePrefix: "038" }],
  ["turbina", "Turbina 1.9 TDI 77 kW, nova", "garrett", 89_900, ["pq35", "pq46"], { engines: ["1-9-tdi-77kw"], enginePrefix: "03G" }],
  ["turbina", "Turbina 2.0 TDI 110 kW, nova", "garrett", 119_900, ["mqb"], { engines: ["2-0-tdi-110kw"], enginePrefix: "04L" }],
  ["turbina", "Turbina 1.4 TSI 90 kW, nova", "borgwarner", 99_900, ["pq35"], { engines: ["1-4-tsi-90kw"], enginePrefix: "03C" }],
  ["interkuler", "Interkuler", "nissens", 12_900, ["pq35"] ],
  ["interkuler", "Interkuler", "valeo", 14_900, ["mqb"] ],
  ["usisna-grana", "Motor klapni usisne grane 2.0 TDI", "pierburg", 18_900, ["pq35", "pq46"], { engines: ["2-0-tdi-103kw-cr"], enginePrefix: "03L" }],
  ["usisna-grana", "Crevo usisa od filtera vazduha", "original-vag", 6_900, ["mqb"] ],
  ["brizgaljke-pumpa-goriva", "Brizgaljka Common Rail 2.0 TDI", "bosch", 39_900, ["pq35", "pq46"], { engines: ["2-0-tdi-103kw-cr"], enginePrefix: "03L" }],
  ["brizgaljke-pumpa-goriva", "Pumpa visokog pritiska CP4 2.0 TDI", "bosch", 79_900, ["pq35", "pq46", "mqb"], { engines: ["2-0-tdi-103kw-cr", "2-0-tdi-110kw"], enginePrefix: "03L" }],
  ["brizgaljke-pumpa-goriva", "Set podložki brizgaljki", "febi-bilstein", 990, ["pq34", "pq35", "pq46", "b5"], { engines: TDI_PD, enginePrefix: "038" }],
  ["zupcasti-kais-vodena-pumpa", "Set zupčastog kaiša sa vodenom pumpom 1.9 TDI", "ina", 16_900, ["pq34", "pq35", "pq46", "b5"], { engines: TDI_PD, enginePrefix: "038", specs: [["Broj zuba", "120"], ["Sadrži", "kaiš, zatezač, vodilice, vodena pumpa"]] }],
  ["zupcasti-kais-vodena-pumpa", "Set zupčastog kaiša sa vodenom pumpom 2.0 TDI", "gates", 19_900, ["pq35", "pq46", "mqb"], { engines: ["2-0-tdi-103kw-cr", "2-0-tdi-110kw", "1-6-tdi-77kw"], enginePrefix: "04L" }],
  ["zupcasti-kais-vodena-pumpa", "Set zupčastog kaiša 1.6 8V", "contitech", 8_990, ["pq34", "pq35", "b5"], { engines: ["1-6-8v-75kw"], enginePrefix: "06A" }],
  ["zupcasti-kais-vodena-pumpa", "Set zupčastog kaiša sa vodenom pumpom 1.6 TDI", "skf", 17_490, ["pq35", "pq25", "mqb"], { engines: ["1-6-tdi-77kw"], enginePrefix: "04L" }],
  ["zupcasti-kais-vodena-pumpa", "Set zupčastog kaiša 1.4 16V", "gates", 9_490, ["pq25", "pq34"], { engines: ["1-4-16v-55kw"], enginePrefix: "036" }],
  ["kais-alternatora", "Rebrasti kaiš 6PK1153", "gates", 1_690, ["pq35", "pq46"], { specs: [["Dužina", "1153", "mm"], ["Broj rebara", "6"]] }],
  ["kais-alternatora", "Rebrasti kaiš 6PK1070", "contitech", 1_590, ["mqb"], { specs: [["Dužina", "1070", "mm"], ["Broj rebara", "6"]] }],
  ["kais-alternatora", "Zatezač kaiša alternatora", "ina", 5_990, ["pq35", "pq46"] ],
  ["alternator", "Alternator 140 A", "bosch", 34_900, ["pq35", "pq46"], { specs: [["Struja", "140", "A"], ["Napon", "14", "V"]] }],
  ["alternator", "Alternator 110 A", "valeo", 27_900, ["pq25"], { specs: [["Struja", "110", "A"]] }],
  ["anlaser", "Anlaser 2,0 kW", "bosch", 26_900, ["pq35", "pq46"], { specs: [["Snaga", "2,0", "kW"]] }],
  ["anlaser", "Anlaser 1,1 kW", "valeo", 18_900, ["pq25"], { specs: [["Snaga", "1,1", "kW"]] }],
  ["paljenje-grejaci", "Svećica iridijumska", "ngk", 1_290, ["mqb", "pq35", "pq25"], { engines: ["1-4-tsi-90kw", "1-4-tsi-110kw", "1-2-tsi-77kw"], enginePrefix: "04E" }],
  ["paljenje-grejaci", "Bobina paljenja", "bosch", 4_690, ["mqb", "mqb_evo", "mqb_a0"], { engines: TSI_EA211, enginePrefix: "04E" }],
  ["paljenje-grejaci", "Grejač Duraterm 1.9/2.0 TDI", "bosch", 1_890, ["pq34", "pq35", "pq46", "b5"], { engines: TDI_PD, enginePrefix: "N10" }],
  ["paljenje-grejaci", "Grejač 1.6/2.0 TDI CR", "ngk", 2_190, ["pq35", "pq46", "mqb", "pq25"], { engines: TDI_CR, enginePrefix: "04L" }],
  ["karter-dihtunzi", "Čep kartera sa podloškom", "febi-bilstein", 390, "universal", { specs: [["Navoj", "M14 × 1,5"]] }],
  ["karter-dihtunzi", "Pumpa ulja 2.0 TDI", "original-vag", 32_900, ["pq35", "pq46"], { engines: ["2-0-tdi-103kw-cr"], enginePrefix: "03L" }],
  ["karter-dihtunzi", "Semering radilice, strana zamajca", "febi-bilstein", 2_490, ["pq34", "pq35", "pq46"], { engines: TDI_PD, enginePrefix: "038" }],
  ["egr-ventil", "EGR ventil 1.9/2.0 TDI", "pierburg", 21_900, ["pq34", "pq35", "pq46"], { engines: TDI_PD, enginePrefix: "038" }],
  ["egr-ventil", "EGR ventil 2.0 TDI CR", "pierburg", 26_900, ["pq35", "pq46", "mqb"], { engines: ["2-0-tdi-103kw-cr", "2-0-tdi-110kw"], enginePrefix: "04L" }],
  ["nosaci-motora", "Nosač motora desni, hidraulični", "lemforder", 9_990, ["pq35"] ],
  ["nosaci-motora", "Nosač menjača levi, DSG", "febi-bilstein", 5_490, ["pq35", "pq46"] ],
  ["nosaci-motora", "Obrtni nosač motora (pas)", "meyle", 3_990, ["mqb"] ],
  // Izduvni sistem
  ["dpf-katalizator", "Katalizator 1.6 8V", "walker", 29_900, ["pq34"], { engines: ["1-6-8v-75kw"], enginePrefix: "1J0" }],
  ["dpf-katalizator", "DPF filter 2.0 TDI", "original-vag", 139_900, ["mqb"], { engines: ["2-0-tdi-110kw"], enginePrefix: "5Q0" }],
  ["auspuh", "Lonac zadnji", "walker", 11_900, ["pq35"] ],
  ["auspuh", "Lonac srednji", "walker", 9_490, ["pq25"] ],
  ["auspuh", "Gumeni nosač auspuha", "febi-bilstein", 490, "universal"],
  // Hlađenje i klima
  ["hladnjak-ventilator", "Hladnjak motora", "nissens", 14_900, ["pq35"], { specs: [["Dimenzije jezgra", "650 × 438 × 26", "mm"]] }],
  ["hladnjak-ventilator", "Hladnjak motora", "valeo", 17_900, ["mqb"] ],
  ["hladnjak-ventilator", "Ventilator hladnjaka sa motorom", "nissens", 19_900, ["pq35"] ],
  ["termostat-creva", "Termostat 1.9/2.0 TDI", "mahle", 2_990, ["pq34", "pq35", "pq46"], { engines: TDI_PD, enginePrefix: "038" }],
  ["termostat-creva", "Crevo hladnjaka gornje", "febi-bilstein", 2_490, ["pq35"] ],
  ["termostat-creva", "Kućište termostata sa pumpom 1.4 TSI", "original-vag", 22_900, ["mqb", "mqb_evo"], { engines: ["1-4-tsi-110kw", "1-5-tsi-110kw"], enginePrefix: "04E" }],
  ["klima", "Kompresor klime", "denso", 54_900, ["pq35", "pq46"] ],
  ["klima", "Kondenzator klime", "nissens", 16_900, ["mqb"] ],
  // Transmisija
  ["kvacilo-zamajac", "Set kvačila 1.9 TDI", "luk", 21_900, ["pq35"], { engines: ["1-9-tdi-77kw"], enginePrefix: "03G", specs: [["Prečnik", "228", "mm"]] }],
  ["kvacilo-zamajac", "Dvomaseni zamajac 2.0 TDI", "luk", 49_900, ["pq35", "pq46"], { engines: ["2-0-tdi-103kw-pd", "2-0-tdi-103kw-cr"], enginePrefix: "03L" }],
  ["kvacilo-zamajac", "Set kvačila 1.6 TDI", "sachs", 19_900, ["mqb"], { engines: ["1-6-tdi-77kw"], enginePrefix: "04L" }],
  ["menjac", "Set filtera i ulja za DSG DQ250", "original-vag", 14_900, ["pq35", "pq46", "mqb"], { specs: [["Sadrži", "filter, 6 L ulja, zaptivke"]] }],
  ["menjac", "Mehatronika DQ200, nova", "original-vag", 189_900, ["pq35", "pq25", "mqb"] ],
  ["poluosovine", "Homokinetički zglob spoljni", "febi-bilstein", 5_990, ["pq35", "mqb"] ],
  ["poluosovine", "Poluosovina leva", "meyle", 17_900, ["pq25"] ],
  ["poluosovine", "Manžetna homokinetičkog zgloba, set", "febi-bilstein", 1_290, ["pq35", "pq46", "pq25", "mqb"] ],
  // Elektrika i svetla
  ["akumulator", "Akumulator 60 Ah 540 A", "varta", 11_900, "universal", { specs: [["Kapacitet", "60", "Ah"], ["Struja starta", "540", "A"]] }],
  ["akumulator", "Akumulator EFB 70 Ah 760 A, start-stop", "varta", 17_900, "universal", { specs: [["Kapacitet", "70", "Ah"], ["Tehnologija", "EFB"]] }],
  ["akumulator", "Akumulator AGM 80 Ah 800 A", "bosch", 27_900, "universal", { specs: [["Kapacitet", "80", "Ah"], ["Tehnologija", "AGM"]] }],
  ["farovi", "Far levi, halogeni", "hella", 32_900, { gens: ["golf-7"] }],
  ["farovi", "Far desni, halogeni", "valeo", 34_900, { gens: ["octavia-3"] }],
  ["stop-svetla", "Stop svetlo levo", "hella", 14_900, { gens: ["golf-6"] }],
  ["stop-svetla", "Stop svetlo desno, karavan", "valeo", 13_900, { gens: ["octavia-2"] }],
  ["senzori", "Lambda sonda pre katalizatora", "bosch", 9_900, ["mqb", "mqb_evo"], { engines: TSI_EA211, enginePrefix: "04E" }],
  ["senzori", "Lambda sonda", "ngk", 6_900, ["pq34", "pq35"], { engines: ["1-6-8v-75kw"], enginePrefix: "06A" }],
  ["senzori", "Parking senzor", "original-vag", 5_900, ["pq35", "mqb"] ],
  ["senzori", "Senzor temperature rashladne tečnosti", "febi-bilstein", 1_490, ["pq34", "pq35", "pq46", "pq25", "b5"] ],
  ["senzori", "Senzor pritiska izduvnih gasova (DPF)", "bosch", 7_490, ["pq35", "pq46", "mqb"], { engines: TDI_CR, enginePrefix: "04L" }],
  // Karoserija
  ["hauba", "Hauba", "original-vag", 49_900, { gens: ["golf-7"] }],
  ["branici", "Branik prednji, za prskalice farova", "original-vag", 39_900, { gens: ["octavia-3"] }],
  ["branici", "Branik zadnji", "original-vag", 36_900, { gens: ["golf-6"] }],
  ["blatobrani", "Blatobran levi", "original-vag", 18_900, { gens: ["golf-5"] }],
  ["blatobrani", "Blatobran desni", "original-vag", 21_900, { gens: ["passat-b6"] }],
  ["vrata", "Podizač stakla prednji levi, sa motorom", "febi-bilstein", 8_990, { gens: ["golf-5", "golf-6"] }],
  ["vrata", "Brava prednjih desnih vrata", "original-vag", 12_900, ["mqb"] ],
  ["retrovizori", "Staklo retrovizora levo, grejano", "original-vag", 4_990, { gens: ["golf-7"] }],
  ["retrovizori", "Poklopac retrovizora desni", "hella", 2_990, { gens: ["octavia-3"] }],
  ["stakla", "Vetrobransko staklo sa nosačem senzora", "original-vag", 42_900, { gens: ["golf-7"] }],
  ["brisaci", "Metlice brisača Aerotwin 600/475, set", "bosch", 3_490, { gens: ["golf-7", "octavia-3", "leon-3", "a3-8v"] }],
  ["brisaci", "Metlica zadnjeg brisača 280 mm", "bosch", 1_190, ["pq35", "mqb"] ],
  ["brisaci", "Motor prednjih brisača", "valeo", 15_900, ["pq35"] ],
  // Točkovi
  ["felne-gume", "Guma letnja 205/55 R16 91V", "continental", 11_900, "universal", { specs: [["Dimenzija", "205/55 R16"], ["Indeks", "91V"]] }],
  ["felne-gume", "Aluminijumska felna 6,5J × 16 ET46, 5 × 112", "original-vag", 24_900, ["pq35", "mqb", "mqb_evo"], { specs: [["Dimenzija", "6,5J × 16"], ["ET", "46"], ["Raspored rupa", "5 × 112"]] }],
  ["felne-gume", "Vijci točka M14 × 1,5, set 20 kom", "febi-bilstein", 2_490, "universal"],
  // Servis
  ["filter-ulja", "Filter ulja", "mann-filter", 1_190, ["pq34", "pq35", "pq46", "b5"], { engines: TDI_PD, enginePrefix: "045" }],
  ["filter-ulja", "Filter ulja", "mahle", 1_390, ["pq35", "pq46", "mqb", "pq25"], { engines: TDI_CR, enginePrefix: "03N" }],
  ["filter-ulja", "Filter ulja", "bosch", 1_090, ["mqb", "mqb_evo", "mqb_a0"], { engines: TSI_EA211, enginePrefix: "04E" }],
  ["filter-ulja", "Filter ulja", "mann-filter", 890, ["pq34", "pq35", "pq25"], { engines: ["1-6-8v-75kw", "1-4-16v-55kw"], enginePrefix: "030" }],
  ["filter-ulja", "Filter ulja", "mann-filter", 1_490, ["mlb", "c6"], { engines: ["2-0-tdi-103kw-cr", "2-0-tdi-110kw", "2-7-tdi-132kw", "3-0-tdi-171kw"], enginePrefix: "03L" }],
  ["filter-vazduha", "Filter vazduha", "mann-filter", 1_690, ["pq35"] ],
  ["filter-vazduha", "Filter vazduha", "mahle", 1_890, ["mqb"] ],
  ["filter-vazduha", "Filter vazduha", "bosch", 1_390, ["pq25"] ],
  ["filter-vazduha", "Filter vazduha", "febi-bilstein", 1_590, ["pq46"] ],
  ["filter-goriva", "Filter goriva", "mann-filter", 2_490, ["pq35", "pq46"], { engines: TDI_CR, enginePrefix: "3C0" }],
  ["filter-goriva", "Filter goriva", "bosch", 2_990, ["mqb"], { engines: ["1-6-tdi-77kw", "2-0-tdi-110kw", "2-0-tdi-140kw"], enginePrefix: "5Q0" }],
  ["filter-goriva", "Filter goriva", "mahle", 1_990, ["pq34", "b5"], { engines: ["1-9-tdi-66kw", "1-9-tdi-74kw", "1-9-tdi-96kw"], enginePrefix: "1J0" }],
  ["filter-kabine", "Filter kabine sa aktivnim ugljem", "mann-filter", 2_190, ["pq35", "pq46"] ],
  ["filter-kabine", "Filter kabine", "bosch", 1_490, ["mqb"] ],
  ["filter-kabine", "Filter kabine", "mahle", 1_290, ["pq25"] ],
  ["filter-kabine", "Filter kabine sa aktivnim ugljem", "febi-bilstein", 1_890, ["mqb_evo"] ],
  ["ulja-tecnosti", "Motorno ulje Edge 5W-30 LL, 5 L", "castrol", 7_490, "universal", { specs: [["Viskozitet", "5W-30"], ["Norma", "VW 504 00 / 507 00"], ["Pakovanje", "5", "L"]] }],
  ["ulja-tecnosti", "Motorno ulje Magnatec 5W-40, 4 L", "castrol", 4_990, "universal", { specs: [["Viskozitet", "5W-40"], ["Norma", "VW 502 00 / 505 00"], ["Pakovanje", "4", "L"]] }],
  ["ulja-tecnosti", "Rashladna tečnost G13, koncentrat 1,5 L", "original-vag", 1_890, "universal", { specs: [["Norma", "G13"], ["Pakovanje", "1,5", "L"]] }],
  ["ulja-tecnosti", "Kočiona tečnost Super DOT 4, 1 L", "ate", 1_290, "universal", { specs: [["Norma", "DOT 4"], ["Pakovanje", "1", "L"]] }],
  ["ulja-tecnosti", "Ulje za DSG menjač, 1 L", "febi-bilstein", 1_690, "universal", { specs: [["Pakovanje", "1", "L"]] }],
];

// Deterministic PRNG (mulberry32) so re-runs produce identical data.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const digits = (r: () => number, n: number) =>
  Array.from({ length: n }, () => Math.floor(r() * 10)).join("");
const letters = (r: () => number, n: number) =>
  Array.from({ length: n }, () => "ABCDEFGHJKLMNPQRST"[Math.floor(r() * 18)]).join("");

/** VAG part-number main groups per category (first digits of the middle block). */
const MAIN_GROUP: Record<string, string> = {
  "kocioni-diskovi": "615",
  "kocione-plocice": "698",
  "kocione-celjusti": "615",
  "abs-senzori": "927",
  "amortizeri-opruge": "413",
  "ramena-selen-blokovi": "407",
  "spone-stabilizatori": "411",
  "letva-volana": "423",
  "lezaj-glavcina": "498",
  motor: "103",
  turbina: "145",
  interkuler: "145",
  "usisna-grana": "129",
  "brizgaljke-pumpa-goriva": "130",
  "zupcasti-kais-vodena-pumpa": "121",
  "kais-alternatora": "903",
  alternator: "903",
  anlaser: "911",
  "paljenje-grejaci": "905",
  "karter-dihtunzi": "115",
  "egr-ventil": "131",
  "nosaci-motora": "199",
  "dpf-katalizator": "254",
  auspuh: "253",
  "hladnjak-ventilator": "121",
  "termostat-creva": "121",
  klima: "820",
  "kvacilo-zamajac": "105",
  menjac: "325",
  poluosovine: "498",
  akumulator: "915",
  farovi: "941",
  "stop-svetla": "945",
  senzori: "906",
  hauba: "823",
  branici: "807",
  blatobrani: "821",
  vrata: "837",
  retrovizori: "857",
  stakla: "845",
  brisaci: "955",
  "felne-gume": "601",
  "filter-ulja": "115",
  "filter-vazduha": "129",
  "filter-goriva": "127",
  "filter-kabine": "819",
  "ulja-tecnosti": "012",
};

const GROUP_PREFIX: Record<PlatformGroup, string> = {
  pq34: "1J0",
  pq35: "1K0",
  mqb: "5Q0",
  mqb_evo: "5WA",
  pq46: "3C0",
  b5: "8D0",
  pq25: "6R0",
  mqb_a0: "2Q0",
  audi_b6b7: "8E0",
  mlb: "8K0",
  c6: "4F0",
};

const GEN_PREFIX: Record<string, string> = {
  "golf-5": "1K0",
  "golf-6": "5K0",
  "golf-7": "5G0",
  "octavia-2": "1Z0",
  "octavia-3": "5E0",
  "passat-b6": "3C0",
  "leon-3": "5F0",
  "a3-8v": "8V0",
};

/** Manufacturer-style (fictional) part numbers. */
function mpnFor(manufacturer: string, r: () => number): string {
  switch (manufacturer) {
    case "bosch":
      return `0 986 ${digits(r, 3)} ${digits(r, 3)}`;
    case "ate":
      return `24.01${digits(r, 2)}-${digits(r, 4)}.1`;
    case "brembo":
      return `09.${letters(r, 1)}${digits(r, 3)}.${digits(r, 2)}`;
    case "trw":
      return `DF${digits(r, 4)}`;
    case "febi-bilstein":
      return digits(r, 5);
    case "meyle":
      return `${digits(r, 3)} ${digits(r, 3)} ${digits(r, 4)}`;
    case "lemforder":
      return `${digits(r, 5)} 01`;
    case "sachs":
      return `${digits(r, 3)} ${digits(r, 3)}`;
    case "luk":
      return `6${digits(r, 2)} ${digits(r, 4)} ${digits(r, 2)}`;
    case "mann-filter":
      return `HU ${digits(r, 4)} x`;
    case "mahle":
      return `OX ${digits(r, 3)}D`;
    case "garrett":
      return `7${digits(r, 5)}-50${digits(r, 2)}S`;
    case "ngk":
      return digits(r, 4);
    case "gates":
      return `K0${digits(r, 5)}XS`;
    case "contitech":
      return `CT${digits(r, 4)}WP${digits(r, 1)}`;
    case "ina":
      return `530 0${digits(r, 3)} 30`;
    case "skf":
      return `VKBA ${digits(r, 4)}`;
    case "hella":
      return `1EG ${digits(r, 3)} ${digits(r, 3)}-${digits(r, 3)}`;
    case "pierburg":
      return `7.${digits(r, 5)}.${digits(r, 2)}.0`;
    case "nissens":
      return digits(r, 5);
    case "kyb":
      return digits(r, 6);
    case "bilstein":
      return `19-${digits(r, 6)}`;
    case "varta":
      return `${digits(r, 3)} ${digits(r, 3)} ${digits(r, 3)}`;
    case "castrol":
      return `15${digits(r, 3)}${letters(r, 1)}`;
    case "continental":
      return `03${digits(r, 5)}`;
    case "borgwarner":
      return `5439 ${digits(r, 3)} ${digits(r, 4)}`;
    case "denso":
      return `DCP${digits(r, 5)}`;
    case "walker":
      return digits(r, 5);
    case "valeo":
      return digits(r, 6);
    case "original-vag":
      return "";
    default:
      return digits(r, 6);
  }
}

const CROSS_POOL = ["febi-bilstein", "meyle", "bosch", "trw", "ate", "mahle", "skf", "valeo"];

export type ProductSeed = {
  index: number;
  sku: string;
  name: string;
  category: string;
  manufacturer: string;
  quality?: "original" | "oem" | "aftermarket";
  retailPricePara: number;
  costNetPara: number;
  stockQty: number;
  leadTimeDays?: number;
  allowBackorder: boolean;
  lowStockThreshold?: number;
  universal: boolean;
  groups: PlatformGroup[];
  generations: string[];
  engines: string[];
  mpn?: string;
  oemNumbers: { raw: string; brand: string }[];
  crossNumbers: { manufacturerSlug: string; raw: string }[];
  specs: { label: string; value: string; unit?: string }[];
  description: string;
  popularity: number;
};

const DEMO_NOTE = "Demo artikal: kataloški brojevi i cene služe samo za prikaz rada prodavnice.";

export function buildProductSeeds(): ProductSeed[] {
  return ROWS.map((row, index) => {
    const [category, name, manufacturer, priceDin, fits, opts = {}] = row;
    const r = rng(1_000 + index * 7_919);
    const universal = fits === "universal";
    const groups: PlatformGroup[] = Array.isArray(fits) ? fits : [];
    const generations = typeof fits === "object" && !Array.isArray(fits) ? fits.gens : [];
    const prefix =
      opts.enginePrefix ??
      (generations[0] ? GEN_PREFIX[generations[0]] : undefined) ??
      (groups[0] ? GROUP_PREFIX[groups[0]] : "000");
    const main = MAIN_GROUP[category] ?? "000";
    const oemCount = universal ? 0 : 1 + Math.floor(r() * 2);
    const oemNumbers = Array.from({ length: oemCount }, () => ({
      raw: `${prefix} ${main} ${digits(r, 3)}${r() < 0.6 ? ` ${letters(r, 1 + Math.floor(r() * 2))}` : ""}`,
      brand: "VAG (demo)",
    }));
    const crossMaker = CROSS_POOL.filter((m) => m !== manufacturer)[
      Math.floor(r() * (CROSS_POOL.length - 1))
    ];
    const crossNumbers = universal
      ? []
      : [{ manufacturerSlug: crossMaker, raw: mpnFor(crossMaker, r) }];
    const mpn = mpnFor(manufacturer, r) || undefined;

    // Stock mix: ~60 % in stock, ~15 % low, ~15 % on order, ~10 % out of stock.
    const roll = r();
    let stockQty: number;
    let leadTimeDays: number | undefined;
    let allowBackorder = false;
    if (roll < 0.6) stockQty = 4 + Math.floor(r() * 22);
    else if (roll < 0.75) stockQty = 1 + Math.floor(r() * 3);
    else if (roll < 0.9) {
      stockQty = 0;
      leadTimeDays = 2 + Math.floor(r() * 6);
      allowBackorder = true;
    } else stockQty = 0;

    const retailPricePara = priceDin * 100;
    const costNetPara = Math.round((retailPricePara / 1.2) * (0.58 + r() * 0.17));
    const specs = (opts.specs ?? []).map(([label, value, unit]) => ({
      label,
      value,
      ...(unit ? { unit } : {}),
    }));
    return {
      index,
      sku: `DEMO-${String(index + 1).padStart(4, "0")}`,
      name,
      category,
      manufacturer,
      ...(opts.quality ? { quality: opts.quality } : {}),
      retailPricePara,
      costNetPara,
      stockQty,
      ...(leadTimeDays !== undefined ? { leadTimeDays } : {}),
      allowBackorder,
      universal,
      groups: universal ? [] : groups,
      generations,
      engines: opts.engines ?? [],
      ...(mpn ? { mpn } : {}),
      oemNumbers,
      crossNumbers,
      specs,
      description: `${name}. ${opts.note ?? DEMO_NOTE}`,
      popularity: Math.floor(r() * 100),
    };
  });
}

export const DEMO_PRODUCT_COUNT = ROWS.length;
export { ALL as ALL_GROUPS };
