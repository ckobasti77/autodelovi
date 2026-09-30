import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { MechanicsAdminList } from "@/components/admin/MechanicsAdminList";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = { title: { absolute: "Majstori · Administracija" }, robots: { index: false } };

export default async function AdminMechanicsPage() {
  await requireStaffPage(ROUTES.adminMechanics);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="type-h1 text-ink-1">Majstori</h1>
        <p className="type-body-s text-ink-3">Registracije servisa, nivoi rabata i odloženo plaćanje.</p>
      </div>
      <MechanicsAdminList />
    </div>
  );
}
