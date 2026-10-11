import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import manifest from "@/app/manifest";
import { site } from "@/config/site";
import {
  LogoHeader,
  LogoLockup,
  LogoLockupResponsive,
  LogoMark,
} from "@/components/brand/Logo";
import {
  LOGO_HEADER,
  LOGO_LAYOUT,
  LOGO_MARK,
  LOGO_WORDMARK,
} from "@/components/brand/logoPaths";
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
    expect(BRAND_LOCKUP_NAME).toBe("Euromotors Plus by OEM Parts");
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
    expect(m.name).toBe("Euromotors Plus by OEM Parts");
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
    expect(renderToStaticMarkup(<LogoHeader />)).toMatch(
      /^<svg[^>]* role="img" aria-label="Euromotors Plus"/,
    );
    expect(renderToStaticMarkup(<LogoMark />)).toContain('aria-label="Euromotors Plus"');
    expect(renderToStaticMarkup(<LogoLockup />)).toContain(
      'aria-label="Euromotors Plus by OEM Parts"',
    );
    const hidden = renderToStaticMarkup(<LogoHeader label={null} />);
    expect(hidden).toContain('aria-hidden="true"');
    expect(hidden).not.toContain("role=");
  });

  it("ink follows the text colour, only the plus is the accent", () => {
    const html = renderToStaticMarkup(<LogoLockup variant="stacked" />);
    expect(html.match(/fill="currentColor"/g)).toHaveLength(2);
    expect(html.match(/class="fill-accent"/g)).toHaveLength(1);
    expect(html).not.toMatch(/#[0-9a-f]{6}/i);
    expect(html).toContain(`viewBox="0 0 ${LOGO_LAYOUT.stacked.w} ${LOGO_LAYOUT.stacked.h}"`);
  });

  it("the responsive lockup carries the outlines once and one name", () => {
    const html = renderToStaticMarkup(<LogoLockupResponsive />);
    expect(html.split(LOGO_WORDMARK.ink)).toHaveLength(2);
    expect(html.match(/<use /g)).toHaveLength(4);
    expect(html.match(/aria-label=/g)).toHaveLength(1);
    expect(html).toMatch(/^<span role="img" aria-label="Euromotors Plus by OEM Parts"/);
  });

  it("generated paths match the kit files they were read from", () => {
    const d = (file: string, fill: string) =>
      new RegExp(`<path fill="${fill}"[^>]*? d="([^"]+)"`).exec(read(`public/brand/${file}`))?.[1];
    expect(LOGO_HEADER.ink).toBe(d("logo-header-night.svg", "#f1ece3"));
    expect(LOGO_HEADER.accent).toBe(d("logo-header-night.svg", "#ff6b1a"));
    expect(LOGO_MARK.ink).toBe(d("mark-night.svg", "#f1ece3"));
    expect(LOGO_MARK.accent).toBe(d("mark-night.svg", "#ff6b1a"));
    expect(LOGO_WORDMARK.ink).toBe(d("logo-wordmark-night.svg", "#f1ece3"));
    // Header lockup: 28 px minimum → 236 px wide; with the signature: 56 px → 445 px.
    expect(Math.round((LOGO_HEADER.w / LOGO_HEADER.h) * 28)).toBe(236);
    expect(Math.round((LOGO_LAYOUT.horizontal.w / LOGO_LAYOUT.horizontal.h) * 56)).toBe(445);
  });
});
