import { describe, expect, test } from "vitest";

import {
  buildMetadata,
  clampText,
  DESCRIPTION_MAX,
  pageTitle,
  privateMetadata,
  TITLE_MAX,
} from "@/lib/seo/metadata";
import {
  categoryMeta,
  generationMeta,
  isCuratedSearch,
  landingMeta,
  productMeta,
  productTitle,
  systemMeta,
} from "@/lib/seo/templates";

const SUFFIX = " | SKLOP";

describe("title and description limits", () => {
  test("keyword first, brand suffix, ≤ 60 characters", () => {
    expect(pageTitle("Kočioni diskovi za VW, Audi, Škoda, SEAT", SUFFIX)).toBe(
      "Kočioni diskovi za VW, Audi, Škoda, SEAT | SKLOP",
    );
    const long = pageTitle(
      "Set zupčastog kaiša i vodena pumpa za VW, Audi, Škoda, SEAT i Cupru",
      SUFFIX,
    );
    expect(long.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(long.startsWith("Set zupčastog kaiša")).toBe(true);
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
    expect(m.title).toEqual({ absolute: "Turbina za VW Golf | SKLOP" });
    expect(String(m.description).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    expect(m.alternates).toEqual({ canonical: "/delovi/turbina/volkswagen/golf" });
    expect(m.robots).toEqual({ index: false, follow: true });
    expect(m.openGraph).toMatchObject({ url: "/delovi/turbina/volkswagen/golf", locale: "sr_RS" });
    expect(m.twitter).toMatchObject({ card: "summary_large_image" });
  });

  test("a final title is used as is (clamped)", () => {
    const m = buildMetadata({
      title: "Turbina Garrett 04L 253 016 H | SKLOP",
      titleIsFinal: true,
      description: "x",
      path: "/deo/turbina",
    });
    expect(m.title).toEqual({ absolute: "Turbina Garrett 04L 253 016 H | SKLOP" });
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
    expect(short).toBe("Turbina Garrett 04L 253 016 H | SKLOP");
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
      systemMeta({ name: "Kočnice", categories: ["Kočioni diskovi", "Kočione pločice"] }),
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
      "Turbina za Škoda — cene i stanje",
    );
  });

  test("curated searches match case- and space-insensitively", () => {
    expect(isCuratedSearch("  Kocione  Plocice golf 7 ", ["kocione plocice golf 7"])).toBe(true);
    expect(isCuratedSearch("kocione plocice", ["kocione plocice golf 7"])).toBe(false);
    expect(isCuratedSearch("", [""])).toBe(false);
  });
});
