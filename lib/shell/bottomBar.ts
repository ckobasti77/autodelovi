import { ROUTES } from "@/constants/routes";

/** Routes with their own bottom bar (buy bar, cart total, checkout, mechanic portal). */
const OWN_BOTTOM_BAR = ["/deo/", ROUTES.cart, ROUTES.checkout, ROUTES.mechanicPortal];

/** True where the mobile action bar is not shown because the page docks its own bar. */
export function hasOwnBottomBar(pathname: string): boolean {
  return OWN_BOTTOM_BAR.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
}

/**
 * The space the mobile action bar takes (`--bottom-bar-h`), declared for phones and tablets.
 * Rendered as the first thing of the shop layout by `BottomBarSpace`, so the value is known
 * before any content is laid out (read by the hero frame, toasts, the consent banner, the
 * offline notice and the bottom padding of the shell).
 */
export const BOTTOM_BAR_SPACE_CSS =
  "@media screen and (width < 64rem){:root{--bottom-bar-h:calc(3.75rem + env(safe-area-inset-bottom, 0px))}}";
