/**
 * Landing copy from real data (SEO-ADS §J4): the intro paragraph and the FAQ of a
 * category × brand / model landing. Every sentence carries numbers or names from
 * `landingStats` — never a generic sentence with the vehicle swapped in. Pure and tested.
 */
import { formatRSD } from "@/lib/format/money";
import { pluralSr } from "@/lib/format/plural";
import { shortBrandName } from "@/lib/seo/templates";

export type LandingCopyInput = {
  categoryName: string;
  brandName: string;
  modelName: string | null;
  productCount: number;
  inStockCount: number;
  price: { minPara: number; maxPara: number } | null;
  manufacturerCount: number;
  manufacturers: { name: string; count: number }[];
  topOems: string[];
  generations: {
    name: string;
    modelName: string;
    yearFrom: number;
    yearTo: number | null;
    count: number;
  }[];
  engines: { generationName: string; engineName: string; engineCodes: string[]; count: number }[];
};

const ARTIKAL = ["artikal", "artikla", "artikala"] as const;

export const yearsText = (from: number, to: number | null) => (to ? `${from}–${to}` : `od ${from}`);

export function vehicleText(i: Pick<LandingCopyInput, "brandName" | "modelName">): string {
  return i.modelName ? `${shortBrandName(i.brandName)} ${i.modelName}` : i.brandName;
}

function listSr(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} i ${items[items.length - 1]}`;
}

function priceText(price: LandingCopyInput["price"]): string {
  if (!price || price.maxPara <= 0) return "";
  return price.minPara === price.maxPara
    ? `, po ceni od ${formatRSD(price.minPara)} sa PDV-om`
    : `, u rasponu od ${formatRSD(price.minPara)} do ${formatRSD(price.maxPara)} sa PDV-om`;
}

export function landingIntro(i: LandingCopyInput): string {
  const vehicle = i.modelName ? vehicleText(i) : `${i.brandName} vozila`;
  const sentences = [
    `Za ${vehicle} imamo ${i.productCount} ${pluralSr(i.productCount, ARTIKAL)} iz grupe „${i.categoryName}“, ${i.inStockCount} odmah na stanju${priceText(i.price)}.`,
  ];
  const gens = i.generations
    .slice(0, 4)
    .map((g) => (i.modelName ? `${g.name} (${yearsText(g.yearFrom, g.yearTo)})` : `${g.name}`));
  if (gens.length) {
    sentences.push(
      i.modelName
        ? `Pokrivene generacije: ${listSr(gens)}.`
        : `Najviše delova ima za ${listSr(gens)}.`,
    );
  }
  if (i.manufacturers.length) {
    const shown = i.manufacturers.slice(0, 4).map((m) => `${m.name} (${m.count})`);
    const more = i.manufacturerCount - shown.length;
    sentences.push(`Proizvođači: ${listSr(shown)}${more > 0 ? ` i još ${more}` : ""}.`);
  }
  return sentences.join(" ");
}

export function landingFaq(i: LandingCopyInput): { question: string; answer: string }[] {
  const vehicle = vehicleText(i);
  const faq: { question: string; answer: string }[] = [
    {
      question: `Koliko artikala „${i.categoryName}“ za ${vehicle} imate na stanju?`,
      answer: `U katalogu je ${i.productCount} ${pluralSr(i.productCount, ARTIKAL)} za ${vehicle}, od toga ${i.inStockCount} odmah na stanju. Za ostale rok isporuke piše na stranici artikla.`,
    },
  ];
  const engine = i.engines[0];
  if (engine) {
    const codes = engine.engineCodes.length
      ? ` (${engine.engineCodes.slice(0, 3).join(", ")})`
      : "";
    faq.push({
      question: `Koji delovi odgovaraju za ${engine.generationName} ${engine.engineName}?`,
      answer: `Za ${engine.generationName} sa motorom ${engine.engineName}${codes} odgovara ${engine.count} ${pluralSr(engine.count, ARTIKAL)} iz ove grupe. Izaberite generaciju i motor u filteru da vidite samo njih.`,
    });
  }
  if (i.manufacturerCount >= 2) {
    faq.push({
      question: `Koji proizvođači su u ponudi za ${vehicle}?`,
      answer: `${listSr(i.manufacturers.slice(0, 6).map((m) => `${m.name} (${m.count})`))}. Sve cene su sa PDV-om.`,
    });
  }
  if (i.topOems.length) {
    faq.push({
      question: `Kako da proverim da deo odgovara mom vozilu?`,
      answer: `Uporedite OEM broj sa starim delom — najtraženiji brojevi u ovoj grupi su ${listSr(i.topOems.slice(0, 3))}. Kad niste sigurni, pošaljite broj šasije (VIN) kroz upit i proverićemo umesto vas.`,
    });
  }
  return faq;
}
