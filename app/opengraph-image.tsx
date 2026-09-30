import { site } from "@/config/site";
import { OG_CONTENT_TYPE, OG_SIZE, ogFrame, ogImageData } from "@/lib/og/frame";

/** Default OG image (DESIGN-SYSTEM §2.3): hero render + the promise; config only (no data). */
export const alt = `${site.brand.name} — delovi za Volkswagen, Audi, Škoda, SEAT i Cupra`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image() {
  return ogFrame({
    title: "Delovi za VW, Audi, Škoda, SEAT i Cupra",
    meta: { label: "Pretraga po", code: "OEM broju", after: "vozilu i VIN-u" },
    count: "Pouzeće ili preuzimanje u radnji",
    image: await ogImageData("/images/hero/car-exploded-1080.webp"),
  });
}
