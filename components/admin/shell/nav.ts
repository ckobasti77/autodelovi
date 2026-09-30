/**
 * Admin navigation, grouped by task (DESIGN-SYSTEM §10.10): sell, catalogue, records,
 * configure. `count` keys map to `dashboard.navCounts`; `ownerOnly` items are hidden for
 * staff. Shortcuts: `g` + key (see ShortcutsDialog).
 */
import type { Icon } from "@phosphor-icons/react";
import {
  CarIcon,
  ChartBarIcon,
  ChatCircleTextIcon,
  ClockCounterClockwiseIcon,
  EnvelopeIcon,
  FactoryIcon,
  FileArrowDownIcon,
  FileArrowUpIcon,
  GaugeIcon,
  GearIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  PercentIcon,
  ReceiptIcon,
  StackIcon,
  TreeStructureIcon,
  UserGearIcon,
  UsersIcon,
  WrenchIcon,
} from "@phosphor-icons/react/dist/ssr";

import { ADMIN } from "@/constants/routes";

export type NavCountKey = "orders" | "inquiries" | "mechanics" | "lowStock";

export type AdminNavItem = {
  href: string;
  label: string;
  icon: Icon;
  exact?: boolean;
  count?: NavCountKey;
  /** Letter after `g` that jumps here. */
  key?: string;
  ownerOnly?: boolean;
  /** Extra words for the command palette. */
  keywords?: string;
};

export type AdminNavGroup = { label: string | null; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    label: null,
    items: [
      {
        href: ADMIN.home,
        label: "Pregled",
        icon: GaugeIcon,
        exact: true,
        key: "d",
        keywords: "dashboard pocetna",
      },
    ],
  },
  {
    label: "Prodaja",
    items: [
      {
        href: ADMIN.orders,
        label: "Porudžbine",
        icon: ReceiptIcon,
        count: "orders",
        key: "p",
        keywords: "porudzbine narudzbine",
      },
      {
        href: ADMIN.inquiries,
        label: "Upiti",
        icon: ChatCircleTextIcon,
        count: "inquiries",
        key: "u",
        keywords: "ponude vin",
      },
      {
        href: ADMIN.customers,
        label: "Kupci",
        icon: UsersIcon,
        key: "k",
        keywords: "kupci nalozi",
      },
      {
        href: ADMIN.mechanics,
        label: "Majstori",
        icon: WrenchIcon,
        count: "mechanics",
        key: "m",
        keywords: "servisi rabat",
      },
    ],
  },
  {
    label: "Katalog",
    items: [
      {
        href: ADMIN.products,
        label: "Proizvodi",
        icon: PackageIcon,
        key: "a",
        keywords: "artikli delovi oem",
      },
      {
        href: ADMIN.imports,
        label: "Uvoz iz Excela",
        icon: FileArrowUpIcon,
        key: "i",
        keywords: "uvoz excel xlsx csv cenovnik lager import",
      },
      {
        href: ADMIN.categories,
        label: "Kategorije",
        icon: TreeStructureIcon,
        keywords: "3d delovi",
      },
      {
        href: ADMIN.vehicles,
        label: "Vozila",
        icon: CarIcon,
        keywords: "marke modeli generacije motori",
      },
      {
        href: ADMIN.manufacturers,
        label: "Proizvođači",
        icon: FactoryIcon,
        keywords: "proizvodjaci brendovi",
      },
      {
        href: ADMIN.stock,
        label: "Lager",
        icon: StackIcon,
        count: "lowStock",
        key: "l",
        keywords: "stanje zalihe",
      },
    ],
  },
  {
    label: "Evidencija",
    items: [
      {
        href: ADMIN.searches,
        label: "Pretrage",
        icon: MagnifyingGlassIcon,
        keywords: "trazeno nemamo",
      },
      {
        href: ADMIN.sources,
        label: "Izvori",
        icon: ChartBarIcon,
        keywords: "izvori kampanje oglasi google meta utm konverzije",
      },
      {
        href: ADMIN.emails,
        label: "E-pošta",
        icon: EnvelopeIcon,
        keywords: "mejlovi outbox posta",
      },
      {
        href: ADMIN.exports,
        label: "Izvoz",
        icon: FileArrowDownIcon,
        keywords: "izvoz excel csv preuzmi export",
      },
      {
        href: ADMIN.audit,
        label: "Revizija",
        icon: ClockCounterClockwiseIcon,
        keywords: "audit istorija izmena",
      },
    ],
  },
  {
    label: "Podešavanja",
    items: [
      { href: ADMIN.tiers, label: "Cenovni razredi", icon: PercentIcon, keywords: "rabat nivoi" },
      {
        href: ADMIN.users,
        label: "Korisnici",
        icon: UserGearIcon,
        ownerOnly: true,
        keywords: "zaposleni pozivnice uloge",
      },
      {
        href: ADMIN.settings,
        label: "Podešavanja",
        icon: GearIcon,
        key: "s",
        keywords: "firma dostava placanje pracenje",
      },
    ],
  },
];

export function navItems(isOwner: boolean): AdminNavItem[] {
  return ADMIN_NAV.flatMap((g) => g.items).filter((i) => isOwner || !i.ownerOnly);
}

export function isActive(pathname: string, item: AdminNavItem): boolean {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}
