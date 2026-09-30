import type { Metadata } from "next";

import { LandingPage, landingMetadata } from "@/components/catalog/LandingPage";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/delovi/[kategorija]/[marka]">): Promise<Metadata> {
  const { kategorija, marka } = await params;
  return landingMetadata(kategorija, marka, undefined, await searchParams);
}

export default async function BrandLandingPage({
  params,
  searchParams,
}: PageProps<"/delovi/[kategorija]/[marka]">) {
  const { kategorija, marka } = await params;
  return <LandingPage kategorija={kategorija} marka={marka} searchParams={await searchParams} />;
}
