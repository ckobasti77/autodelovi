import { describe, expect, test } from "vitest";

import { productImageAlt, productImagePath, parseProductImageFile } from "@/lib/seo/images";
import { landingFaq, landingIntro, type LandingCopyInput } from "@/lib/seo/landingCopy";
import { applyLandingCap, landingFailure } from "@/lib/seo/landingGuard";
import { landingHref, landingLabel } from "@/lib/seo/landingLinks";

const MIN = { brand: 8, model: 6 };
const c = (over: Partial<Parameters<typeof landingFailure>[0]> = {}) => ({
  level: "model" as const,
  productCount: 10,
  inStockCount: 4,
  manufacturerCount: 3,
  generationCount: 2,
  ...over,
});

describe("thin-content guard", () => {
  test("thresholds per level, stock and variety", () => {
    expect(landingFailure(c(), MIN)).toBeNull();
    expect(landingFailure(c({ productCount: 5 }), MIN)).toBe("few_products");
    expect(landingFailure(c({ level: "brand", productCount: 7 }), MIN)).toBe("few_products");
    expect(landingFailure(c({ inStockCount: 1 }), MIN)).toBe("few_in_stock");
    expect(landingFailure(c({ manufacturerCount: 1, generationCount: 1 }), MIN)).toBe("low_variety");
    expect(landingFailure(c({ manufacturerCount: 1, generationCount: 2 }), MIN)).toBeNull();
  });

  test("the cap admits eligible rows in rank order", () => {
    const rows = [c({ productCount: 20 }), c({ productCount: 3 }), c({ productCount: 12 }), c()];
    const verdicts = applyLandingCap(rows, MIN, 2);
    expect(verdicts.map((v) => v.indexable)).toEqual([true, false, true, false]);
    expect(verdicts.map((v) => v.reason)).toEqual([null, "few_products", null, "over_cap"]);
  });
});

const copy: LandingCopyInput = {
  categoryName: "Amortizeri i opruge",
  brandName: "Volkswagen",
  modelName: "Golf",
  productCount: 6,
  inStockCount: 4,
  price: { minPara: 269_000, maxPara: 849_000 },
  manufacturerCount: 3,
  manufacturers: [
    { name: "KYB", count: 3 },
    { name: "Sachs", count: 2 },
    { name: "Bilstein", count: 1 },
  ],
  topOems: ["5Q0 413 031 FL", "1K0 413 031 BL"],
  generations: [
    { name: "Golf VII", modelName: "Golf", yearFrom: 2012, yearTo: 2020, count: 4 },
    { name: "Golf VI", modelName: "Golf", yearFrom: 2008, yearTo: 2013, count: 2 },
  ],
  engines: [{ generationName: "Golf VII", engineName: "2.0 TDI", engineCodes: ["CRBC"], count: 3 }],
};

describe("landing copy from data", () => {
  test("intro carries counts, price range, generations and makers", () => {
    const intro = landingIntro(copy);
    expect(intro).toContain("Za VW Golf imamo 6 artikala iz grupe „Amortizeri i opruge“, 4 odmah na stanju");
    expect(intro).toContain("2.690 RSD do 8.490 RSD");
    expect(intro).toContain("Golf VII (2012–2020)");
    expect(intro).toContain("KYB (3), Sachs (2) i Bilstein (1)");
  });

  test("SEO-07: makers end with „i još N“ once, generations in model-year order", () => {
    const intro = landingIntro({
      ...copy,
      manufacturerCount: 6,
      manufacturers: [
        { name: "ATE", count: 2 },
        { name: "Brembo", count: 1 },
        { name: "Febi Bilstein", count: 1 },
        { name: "Original VAG", count: 1 },
        { name: "TRW", count: 1 },
      ],
      generations: [
        { name: "Golf VII", modelName: "Golf", yearFrom: 2012, yearTo: 2020, count: 4 },
        { name: "Golf V", modelName: "Golf", yearFrom: 2003, yearTo: 2009, count: 3 },
        { name: "Golf VI", modelName: "Golf", yearFrom: 2008, yearTo: 2013, count: 2 },
        { name: "Golf IV", modelName: "Golf", yearFrom: 1997, yearTo: 2006, count: 1 },
      ],
    });
    expect(intro).toContain(
      "Proizvođači: ATE (2), Brembo (1), Febi Bilstein (1), Original VAG (1) i još 2.",
    );
    expect(intro).toContain(
      "Pokrivene generacije: Golf IV (1997–2006), Golf V (2003–2009), Golf VI (2008–2013) i Golf VII (2012–2020).",
    );
    const five = landingIntro({
      ...copy,
      manufacturerCount: 5,
      manufacturers: ["ATE", "Brembo", "Febi Bilstein", "Original VAG", "TRW"].map((name) => ({
        name,
        count: 1,
      })),
    });
    expect(five).toContain("Original VAG (1) i TRW (1).");
  });

  test("COPY-05: Škoda and Cupra decline after „za“ in intro, FAQ and anchors", () => {
    const skoda = { ...copy, brandName: "Škoda", modelName: "Octavia" };
    expect(landingIntro(skoda).startsWith("Za Škodu Octaviju imamo")).toBe(true);
    expect(landingIntro({ ...skoda, modelName: null }).startsWith("Za Škoda vozila")).toBe(true);
    expect(landingFaq(skoda)[0]!.question).toContain("za Škodu Octaviju imate");
    const link: Parameters<typeof landingLabel>[0] = {
      categorySlug: "kocioni-diskovi",
      categoryName: "Kočioni diskovi",
      brandSlug: "cupra",
      brandName: "Cupra",
      modelSlug: null,
      modelName: null,
      productCount: 9,
      indexable: true,
    };
    expect(landingLabel(link)).toBe("Kočioni diskovi za Cupru");
  });

  test("brand landings read „{Marka} vozila“ and list the top models", () => {
    const intro = landingIntro({ ...copy, modelName: null, price: null });
    expect(intro.startsWith("Za Volkswagen vozila imamo 6 artikala")).toBe(true);
    expect(intro).toContain("Najviše delova ima za Golf VII i Golf VI.");
    expect(intro).not.toContain("RSD");
  });

  test("FAQ answers come from the numbers (engine, makers, OEM numbers)", () => {
    const faq = landingFaq(copy);
    expect(faq.map((f) => f.question)).toEqual([
      "Koliko artikala „Amortizeri i opruge“ za VW Golf imate na stanju?",
      "Koji delovi odgovaraju za Golf VII 2.0 TDI?",
      "Koji proizvođači su u ponudi za VW Golf?",
      "Kako da proverim da deo odgovara mom vozilu?",
    ]);
    expect(faq[1]!.answer).toContain("(CRBC) odgovara 3 artikla");
    expect(faq[3]!.answer).toContain("5Q0 413 031 FL i 1K0 413 031 BL");
    expect(landingFaq({ ...copy, engines: [], manufacturerCount: 1, topOems: [] })).toHaveLength(1);
  });

  test("link helpers", () => {
    const link = {
      categorySlug: "turbina",
      categoryName: "Turbina",
      brandSlug: "volkswagen",
      brandName: "Volkswagen",
      modelSlug: "passat",
      modelName: "Passat",
      productCount: 9,
      indexable: true,
    };
    expect(landingHref(link)).toBe("/delovi/turbina/volkswagen/passat");
    expect(landingLabel(link)).toBe("Turbina za VW Passat");
    expect(landingLabel({ ...link, modelSlug: null, modelName: null })).toBe("Turbina za Volkswagen");
  });
});

describe("descriptive product image URLs and alt texts", () => {
  test("path round-trips; the token follows the storage id", () => {
    const path = productImagePath("kocioni-disk-brembo-09-a820", 2, "kg2abc9xyz7q8w", "image/webp");
    expect(path).toBe("/slike/deo/kocioni-disk-brembo-09-a820-2-yz7q8w.webp");
    expect(parseProductImageFile(path.split("/").pop()!)).toEqual({
      slug: "kocioni-disk-brembo-09-a820",
      index: 2,
      token: "yz7q8w",
      ext: "webp",
    });
    expect(parseProductImageFile("../../etc/passwd")).toBeNull();
    expect(parseProductImageFile("disk-99-abc.jpg")).toBeNull();
  });

  test("Serbian alt fallback when the stored alt is a file name or empty", () => {
    expect(
      productImageAlt({ alt: "IMG_1234.jpg", name: "Kočioni disk", manufacturer: "Brembo", oem: "5Q0 615 301 F", index: 1 }),
    ).toBe("Kočioni disk — Brembo, OEM 5Q0 615 301 F");
    expect(productImageAlt({ alt: "", name: "Disk", manufacturer: "ATE", index: 2 })).toBe("Disk — ATE, slika 2");
    expect(
      productImageAlt({ alt: "Disk sa strane glavčine", name: "Disk", manufacturer: "ATE", index: 1 }),
    ).toBe("Disk sa strane glavčine");
  });
});
