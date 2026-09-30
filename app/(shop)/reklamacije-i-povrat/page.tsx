import type { Metadata } from "next";

import { ContentPageView, contentMetadata } from "@/components/content/ContentPageView";
import { ROUTES } from "@/constants/routes";

export function generateMetadata(): Promise<Metadata> {
  return contentMetadata("reklamacije-i-povrat", ROUTES.returns);
}

export default function Page() {
  return <ContentPageView slug="reklamacije-i-povrat" path={ROUTES.returns} />;
}
