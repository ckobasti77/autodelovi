import type { Metadata } from "next";

import { ContentPageView, contentMetadata } from "@/components/content/ContentPageView";
import { ROUTES } from "@/constants/routes";

export function generateMetadata(): Promise<Metadata> {
  return contentMetadata("kolacici", ROUTES.cookies);
}

export default function Page() {
  return <ContentPageView slug="kolacici" path={ROUTES.cookies} />;
}
