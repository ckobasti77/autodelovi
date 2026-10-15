import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { site } from "@/config/site";
import {
  LogoDocument,
  LogoHorizontal,
  LogoMark,
  LogoStacked,
} from "@/components/brand/Logo";
import { LOGO_HORIZONTAL, LOGO_MARK, LOGO_STACKED } from "@/components/brand/logoPaths";
import {
  BRAND_ALTERNATE_NAME,
  BRAND_LOCKUP_NAME,
  BRAND_NAME,
  BRAND_SHORT_NAME,
  DEFAULT_TITLE_SUFFIX,
  titleSuffixFor,
  titleSuffixTiers,
} from "@/lib/domain/brand";
import { DEFAULT_SETTINGS } from "@/convex/lib/settings";

const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

describe("naming rules (D307)", () => {
  it("brand, known shop name and the lockup", () => {
    expect(BRAND_NAME).toBe("Euromotors Plus");
    expect(BRAND_ALTERNATE_NAME).toBe("OEM Parts");
    expect(BRAND_LOCKUP_NAME).toBe("Euromotors Plus · OEM Parts");
    expect(BRAND_SHORT_NAME.length).toBeLessThanOrEqual(12);
    expect(site.brand).toMatchObject({
      name: BRAND_NAME,
      alternateName: BRAND_ALTERNATE_NAME,
      lockupName: BRAND_LOCKUP_NAME,
      shortName: BRAND_SHORT_NAME,
    });
  });

  it("title suffix: both names, with the brand alone as the shorter form", () => {
    expect(DEFAULT_TITLE_SUFFIX).toBe(" | Euromotors Plus · OEM Parts");
    expect(titleSuffixTiers(DEFAULT_TITLE_SUFFIX)).toEqual([
      " | Euromotors Plus · OEM Parts",
      " | Euromotors Plus",
    ]);
    expect(titleSuffixFor("Euromotors Plus", "")).toBe(" | Euromotors Plus");
    expect(titleSuffixTiers(" | Euromotors Plus")).toEqual([" | Euromotors Plus"]);
    // A suffix that is only a separator and a second name is not shortened to nothing.
    expect(titleSuffixTiers(" · OEM Parts")).toEqual([" · OEM Parts"]);
  });

  it("settings defaults carry the names; company facts stay empty", () => {
    expect(DEFAULT_SETTINGS.brand).toMatchObject({
      name: BRAND_NAME,
      alternateName: BRAND_ALTERNATE_NAME,
    });
    expect(DEFAULT_SETTINGS.seo.titleSuffix).toBe(DEFAULT_TITLE_SUFFIX);
    expect(DEFAULT_SETTINGS.company.legalName).toBe("");
    expect(DEFAULT_SETTINGS.company.phones).toEqual([]);
    // As a word: the tagline keeps the verb in "Rasklopi auto."
    expect(JSON.stringify(DEFAULT_SETTINGS)).not.toMatch(/\bsklop\b/i);
  });
});

describe("web manifest and icons", () => {
  const m = manifest();

  it("names and colours", () => {
    expect(m.name).toBe("Euromotors Plus · OEM Parts");
    expect(m.short_name).toBe("Euromotors");
    expect(m.theme_color).toBe("#0D0F11");
    expect(m.background_color).toBe("#0D0F11");
  });

  it("every icon exists in the logo kit", () => {
    expect(m.icons?.map((i) => i.src)).toEqual([
      "/brand/icon-192.png",
      "/brand/icon-512.png",
      "/brand/icon-maskable-192.png",
      "/brand/icon-maskable-512.png",
    ]);
    for (const icon of m.icons ?? []) expect(existsSync(join(ROOT, "public", icon.src))).toBe(true);
    expect(existsSync(join(ROOT, "public/icons"))).toBe(false);
  });

  it("app icons are the kit's files, not the retired mark", () => {
    const kit = (name: string) => readFileSync(join(ROOT, "public/brand", name));
    expect(readFileSync(join(ROOT, "app/favicon.ico")).equals(kit("favicon.ico"))).toBe(true);
    expect(readFileSync(join(ROOT, "app/apple-icon.png")).equals(kit("apple-touch-icon.png"))).toBe(
      true,
    );
    const icon = read("app/icon.svg");
    expect(icon).toContain("<title>Euromotors Plus</title>");
    // The slotted base of the old „izvučen deo“ mark.
    expect(icon).not.toContain("M3 14h4v2.5h10V14h4v7H3z");
    for (const size of ["h16", "h32", "h48"]) expect(icon).toContain(`class="${size}"`);
  });
});

describe("inline logo", () => {
  it("accessible name by default, hidden from assistive technology on request", () => {
    expect(renderToStaticMarkup(<LogoHorizontal />)).toMatch(
      /^<svg[^>]* role="img" aria-label="Euromotors Plus · OEM Parts"/,
    );
    expect(renderToStaticMarkup(<LogoMark />)).toContain('aria-label="Euromotors Plus"');
    expect(renderToStaticMarkup(<LogoStacked />)).toContain(
      'aria-label="Euromotors Plus · OEM Parts"',
    );
    const hidden = renderToStaticMarkup(<LogoHorizontal label={null} />);
    expect(hidden).toContain('aria-hidden="true"');
    expect(hidden).not.toContain("role=");
  });

  it("one ink that follows the text colour, no accent", () => {
    for (const html of [
      renderToStaticMarkup(<LogoStacked />),
      renderToStaticMarkup(<LogoHorizontal />),
      renderToStaticMarkup(<LogoMark />),
    ]) {
      expect(html.match(/<path /g)).toHaveLength(1);
      expect(html).toContain('fill="currentColor"');
      expect(html).not.toContain("accent");
      expect(html).not.toMatch(/#[0-9a-f]{6}/i);
    }
    expect(renderToStaticMarkup(<LogoStacked />)).toContain(
      `viewBox="0 0 ${LOGO_STACKED.w} ${LOGO_STACKED.h}"`,
    );
  });

  it("documents print the heritage navy", () => {
    expect(renderToStaticMarkup(<LogoDocument />)).toMatch(/^<span class="[^"]*\btext-heritage\b/);
    expect(read("app/globals.css")).toContain("--color-heritage: #1b2a6b;");
  });

  it("generated paths match the kit files they were read from", () => {
    const d = (file: string) =>
      /<path fill="#f1ece3"[^>]*? d="([^"]+)"/.exec(read(`public/brand/${file}`))?.[1];
    expect(LOGO_HORIZONTAL.d).toBe(d("logo-horizontal-night.svg"));
    expect(LOGO_STACKED.d).toBe(d("logo-stacked-night.svg"));
    expect(LOGO_MARK.d).toBe(d("mark-small-night.svg"));
    // Header lockup: 44 px → 236 px wide (the admin sidebar has 236), 48 px → 258 px; the
    // stacked logo is 1.55 : 1.
    expect(Math.round((LOGO_HORIZONTAL.w / LOGO_HORIZONTAL.h) * 44)).toBe(236);
    expect(Math.round((LOGO_HORIZONTAL.w / LOGO_HORIZONTAL.h) * 48)).toBe(258);
    expect(LOGO_STACKED.w / LOGO_STACKED.h).toBeCloseTo(1.551, 2);
  });

  it("the retired bracket mark and its orange plus are gone from the kit", () => {
    for (const file of ["logo-horizontal-night.svg", "logo-stacked-night.svg", "mark-night.svg"]) {
      const svg = read(`public/brand/${file}`);
      expect(svg).not.toMatch(/#ff6b1a/i);
      expect(svg.match(/<path /g)).toHaveLength(1);
    }
    expect(existsSync(join(ROOT, "public/brand/logo-header-night.svg"))).toBe(false);
    expect(existsSync(join(ROOT, "public/brand/logo-dual-night.svg"))).toBe(false);
  });
});
