import type { Metadata } from "next";

import { LandingPage, landingMetadata } from "@/components/catalog/LandingPage";

export async function generateMetadata({
  params,
}: PageProps<"/delovi/[kategorija]/[marka]/[model]">): Promise<Metadata> {
  const { kategorija, marka, model } = await params;
  return landingMetadata(kategorija, marka, model);
}

export default async function ModelLandingPage({
  params,
  searchParams,
}: PageProps<"/delovi/[kategorija]/[marka]/[model]">) {
  const { kategorija, marka, model } = await params;
  return (
    <LandingPage kategorija={kategorija} marka={marka} model={model} searchParams={await searchParams} />
  );
}
