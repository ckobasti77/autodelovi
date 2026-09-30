import { OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/frame";
import { landingOgImage } from "@/lib/og/landing";

export const alt = "Delovi po kategoriji za marku vozila — broj artikala i stanje";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const revalidate = 86400;

export default async function Image({
  params,
}: {
  params: Promise<{ kategorija: string; marka: string }>;
}) {
  const { kategorija, marka } = await params;
  return landingOgImage(kategorija, marka);
}
