"use client";

import { usePathname } from "next/navigation";

import { BOTTOM_BAR_SPACE_CSS, hasOwnBottomBar } from "@/lib/shell/bottomBar";

/**
 * Declares the height of the mobile action bar (`--bottom-bar-h`) on pages that show it. It is
 * the first element of the shop layout on purpose: the bar itself is rendered at the end of the
 * document, and a root custom property that changes that late restyles and re-lays out the whole
 * page right after first paint (measured: +200 ms TBT on home and category with a
 * `:root:has([data-bottom-bar])` rule). Here the value is known before any content.
 */
export function BottomBarSpace() {
  const pathname = usePathname();
  if (hasOwnBottomBar(pathname)) return null;
  return <style>{BOTTOM_BAR_SPACE_CSS}</style>;
}
