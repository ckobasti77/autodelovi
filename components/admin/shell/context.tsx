"use client";

/**
 * Admin shell context: the signed-in staff member, the palette opener and the label of the
 * current detail page for the breadcrumb (a product name instead of its id).
 */
import { createContext, useContext, useEffect } from "react";

export type AdminViewer = {
  userId: string;
  name: string;
  email: string | null;
  isOwner: boolean;
};

export type AdminShellValue = {
  viewer: AdminViewer;
  openPalette: () => void;
  setCrumb: (label: string | null) => void;
};

export const AdminShellContext = createContext<AdminShellValue | null>(null);

export function useAdminShell(): AdminShellValue {
  const value = useContext(AdminShellContext);
  if (!value) throw new Error("useAdminShell outside AdminShell");
  return value;
}

/** Sets the last breadcrumb label while the page is mounted. */
export function useAdminCrumb(label: string | null | undefined): void {
  const { setCrumb } = useAdminShell();
  useEffect(() => {
    setCrumb(label ?? null);
    return () => setCrumb(null);
  }, [label, setCrumb]);
}

const SEGMENTS: Record<string, string> = {
  porudzbine: "Porudžbine",
  upiti: "Upiti",
  proizvodi: "Proizvodi",
  novi: "Novi artikal",
  kategorije: "Kategorije",
  vozila: "Vozila",
  proizvodjaci: "Proizvođači",
  lager: "Lager",
  kupci: "Kupci",
  majstori: "Majstori",
  "cenovni-razredi": "Cenovni razredi",
  podesavanja: "Podešavanja",
  korisnici: "Korisnici",
  revizija: "Revizija",
  mejlovi: "E-pošta",
  sabloni: "Šabloni",
  pretrage: "Pretrage",
  obavestenja: "Obaveštenja",
  uvoz: "Uvoz iz Excela",
  istorija: "Istorija",
  izvoz: "Izvoz",
};

/** `/admin/porudzbine/SK-2026-000187` → Pregled / Porudžbine / SK-2026-000187. */
export function breadcrumbTrail(
  pathname: string,
  crumb: string | null,
): { href: string; label: string }[] {
  const parts = pathname.split("/").filter(Boolean).slice(1);
  const trail = [{ href: "/admin", label: "Pregled" }];
  let href = "/admin";
  parts.forEach((part, i) => {
    href += `/${part}`;
    const last = i === parts.length - 1;
    const label = SEGMENTS[part] ?? (last && crumb ? crumb : decodeURIComponent(part));
    trail.push({ href, label: last && crumb && !SEGMENTS[part] ? crumb : label });
  });
  return trail;
}
