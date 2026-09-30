import type { Metadata } from "next";

import { ContentPageView, contentMetadata } from "@/components/content/ContentPageView";
import { ROUTES } from "@/constants/routes";

export function generateMetadata(): Promise<Metadata> {
  return contentMetadata("politika-privatnosti", ROUTES.privacy);
}

export default function Page() {
  return <ContentPageView slug="politika-privatnosti" path={ROUTES.privacy} />;
}
