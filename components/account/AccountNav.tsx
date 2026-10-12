"use client";

import { UserCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { SectionHeading, SectionNav, type SectionNavItem } from "@/components/account/SectionNav";
import { ROUTES } from "@/constants/routes";

const PRIMARY: SectionNavItem[] = [
  { href: ROUTES.account, label: "Pregled", exact: true },
  { href: ROUTES.accountOrders, label: "Porudžbine" },
  { href: ROUTES.accountInquiries, label: "Upiti" },
  { href: ROUTES.accountVehicles, label: "Vozila" },
];

const MORE: SectionNavItem[] = [
  { href: ROUTES.accountProfile, label: "Profil", icon: <UserCircleIcon size={16} /> },
];

const AREA = "Moj nalog";

/** Account navigation: four tabs as links; the profile and sign-out sit behind „Još“. */
export function AccountNav() {
  return <SectionNav label="Nalog" primary={PRIMARY} more={MORE} />;
}

/** Account heading: „Moj nalog“ on the overview, the open view everywhere else (A11Y-21). */
export function AccountHeading({ who }: { who: string }) {
  return (
    <SectionHeading
      area={AREA}
      rootHref={ROUTES.account}
      context={who}
      overviewContext={`Prijavljeni ste kao ${who}`}
      items={[...PRIMARY.slice(1), ...MORE]}
      records={[{ prefix: ROUTES.accountOrders, title: "Porudžbina" }]}
    />
  );
}
