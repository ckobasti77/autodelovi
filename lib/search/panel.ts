"use client";

import { create } from "zustand";

import { installFocusHistory } from "@/lib/dom/focusHistory";

// The search dialog is a lazy chunk; focus history must be recording before it first opens so
// focus can return to the control that opened it (A11Y-02, D270).
installFocusHistory();

/** Open state of the one header search dialog (header field, „/“, the mobile action bar). */
export const useSearchPanel = create<{ open: boolean; setOpen: (open: boolean) => void }>(
  (set) => ({ open: false, setOpen: (open) => set({ open }) }),
);

export function openSearchPanel(): void {
  useSearchPanel.getState().setOpen(true);
}
