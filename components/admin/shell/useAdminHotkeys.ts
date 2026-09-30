"use client";

/**
 * Global admin shortcuts. Ctrl/⌘ + K opens the palette anywhere; the rest only fire when
 * focus is not in a text field: `/` focuses the page search (or opens the palette), `?`
 * lists the shortcuts, `g` + letter jumps to a section, `n` + `a` opens a new product.
 */
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { ADMIN } from "@/constants/routes";

import type { AdminNavItem } from "./nav";

function typingIn(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "reset"].includes(type);
  }
  return false;
}

export function useAdminHotkeys({
  items,
  openPalette,
  openShortcuts,
}: {
  items: AdminNavItem[];
  openPalette: () => void;
  openShortcuts: () => void;
}) {
  const router = useRouter();
  const pending = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openPalette();
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey || event.defaultPrevented) return;
      if (typingIn(event.target)) return;
      if (document.querySelector("[role=dialog], [role=alertdialog]")) return;
      const key = event.key.toLowerCase();
      const now = Date.now();
      const prefix =
        pending.current && now - pending.current.at < 1_200 ? pending.current.key : null;
      pending.current = null;
      if (prefix === "g") {
        const item = items.find((i) => i.key === key);
        if (item) {
          event.preventDefault();
          router.push(item.href);
        }
        return;
      }
      if (prefix === "n") {
        if (key === "a") {
          event.preventDefault();
          router.push(ADMIN.productNew);
        }
        return;
      }
      if (event.key === "?") {
        event.preventDefault();
        openShortcuts();
        return;
      }
      if (event.key === "/") {
        event.preventDefault();
        const search = document.querySelector<HTMLInputElement>("[data-admin-search]");
        if (search) search.focus();
        else openPalette();
        return;
      }
      if (key === "g" || key === "n") pending.current = { key, at: now };
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [items, openPalette, openShortcuts, router]);
}
