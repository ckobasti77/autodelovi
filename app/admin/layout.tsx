import type { Metadata } from "next";

import { requireStaffPage } from "@/lib/server/auth";
import { Wordmark } from "@/components/shell/BrandMark";
import { SignOutButton } from "@/components/auth/SignInForm";
import { AdminNav } from "@/components/admin/AdminNav";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = {
  title: { absolute: "Administracija" },
  robots: { index: false, follow: false },
};

/**
 * Minimal staff shell (step 14): night bar with the mark + paper workspace (DESIGN-SYSTEM
 * §10.10). Step 15 replaces it with the full admin shell (sidebar, command palette, bell).
 * Server guard here and on every page; Convex re-checks every staff function.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const viewer = await requireStaffPage(ROUTES.adminMechanics);
  return (
    <div className="flex min-h-dvh flex-col" data-reveal="off">
      <header className="flex h-14 items-center gap-6 border-b border-line bg-bg-raised px-page">
        <Wordmark />
        <span className="type-label text-ink-3">Administracija</span>
        <AdminNav />
        <div className="ml-auto flex items-center gap-4">
          <span className="hidden type-body-s text-ink-3 md:inline">{viewer.email}</span>
          <SignOutButton />
        </div>
      </header>
      <main id="sadrzaj" tabIndex={-1} data-theme="paper" className="flex-1 bg-bg px-page py-8 text-ink-1">
        {children}
      </main>
    </div>
  );
}
