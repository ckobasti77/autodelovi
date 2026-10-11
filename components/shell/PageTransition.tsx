import { ViewTransition, type ReactNode } from "react";

import { PAGE_TRANSITION } from "@/constants/motion";

/**
 * Page transition (DESIGN-SYSTEM §8.9): when a link navigates to another page, the page area
 * of the new route fades in with a 6 px rise — the View Transitions API where the browser has
 * it, nothing elsewhere. The old page is not cross-faded (its snapshot would slide when it was
 * scrolled). Header, bottom bar and consent banner are their own groups and keep their place;
 * no layout moves (opacity and transform on a snapshot).
 *
 * It runs only for navigations tagged with the page type — every `RouteLink` — so filters,
 * sorting and other URL updates through `router.replace`, and back/forward, never animate; a
 * link to the page already shown changes nothing, so nothing animates either. Timings and the
 * reduced-motion rule are in app/globals.css (`::view-transition-*(.page-swap)`).
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
