/**
 * Landing copy from real data (SEO-ADS §J4): the intro paragraph and the FAQ of a
 * category × brand / model landing. Every sentence carries numbers or names from
 * `landingStats` — never a generic sentence with the vehicle swapped in. Pure and tested.
 */
import { formatRSD } from "@/lib/format/money";
import { pluralSr } from "@/lib/format/plural";
import { accusativeSr, listMoreSr, listSr, shortBrandName } from "@/lib/seo/templates";

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

/**
 * The vehicle as it follows „za“ — every landing sentence, heading and OG title uses it that
 * way („Kočioni diskovi za Škodu Octaviju“, „Svi delovi za Cupru“; COPY-05).
 */
export function vehicleText(i: Pick<LandingCopyInput, "brandName" | "modelName">): string {
  return accusativeSr(i.modelName ? `${shortBrandName(i.brandName)} ${i.modelName}` : i.brandName);
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
  if (i.generations.length) {
    if (i.modelName) {
      // The four generations with the most parts, told in model-year order (SEO-07).
      const top = i.generations
        .slice(0, 4)
        .sort((a, b) => a.yearFrom - b.yearFrom || (a.yearTo ?? 9999) - (b.yearTo ?? 9999))
        .map((g) => `${g.name} (${yearsText(g.yearFrom, g.yearTo)})`);
      const rest = i.generations.length - top.length;
      sentences.push(`Pokrivene generacije: ${listMoreSr(top, top.length, { hidden: rest })}.`);
    } else {
      const top = i.generations.slice(0, 4).map((g) => accusativeSr(g.name));
      sentences.push(`Najviše delova ima za ${listSr(top)}.`);
    }
  }
  if (i.manufacturers.length) {
    const named = i.manufacturers.map((m) => `${m.name} (${m.count})`);
    const hidden = Math.max(0, i.manufacturerCount - named.length);
    sentences.push(`Proizvođači: ${listMoreSr(named, 4, { hidden })}.`);
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
      question: `Koji delovi odgovaraju za ${accusativeSr(engine.generationName)} ${engine.engineName}?`,
      answer: `Za ${accusativeSr(engine.generationName)} sa motorom ${engine.engineName}${codes} odgovara ${engine.count} ${pluralSr(engine.count, ARTIKAL)} iz ove grupe. Izaberite generaciju i motor u filteru da vidite samo njih.`,
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
