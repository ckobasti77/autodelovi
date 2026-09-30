import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = { title: { absolute: "Administracija" }, robots: { index: false } };

/** Placeholder overview until the step-15 dashboard; links to the screens that exist. */
export default async function AdminHomePage() {
  await requireStaffPage("/admin");
  return (
    <div className="flex max-w-[40rem] flex-col items-start gap-4">
      <h1 className="type-h1 text-ink-1">Administracija</h1>
      <p className="type-body text-ink-2">
        Pregled porudžbina, upita i kataloga stiže u sledećem koraku. Registracije servisa su već ovde.
      </p>
      <Button asChild>
        <Link href={ROUTES.adminMechanics} variant="unstyled">
          Majstori
        </Link>
      </Button>
    </div>
  );
}
