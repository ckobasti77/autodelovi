"use client";

import { create } from "zustand";

import { installFocusHistory } from "@/lib/dom/focusHistory";

// The drawer/picker panels are lazy chunks; focus history must be recording before the first
// one opens so focus can return to the control used before a vanished opener (A11Y-02, D270).
installFocusHistory();

/** Open state of the one cart drawer (header button, add-to-cart toasts). */
export const useCartDrawer = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export function openCartDrawer(): void {
  useCartDrawer.getState().setOpen(true);
}
