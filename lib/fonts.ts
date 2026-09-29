/**
 * Font loading (DESIGN-SYSTEM §4.1–4.2). next/font self-hosts every file and generates
 * size-adjusted fallbacks, so swapping never shifts layout.
 *
 * The next/font CSS variables are named `--nf-*`; app/globals.css maps them onto the
 * Tailwind theme (`--font-display`, `--font-ui`, …) so the two never shadow each other.
 *
 * Preloaded for first paint: Archivo Expanded 700 (hero statement, wordmark), Archivo
 * Condensed 600 (prices) and Public Sans (all UI text) ≈ 76 KB. Archivo Expanded 600 (section
 * titles below the fold) and Martian Mono (codes) load on demand.
 */
import localFont from "next/font/local";
import { Martian_Mono, Public_Sans } from "next/font/google";

export const display = localFont({
  src: [{ path: "../app/fonts/archivo-expanded-700.woff2", weight: "700", style: "normal" }],
  variable: "--nf-display",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

export const displaySemibold = localFont({
  src: [{ path: "../app/fonts/archivo-expanded-600.woff2", weight: "600", style: "normal" }],
  variable: "--nf-display-600",
  display: "swap",
  preload: false,
  fallback: ["Arial", "sans-serif"],
});

export const condensed = localFont({
  src: [{ path: "../app/fonts/archivo-condensed-600.woff2", weight: "600", style: "normal" }],
  variable: "--nf-condensed",
  display: "swap",
  fallback: ["Arial Narrow", "Arial", "sans-serif"],
});

export const ui = Public_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--nf-ui",
  display: "swap",
});

export const mono = Martian_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--nf-mono",
  display: "swap",
  preload: false,
});

/** Class list for <html>: exposes every font variable to the whole document. */
export const fontVariables = [
  display.variable,
  displaySemibold.variable,
  condensed.variable,
  ui.variable,
  mono.variable,
].join(" ");
