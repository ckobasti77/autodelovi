import { requireStaffPage } from "@/lib/server/auth";
import { AdminShell } from "@/components/admin/shell/AdminShell";

/**
 * Admin shell for every staff screen. Server guard here (layer 2, docs/SECURITY.md §D3)
 * and in each page; Convex re-checks every staff function (authoritative).
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireStaffPage("/admin");
  const name =
    [viewer.firstName, viewer.lastName].filter(Boolean).join(" ") ||
    viewer.name ||
    viewer.email ||
    "Zaposleni";
  return (
    <AdminShell
      viewer={{ userId: viewer.userId, name, email: viewer.email, isOwner: viewer.isOwner }}
    >
      {children}
    </AdminShell>
  );
}
