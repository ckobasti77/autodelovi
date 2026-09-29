/** Token data for the styleguide, read from the design-system source (docs/design/tokens.json). */
import tokens from "@/docs/design/tokens.json";

type Theme = "night" | "paper";

const kebab = (name: string) =>
  name
    .replace(/([a-z])([A-Z0-9])/g, "$1-$2")
    .replace(/([a-z])(\d)/g, "$1-$2")
    .toLowerCase();

export type Swatch = { token: string; cssVar: string; hex: string };

/** Map tokens.json names (ink1, surfaceSubtle…) onto the CSS variable names in globals.css. */
function cssVarFor(name: string): string {
  return `--color-${kebab(name).replace(/-(\d)/g, "-$1")}`;
}

export function swatches(theme: Theme): Swatch[] {
  const group = tokens.color[theme] as Record<string, string>;
  return Object.entries(group)
    .filter(([, value]) => typeof value === "string" && value.startsWith("#"))
    .map(([name, hex]) => ({
      token: kebab(name),
      cssVar: cssVarFor(name),
      hex: hex.toUpperCase(),
    }));
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

export function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x) as [number, number];
  return (a + 0.05) / (b + 0.05);
}

export type ContrastRow = {
  use: string;
  fg: string;
  bg: string;
  fgHex: string;
  bgHex: string;
  ratio: number;
  min: number;
};

function resolve(ref: string): string {
  const [theme, name] = ref.split(".") as [keyof typeof tokens.color, string];
  return ((tokens.color[theme] as Record<string, string>)[name] ?? "#000000").toUpperCase();
}

export function contrastRows(): ContrastRow[] {
  return tokens.contrastPairs.map((pair) => {
    const fgHex = resolve(pair.fg);
    const bgHex = resolve(pair.bg);
    return {
      use: pair.use,
      fg: pair.fg,
      bg: pair.bg,
      fgHex,
      bgHex,
      ratio: contrast(fgHex, bgHex),
      min: pair.min,
    };
  });
}
