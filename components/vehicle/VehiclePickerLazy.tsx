"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { useLatched } from "@/lib/hooks/useLatched";
import { useVehiclePicker } from "@/lib/vehicle/picker";

const loadPicker = () => import("@/components/vehicle/VehiclePickerDialog");
const VehiclePickerDialog = dynamic(() => loadPicker().then((m) => m.VehiclePickerDialog), {
  ssr: false,
});

/**
 * The vehicle picker stays out of the first-load JS: it mounts the first time something opens
 * it, and its chunk is warmed once the page has loaded and the main thread is idle.
 */
export function VehiclePickerLazy() {
  const open = useVehiclePicker((s) => s.open);
  const mounted = useLatched(open);

  useEffect(() => {
    let handle = 0;
    const warm = () => {
      const w = window as Window & { requestIdleCallback?: Window["requestIdleCallback"] };
      if (w.requestIdleCallback) handle = w.requestIdleCallback(() => void loadPicker(), { timeout: 4000 });
      else void loadPicker();
    };
    if (document.readyState === "complete") warm();
    else window.addEventListener("load", warm, { once: true });
    return () => {
      window.removeEventListener("load", warm);
      if (handle && "cancelIdleCallback" in window) window.cancelIdleCallback(handle);
    };
  }, []);

  return mounted ? <VehiclePickerDialog /> : null;
}
