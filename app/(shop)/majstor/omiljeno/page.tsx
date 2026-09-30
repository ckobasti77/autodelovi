import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { requireMechanicPage } from "@/lib/server/auth";
import { FavoritesList } from "@/components/mechanic/FavoritesList";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Omiljeno");

export default async function MechanicFavoritesPage() {
  await requireMechanicPage(ROUTES.mechanicFavorites);
  return <FavoritesList />;
}
