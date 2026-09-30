/**
 * Mechanic (B2B) strings shared by `/za-majstore`, the `/majstor` portal and the staff
 * approval screens (DESIGN-SYSTEM §11). Page copy that appears once lives next to the page.
 */
import type { BadgeTone } from "@/components/ui/Badge";
import { countSr } from "@/lib/format/plural";

export type ServiceType =
  | "mehanika"
  | "elektrika"
  | "limarija"
  | "vulkanizer"
  | "dijagnostika"
  | "klima"
  | "ostalo";

export const SERVICE_TYPES: readonly { value: ServiceType; label: string }[] = [
  { value: "mehanika", label: "Mehanika" },
  { value: "elektrika", label: "Autoelektrika" },
  { value: "dijagnostika", label: "Dijagnostika" },
  { value: "klima", label: "Klima" },
  { value: "limarija", label: "Limarija i farbanje" },
  { value: "vulkanizer", label: "Vulkanizer" },
  { value: "ostalo", label: "Ostalo" },
];

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = Object.fromEntries(
  SERVICE_TYPES.map((s) => [s.value, s.label]),
) as Record<ServiceType, string>;

export type MechanicStatus = "pending" | "approved" | "rejected" | "suspended";

export const MECHANIC_STATUS_LABEL: Record<MechanicStatus, string> = {
  pending: "Čeka odobrenje",
  approved: "Odobren",
  rejected: "Odbijen",
  suspended: "Pauziran",
};

export const MECHANIC_STATUS_TONE: Record<MechanicStatus, BadgeTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  suspended: "neutral",
};

export const QUALITY_LABEL: Record<"original" | "oem" | "aftermarket", string> = {
  original: "Original VAG",
  oem: "OEM kvalitet",
  aftermarket: "Aftermarket",
};

export const QUICK_ORDER_COPY = {
  title: "Brza porudžbina",
  placeholder: "1K0615301AA 2\n5Q0 698 151 x4\n2x 1K0-698-151",
  help: "Jedan broj po redu, količina posle broja. Razmaci, tačke i crtice ne smetaju. Do 200 redova.",
  check: "Proveri brojeve",
  csv: "Otpremi CSV",
  csvHelp: "CSV ili TXT do 200 KB: kolona sa brojem dela i, po želji, kolona sa količinom.",
  exact: "Tačno",
  ambiguous: "Više opcija",
  notFound: "Nije pronađeno",
  choose: "Izaberite proizvođača",
  addAll: (n: number) => `Dodaj sve u korpu (${n})`,
  inquire: (n: number) => `Pošalji upit za nepronađene (${n})`,
  waiting: (n: number) =>
    `${countSr(n, ["red čeka", "reda čekaju", "redova čeka"])} izbor proizvođača.`,
  clear: "Očisti",
} as const;
