import { describe, expect, test } from "vitest";

import {
  buildMetadata,
  clampText,
  defaultTitleSuffix,
  DESCRIPTION_MAX,
  pageTitle,
  privateMetadata,
  shortenWords,
  TITLE_MAX,
} from "@/lib/seo/metadata";
import {
  accusativeSr,
  categoryMeta,
  generationMeta,
  isCuratedSearch,
  landingMeta,
  listMoreSr,
  productMeta,
  productTitle,
  systemIntro,
  systemMeta,
  type MetaText,
} from "@/lib/seo/templates";

const SUFFIX = " | Euromotors Plus · OEM Parts";
/** The brand alone — what a title falls back to when the full suffix does not fit. */
const SHORT = " | Euromotors Plus";

/** The title as the page renders it (buildMetadata → pageTitle with the kept tail). */
const rendered = (t: MetaText) => pageTitle(t.title, SUFFIX, t.titleKeep);

describe("title and description limits", () => {
  test("keyword first, brand suffix, ≤ 60 characters", () => {
    expect(pageTitle("Kočioni diskovi za VW, Audi, Škoda, SEAT", SUFFIX)).toBe(
      `Kočioni diskovi za VW, Audi, Škoda, SEAT${SHORT}`,
    );
    const long = pageTitle(
      "Set zupčastog kaiša i vodena pumpa za VW, Audi, Škoda, SEAT i Cupru",
      SUFFIX,
    );
    expect(long.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(long.startsWith("Set zupčastog kaiša")).toBe(true);
  });

  test("D308: full suffix when it fits, the brand alone next, and a fitting title is never cut", () => {
    // 18 + 30 = 48: both names.
    expect(pageTitle("Turbina za VW Golf", SUFFIX)).toBe(`Turbina za VW Golf${SUFFIX}`);
    // 30 + 30 = 60: still both, exactly at the limit.
    const thirty = "Kočione pločice za Škodu Fabiu";
    expect(thirty).toHaveLength(30);
    expect(pageTitle(thirty, SUFFIX)).toBe(`${thirty}${SUFFIX}`);
    expect(pageTitle(thirty, SUFFIX)).toHaveLength(TITLE_MAX);
    // 31 + 30 = 61: the shop name goes, the brand stays.
    expect(pageTitle(`${thirty}u`, SUFFIX)).toBe(`${thirty}u${SHORT}`);
    // 42 + 18 = 60: the brand alone, at the limit.
    const fortyThree = "Amortizeri i opruge za Volkswagen Passat B8";
    expect(fortyThree).toHaveLength(43);
    const fits = "Amortizeri i opruge za Volkswagen Passat B";
    expect(fits).toHaveLength(42);
    expect(pageTitle(fits, SUFFIX)).toBe(`${fits}${SHORT}`);
    // 43–60 characters: no suffix, and not one letter of the title is lost.
    expect(pageTitle(fortyThree, SUFFIX)).toBe(fortyThree);
    const sixty = "Set zupčastog kaiša sa vodenom pumpom za Volkswagen Golf VII";
    expect(sixty).toHaveLength(60);
    expect(pageTitle(sixty, SUFFIX)).toBe(sixty);
    // A suffix without the separator has no shorter form.
    expect(pageTitle(fortyThree, " | OEM Parts")).toBe(`${fortyThree} | OEM Parts`);
    expect(defaultTitleSuffix()).toBe(SUFFIX);
  });

  test("clampText cuts at a word and never exceeds the limit", () => {
    const text = "a ".repeat(200);
    expect(clampText(text, 155).length).toBeLessThanOrEqual(155);
    expect(clampText("Kratko.", 155)).toBe("Kratko.");
    expect(clampText("jedan dva tri četiri pet šest", 16)).toBe("jedan dva tri…");
  });

  test("buildMetadata: canonical path, robots, OG/Twitter from the same values", () => {
    const m = buildMetadata({
      title: "Turbina za VW Golf",
      description: "d".repeat(300),
      path: "/delovi/turbina/volkswagen/golf",
      noindex: true,
      titleSuffix: SUFFIX,
    });
    expect(m.title).toEqual({ absolute: `Turbina za VW Golf${SUFFIX}` });
    expect(String(m.description).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(m.alternates).toEqual({ canonical: "/delovi/turbina/volkswagen/golf" });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.openGraph).toMatchObject({ url: "/delovi/turbina/volkswagen/golf", locale: "sr_RS" });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });

  test("a final title is used as is (clamped)", () => {
    const m = buildMetadata({
      title: "Turbina Garrett 04L 253 016 H | Euromotors Plus",
      titleIsFinal: true,
      description: "x",
      path: "/deo/turbina",
    });
    expect(m.title).toEqual({ absolute: "Turbina Garrett 04L 253 016 H | Euromotors Plus" });
  });

  test("private pages are noindex, follow", () => {
    expect(privateMetadata("Korpa").robots).toEqual({ index: false, follow: true });
  });
});

describe("page templates", () => {
  test("product title keeps the OEM number and drops the suffix or maker first", () => {
    const short = productTitle(
      { name: "Turbina", manufacturer: "Garrett", code: "04L 253 016 H" },
      SUFFIX,
    );
    expect(short).toBe(`Turbina Garrett 04L 253 016 H${SUFFIX}`);
    expect(short.length).toBeLessThanOrEqual(TITLE_MAX);
    const long = productTitle(
      {
        name: "Kočioni disk prednji 288 × 25 mm, ventilirani",
        manufacturer: "ATE",
        code: "1K0 615 868 F",
      },
      SUFFIX,
    );
    expect(long.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(long.endsWith("1K0 615 868 F")).toBe(true);
    const veryLong = productTitle(
      { name: "Z".repeat(80), manufacturer: "Bosch", code: "0 986 494 xxx" },
      SUFFIX,
    );
    expect(veryLong.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(veryLong.endsWith("0 986 494 xxx")).toBe(true);
  });

  test("product description: price, stock and code survive a long vehicle list", () => {
    const d = productMeta({
      name: "Kočioni disk prednji 288 × 25 mm, ventilirani",
      manufacturer: "ATE",
      qualityLabel: "OEM kvalitet",
      code: "1K0 615 868 F",
      fitmentSummary:
        "VW Golf IV, VW Golf V, VW Golf VI, Škoda Octavia II, SEAT Leon II, Audi A3 8P",
      pricePara: 549_000,
      stockState: "in_stock",
    }).description;
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(d).toContain("Cena 5.490 RSD sa PDV-om.");
    expect(d).toContain("Na stanju.");
    expect(d).toContain("Kat. br. 1K0 615 868 F.");
    expect(d).not.toContain("….");
  });

  test("category, system, landing and generation templates stay within limits", () => {
    const texts = [
      categoryMeta({ name: "Kočione pločice", productCount: 10, inStockCount: 8, page: 2 }),
      systemMeta({
        name: "Kočnice",
        categories: [
          { name: "Kočioni diskovi", count: 16 },
          { name: "Kočione pločice", count: 12 },
        ],
      }),
      landingMeta({
        categoryName: "Amortizeri i opruge",
        brandName: "Volkswagen",
        modelName: "Golf",
        productCount: 6,
        inStockCount: 4,
        price: { minPara: 269_000, maxPara: 849_000 },
        manufacturers: ["KYB", "Sachs", "Bilstein"],
        generations: ["Golf V", "Golf VI", "Golf VII"],
      }),
      generationMeta({
        brandName: "Volkswagen",
        generationName: "Golf VII",
        years: "2012–2020",
        productCount: 41,
        categories: ["Kočioni diskovi", "Filteri"],
        engines: ["2.0 TDI", "1.4 TSI"],
      }),
    ];
    for (const t of texts) {
      expect(pageTitle(t.title, SUFFIX).length).toBeLessThanOrEqual(TITLE_MAX);
      expect(t.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    }
    expect(texts[0]!.title).toBe("Kočione pločice za VW, Audi, Škoda, SEAT — strana 2");
    expect(texts[2]!.title).toBe("Amortizeri i opruge za VW Golf");
    expect(texts[2]!.description).toContain("6 artikala, 4 na stanju");
    expect(texts[3]!.title).toBe("Delovi za VW Golf VII (2012–2020)");
  });

  test("brand landings carry the price promise in the title", () => {
    expect(landingMeta({ categoryName: "Turbina", brandName: "Škoda" }).title).toBe(
      "Turbina za Škodu — cene i stanje",
    );
  });

  test("COPY-01: product titles keep every letter of the name", () => {
    const t = productTitle(
      {
        name: "Kočioni disk prednji 276 × 24 mm",
        manufacturer: "Febi Bilstein",
        code: "5Q0 615 505 R",
      },
      SUFFIX,
    );
    expect(t).toBe("Kočioni disk prednji 276 × 24 mm Febi Bilstein 5Q0 615 505 R");
    const s = productTitle(
      { name: "Set zupčastog kaiša sa vodenom pumpom 1.9 TDI", manufacturer: "INA", code: null },
      SUFFIX,
    );
    // 49 characters: neither form of the suffix fits, so the title stands alone.
    expect(s).toBe("Set zupčastog kaiša sa vodenom pumpom 1.9 TDI INA");
  });

  test("SEO-01: same OEM number from two makers gives two titles, maker kept", () => {
    const name = "Kočioni disk prednji 312 × 25 mm, ventilirani";
    const a = productTitle({ name, manufacturer: "Brembo", code: "1K0 615 591 E" }, SUFFIX);
    const b = productTitle({ name, manufacturer: "ATE", code: "1K0 615 591 E" }, SUFFIX);
    expect(a).not.toBe(b);
    for (const t of [a, b]) {
      expect(t.length).toBeLessThanOrEqual(TITLE_MAX);
      expect(t).not.toContain("…");
      expect(t.endsWith("1K0 615 591 E")).toBe(true);
    }
    expect(a).toBe("Kočioni disk prednji 312 × 25 mm Brembo 1K0 615 591 E");
    expect(b).toContain(" ATE ");
  });

  test("COPY-01/SEO-07: a long vehicle list is cut at whole vehicles, never mid-word", () => {
    const base = {
      name: "Kočione pločice zadnje",
      manufacturer: "Original VAG",
      qualityLabel: "Original VAG",
      code: "5Q0 698 451 AA",
      pricePara: 1_249_000,
      stockState: "in_stock" as const,
    };
    const d = productMeta({ ...base, fitmentSummary: "VW Golf VII, VW Passat B8 i još 10" })
      .description;
    expect(d.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(d).not.toMatch(/\S…/);
    expect(d).not.toContain("Original VAG, Original VAG");
    expect(d).toContain("(Original VAG) za VW Golf VII, VW Passat B8 i još 10.");
    expect(d).toContain("Kat. br. 5Q0 698 451 AA.");
    const longer = productMeta({
      ...base,
      name: "Kočione pločice zadnje, za elektronsku ručnu kočnicu",
      fitmentSummary: "VW Golf VII, VW Passat B8 i još 10",
    }).description;
    expect(longer.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(longer).toContain("za VW Golf VII i još 11.");
    const skoda = productMeta({ ...base, fitmentSummary: "Škoda Octavia III, SEAT Leon III" });
    expect(skoda.description).toContain("za Škodu Octaviju III i SEAT Leon III.");
  });

  test("SEO-03: the vehicle and the page number survive shortening, without an ellipsis", () => {
    const cat = categoryMeta({
      name: "Senzori (lambda, parking, temperatura)",
      productCount: 12,
      inStockCount: 9,
      page: 2,
    });
    expect(rendered(cat)).toBe("Senzori za VW, Audi, Škoda, SEAT — strana 2");
    const seeded = pageTitle(
      "Vešanje i upravljanje za VW, Audi, Škoda, SEAT i Cupra — strana 2",
      SUFFIX,
      " — strana 2",
    );
    expect(seeded).toBe("Vešanje i upravljanje za VW, Audi, Škoda, SEAT — strana 2");
    const landing = landingMeta({
      categoryName: "Senzori (lambda, parking, temperatura)",
      brandName: "Škoda",
      modelName: "Kodiaq",
    });
    expect(rendered(landing)).toBe("Senzori (lambda, parking, temperatura) za Škodu Kodiaq");
    const longer = landingMeta({
      categoryName: "Senzori (lambda, parking, temperatura) i prekidači",
      brandName: "Škoda",
      modelName: "Octavia",
    });
    expect(rendered(longer)).toBe("Senzori i prekidači za Škodu Octaviju");
    for (const t of [cat, landing, longer]) {
      expect(rendered(t).length).toBeLessThanOrEqual(TITLE_MAX);
      expect(rendered(t)).not.toContain("…");
    }
  });

  test("shortenWords never leaves a dangling conjunction, bracket or sign", () => {
    expect(shortenWords("Vešanje i upravljanje za VW, Audi, Škoda, SEAT i Cupra", 48)).toBe(
      "Vešanje i upravljanje za VW, Audi, Škoda, SEAT",
    );
    expect(shortenWords("Kočioni disk prednji 312 × 25 mm", 26)).toBe("Kočioni disk prednji 312");
    expect(shortenWords("Kratko", 20)).toBe("Kratko");
  });

  test("COPY-05: vehicle names decline after „za“", () => {
    expect(accusativeSr("Škoda")).toBe("Škodu");
    expect(accusativeSr("Cupra Formentor")).toBe("Cupru Formentor");
    expect(accusativeSr("Škoda Octavia III (5E)")).toBe("Škodu Octaviju III (5E)");
    expect(accusativeSr("SEAT Ibiza")).toBe("SEAT Ibizu");
    expect(accusativeSr("VW Golf VII")).toBe("VW Golf VII");
    expect(accusativeSr("Audi A3 8P")).toBe("Audi A3 8P");
    expect(accusativeSr("Volkswagen")).toBe("Volkswagen");
    expect(
      generationMeta({
        brandName: "Škoda",
        generationName: "Octavia III",
        years: "2013–2020",
        productCount: 3,
        categories: [],
        engines: [],
      }).title,
    ).toBe("Delovi za Škodu Octaviju III (2013–2020)");
  });

  test("lists: „i“ joins a whole list, „i još N“ only when two or more are left out", () => {
    expect(listMoreSr(["A", "B", "C"], 4)).toBe("A, B i C");
    expect(listMoreSr(["A", "B", "C", "D", "E"], 4)).toBe("A, B, C, D i E");
    expect(listMoreSr(["A", "B", "C", "D", "E", "F"], 4)).toBe("A, B, C, D i još 2");
    expect(listMoreSr(["A", "B"], 2, { hidden: 1 })).toBe("A, B i još 1");
  });

  test("SEO-04: system hub intro and description come from the counts", () => {
    const cats = [
      { name: "Kočioni diskovi", count: 16 },
      { name: "Kočione pločice", count: 12 },
      { name: "ABS senzori", count: 0 },
    ];
    expect(systemIntro({ name: "Kočnice", categories: cats })).toContain(
      "U grupi „Kočnice“ je 28 artikala za VAG vozila u 2 kategorije: Kočioni diskovi (16) i Kočione pločice (12).",
    );
    expect(systemMeta({ name: "Kočnice", categories: cats }).description).toContain(
      "Kočnice: 28 artikala za VAG vozila u 2 kategorije.",
    );
  });

  test("curated searches match case- and space-insensitively", () => {
    expect(isCuratedSearch("  Kocione  Plocice golf 7 ", ["kocione plocice golf 7"])).toBe(true);
    expect(isCuratedSearch("kocione plocice", ["kocione plocice golf 7"])).toBe(false);
    expect(isCuratedSearch("", [""])).toBe(false);
  });
});
