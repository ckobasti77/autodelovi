"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

import { useLatched } from "@/lib/hooks/useLatched";
import { useVehiclePicker } from "@/lib/vehicle/picker";
import { TEST_IDS } from "@/constants/testIds";

const loadPicker = () => import("@/components/vehicle/VehiclePickerDialog");
const VehiclePickerDialog = dynamic(() => loadPicker().then((m) => m.VehiclePickerDialog), {
  ssr: false,
});

const TRIGGER = `[data-testid="${TEST_IDS.vehiclePickerTrigger}"]`;
const INTENT_EVENTS = ["pointerover", "focusin", "touchstart"] as const;

/**
 * The vehicle picker stays out of the first-load JS: it mounts the first time something opens
 * it. Its chunk is warmed on intent only — a pointer over, a touch on or focus on one of the
 * picker triggers — never on load or idle, so pages that never use it do not pay for it
 * (PERF-04, D248). Other openers (catalog, account) load it on open.
 */
export function VehiclePickerLazy() {
  const open = useVehiclePicker((s) => s.open);
  const mounted = useLatched(open);

  useEffect(() => {
    if (mounted) return;
    const onIntent = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest(TRIGGER)) return;
      stop();
      void loadPicker();
    };
    const stop = () => {
      for (const type of INTENT_EVENTS) document.removeEventListener(type, onIntent, true);
    };
    for (const type of INTENT_EVENTS) {
      document.addEventListener(type, onIntent, { capture: true, passive: true });
    }
    return stop;
  }, [mounted]);

  return mounted ? <VehiclePickerDialog /> : null;
}
