import { requireStaffPage } from "@/lib/server/auth";
import { PrintToolbar } from "@/components/admin/print/PrintToolbar";

/**
 * Print views (predračun, otpremnica): staff only, no admin shell, paper theme; the toolbar
 * is hidden when printing.
 */
export default async function AdminPrintLayout({ children }: { children: React.ReactNode }) {
  await requireStaffPage("/admin");
  return (
    <div
      data-theme="paper"
      data-reveal="off"
      className="min-h-dvh bg-bg px-4 py-8 text-ink-1 print:bg-white print:p-0"
    >
      <div className="mx-auto flex max-w-[52rem] flex-col gap-6">
        <PrintToolbar />
        <main className="flex flex-col gap-10 rounded-md bg-surface-1 p-8 print:gap-0 print:rounded-none print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
