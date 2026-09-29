import type { ReactNode } from "react";

import { Footer } from "@/components/shell/Footer";
import { Header } from "@/components/shell/Header";
import { MAIN_ID } from "@/components/shell/SkipLink";

/** Storefront frame: header, <main id="sadrzaj"> (skip-link target), footer. */
export function SiteShell({
  children,
  vehicleSlot,
}: {
  children: ReactNode;
  vehicleSlot?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <Header vehicleSlot={vehicleSlot} />
      <main id={MAIN_ID} tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <Footer />
    </div>
  );
}
