// Concept-only font wiring (step 03). Step 04 moves this into lib/fonts.ts + the root layout.
// Display: Archivo static instances (scripts/fonts/fetch-display-fonts.mjs) — one file each,
// subset to Latin + Latin-1 + Latin Extended-A (č ć ž š đ). Preload only what the first paint uses.
import localFont from "next/font/local";
import { Martian_Mono, Public_Sans } from "next/font/google";

export const display = localFont({
  src: [{ path: "../../fonts/archivo-expanded-700.woff2", weight: "700", style: "normal" }],
  variable: "--font-display",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

export const displaySemibold = localFont({
  src: [{ path: "../../fonts/archivo-expanded-600.woff2", weight: "600", style: "normal" }],
  variable: "--font-display-600",
  display: "swap",
  preload: false,
  fallback: ["Arial", "sans-serif"],
});

export const condensed = localFont({
  src: [{ path: "../../fonts/archivo-condensed-600.woff2", weight: "600", style: "normal" }],
  variable: "--font-condensed",
  display: "swap",
  fallback: ["Arial Narrow", "Arial", "sans-serif"],
});

export const uiSans = Public_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-ui",
  display: "swap",
});

export const mono = Martian_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
  display: "swap",
  preload: false,
});

export const fontVariables = [display, displaySemibold, condensed, uiSans, mono]
  .map((font) => font.variable)
  .join(" ");
