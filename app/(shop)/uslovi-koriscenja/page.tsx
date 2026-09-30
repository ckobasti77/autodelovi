import type { Metadata } from "next";

import { ContentPageView, contentMetadata } from "@/components/content/ContentPageView";
import { ROUTES } from "@/constants/routes";

export function generateMetadata(): Promise<Metadata> {
  return contentMetadata("uslovi-koriscenja", ROUTES.terms);
}

export default function Page() {
  return <ContentPageView slug="uslovi-koriscenja" path={ROUTES.terms} />;
}
