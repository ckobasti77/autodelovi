/**
 * Google product taxonomy ids per category (SEO-ADS §J9), verified against
 * taxonomy-with-ids.en-US.txt on 2026-09-30. Category overrides win over the system default;
 * `categories.googleCategoryId` (admin) wins over both. Fallback: 899 Motor Vehicle Parts.
 */

export const MOTOR_VEHICLE_PARTS = 899;

const BY_SYSTEM: Record<string, number> = {
  "motor-i-usis": 2820, // Motor Vehicle Engine Parts
  "izduvni-sistem": 908, // Motor Vehicle Exhaust
  "hladjenje-i-klima": 2805, // Motor Vehicle Climate Control
  transmisija: 2641, // Motor Vehicle Transmission & Drivetrain Parts
  "vesanje-i-upravljanje": 2935, // Motor Vehicle Suspension Parts
  kocnice: 2977, // Motor Vehicle Braking
  "elektrika-i-svetla": 8231, // Motor Vehicle Power & Electrical Systems
  karoserija: 8227, // Motor Vehicle Frame & Body Parts
  tockovi: 3020, // Motor Vehicle Wheel Systems
  servis: 2820,
};

const BY_CATEGORY: Record<string, number> = {
  "brizgaljke-pumpa-goriva": 2727, // Motor Vehicle Fuel Systems
  "filter-goriva": 2727,
  "karter-dihtunzi": 2550, // Motor Vehicle Engine Oil Circulation
  "filter-ulja": 2550,
  "ulja-tecnosti": 2550,
  farovi: 3318, // Motor Vehicle Lighting
  "stop-svetla": 3318,
  senzori: 8234, // Motor Vehicle Sensors & Gauges
  "abs-senzori": 8234,
  retrovizori: 2642, // Motor Vehicle Mirrors
  stakla: 2534, // Motor Vehicle Window Parts & Accessories
  brisaci: 2534,
  "felne-gume": 3020,
  "lezaj-glavcina": 2556, // Motor Vehicle Wheel Parts
  "hladnjak-ventilator": 2805,
  "termostat-creva": 2805,
  klima: 2805,
};

export function googleCategoryFor(input: {
  categorySlug: string;
  parentSlug?: string | null;
  systemSlug: string;
  override?: number | null;
}): number {
  if (input.override) return input.override;
  return (
    BY_CATEGORY[input.categorySlug] ??
    (input.parentSlug ? BY_CATEGORY[input.parentSlug] : undefined) ??
    BY_SYSTEM[input.systemSlug] ??
    MOTOR_VEHICLE_PARTS
  );
}
