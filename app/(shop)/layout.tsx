import { SiteShell } from "@/components/shell/SiteShell";

/** Storefront route group: header + footer around every public page. */
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>;
}
