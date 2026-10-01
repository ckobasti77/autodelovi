"use client";

import { create } from "zustand";

import { installFocusHistory } from "@/lib/dom/focusHistory";

// The drawer/picker panels are lazy chunks; focus history must be recording before the first
// one opens so focus can return to the control used before a vanished opener (A11Y-02, D270).
installFocusHistory();

/** Open state of the one vehicle picker dialog (header chip, hero field, part panel). */
export const useVehiclePicker = create<{ open: boolean; setOpen: (open: boolean) => void }>(
  (set) => ({ open: false, setOpen: (open) => set({ open }) }),
);

export function openVehiclePicker(): void {
  useVehiclePicker.getState().setOpen(true);
}
