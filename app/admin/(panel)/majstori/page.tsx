import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { MechanicsAdminList } from "@/components/admin/MechanicsAdminList";
import { PageHeader } from "@/components/admin/ui";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = {
  title: { absolute: "Majstori · Administracija" },
  robots: { index: false },
};

export default async function AdminMechanicsPage() {
  await requireStaffPage(ROUTES.adminMechanics);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Majstori" description="Registracije servisa, nivoi rabata i odloženo plaćanje." />
      <MechanicsAdminList />
    </div>
  );
}
