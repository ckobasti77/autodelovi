import type { Metadata } from "next";

import { ContentPageView, contentMetadata } from "@/components/content/ContentPageView";
import { ROUTES } from "@/constants/routes";

export function generateMetadata(): Promise<Metadata> {
  return contentMetadata("o-nama", ROUTES.about);
}

export default function Page() {
  return <ContentPageView slug="o-nama" path={ROUTES.about} />;
}
