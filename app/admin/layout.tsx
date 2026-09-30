import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Administracija", template: "%s · Administracija" },
  robots: { index: false, follow: false },
};

/**
 * `/admin` root: metadata only. The guarded shell lives in `(panel)`, print views in
 * `(print)`; `/admin/pozivnica/[token]` stays public (token-guarded) and outside both.
 */
export default function AdminRootLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
