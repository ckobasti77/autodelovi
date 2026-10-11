import { ViewTransition, type ReactNode } from "react";

import { PAGE_TRANSITION } from "@/constants/motion";

/**
 * Page transition (DESIGN-SYSTEM §8.8): when a link navigates to another page, the old page
 * fades out quickly and the new one fades in with a 6 px rise — the View Transitions API where
 * the browser has it, nothing elsewhere. Only the page area takes part; header, bottom bar and
 * overlays keep their place, and no layout moves (opacity and transform on snapshots).
 *
 * It runs only for navigations tagged with the page type — `RouteLink` tags every link whose
 * path differs from the current one — so filters, sorting and other same-page URL updates
 * (`router.replace`) and back/forward never animate. Timings and the reduced-motion rule are
 * in app/globals.css (`::view-transition-*(.page-swap)`).
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      default="none"
      update={{ [PAGE_TRANSITION.type]: PAGE_TRANSITION.className, default: "none" }}
    >
      {children}
    </ViewTransition>
  );
}
