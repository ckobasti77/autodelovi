"use client";

import { create } from "zustand";

/** Open state of the one cart drawer (header button, add-to-cart toasts). */
export const useCartDrawer = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}));

export function openCartDrawer(): void {
  useCartDrawer.getState().setOpen(true);
}
