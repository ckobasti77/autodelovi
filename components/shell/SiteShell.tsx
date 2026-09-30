import type { ReactNode } from "react";

import type { Company, Contact } from "@/config/site";
import { Footer } from "@/components/shell/Footer";
import { Header } from "@/components/shell/Header";
import { MAIN_ID } from "@/components/shell/SkipLink";

/** Storefront frame: header, <main id="sadrzaj"> (skip-link target), footer. */
export function SiteShell({
  children,
  vehicleSlot,
  contact,
  company,
}: {
  children: ReactNode;
  vehicleSlot?: ReactNode;
  /** Resolved from settings (config fallback inside Header/Footer when omitted). */
  contact?: Partial<Contact> | null;
  company?: Partial<Company> | null;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header vehicleSlot={vehicleSlot} contact={contact} />
      <main id={MAIN_ID} tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Footer contact={contact} company={company} />
    </div>
  );
}
