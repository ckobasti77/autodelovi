/**
 * Google Ads offline conversions CSV (SEO-ADS §J8) in the legacy upload template: a
 * `Parameters:TimeZone=` line, then one row per completed order with its Google click id.
 * Conversion names must match the conversion action in Google Ads exactly.
 */
import { csvField } from "@/lib/seo/feeds";

export const OFFLINE_HEADER = [
  "Google Click ID",
  "Conversion Name",
  "Conversion Time",
  "Conversion Value",
  "Conversion Currency",
] as const;

export const DEFAULT_OFFLINE_CONVERSION_NAME = "Zavrsena porudzbina";

export function offlineConversionsCsv(
  rows: { gclid: string; time: string; valuePara: number }[],
  conversionName: string | null,
): string {
  const name = conversionName?.trim() || DEFAULT_OFFLINE_CONVERSION_NAME;
  const lines = ["Parameters:TimeZone=Europe/Belgrade", OFFLINE_HEADER.join(",")];
  for (const r of rows) {
    // Click ids come from a URL parameter; anything outside the gclid alphabet is not a real id
    // (and could be a spreadsheet formula), so the row is left out.
    if (!/^[A-Za-z0-9_-]{8,512}$/.test(r.gclid)) continue;
    lines.push(
      [r.gclid, name, r.time, (r.valuePara / 100).toFixed(2), "RSD"].map(csvField).join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}
