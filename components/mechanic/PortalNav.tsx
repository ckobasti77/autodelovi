"use client";

import {
  CarIcon,
  ChatCircleTextIcon,
  StarIcon,
  UserCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { SectionHeading, SectionNav, type SectionNavItem } from "@/components/account/SectionNav";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

/** What a mechanic opens every day: the tab row. */
const PRIMARY: SectionNavItem[] = [
  { href: ROUTES.mechanicPortal, label: "Pregled", exact: true },
  { href: ROUTES.mechanicQuickOrderPage, label: "Brza porudžbina" },
  { href: ROUTES.mechanicOrders, label: "Porudžbine" },
  { href: ROUTES.mechanicPriceList, label: "Cenovnik" },
];

/** The rest sits behind „Još“ (and as tiles on the overview). */
const MORE: SectionNavItem[] = [
  { href: ROUTES.mechanicFavorites, label: "Omiljeno", icon: <StarIcon size={16} /> },
  { href: ROUTES.mechanicVehicles, label: "Vozila mušterija", icon: <CarIcon size={16} /> },
  { href: ROUTES.mechanicInquiries, label: "Upiti", icon: <ChatCircleTextIcon size={16} /> },
  { href: ROUTES.mechanicProfile, label: "Profil", icon: <UserCircleIcon size={16} /> },
];

const AREA = "Majstorski portal";

/** Portal navigation: four tabs as links and the „Još“ menu (44 px targets). */
export function PortalNav() {
  return (
    <SectionNav label={AREA} primary={PRIMARY} more={MORE} testId={TEST_IDS.mechanicPortalNav} />
  );
}

/** Portal heading: „Majstorski portal“ on the overview, the open view everywhere else. */
export function PortalHeading({ company }: { company: string }) {
  return (
    <SectionHeading
      area={AREA}
      rootHref={ROUTES.mechanicPortal}
      context={company}
      items={[...PRIMARY.slice(1), ...MORE]}
      records={[{ prefix: ROUTES.mechanicOrders, title: "Porudžbina" }]}
    />
  );
}
