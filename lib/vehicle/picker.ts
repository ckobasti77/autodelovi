"use client";

import { create } from "zustand";

/** Open state of the one vehicle picker dialog (header chip, hero field, part panel). */
export const useVehiclePicker = create<{ open: boolean; setOpen: (open: boolean) => void }>(
  (set) => ({ open: false, setOpen: (open) => set({ open }) }),
);

export function openVehiclePicker(): void {
  useVehiclePicker.getState().setOpen(true);
}
