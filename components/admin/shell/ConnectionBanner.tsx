"use client";

/**
 * Connection strip under the admin top bar (FLOW-19). When the browser is offline or the Convex
 * socket stays down, staff see that writes are queued, not lost: the Convex client replays
 * pending mutations on reconnect, so the advice is to keep the page open. After the connection
 * returns a short confirmation replaces it. The polite status region is always mounted, so
 * screen readers hear both changes (WCAG 4.1.3).
 */
import { useEffect, useState } from "react";
import { CheckCircleIcon, WifiSlashIcon } from "@phosphor-icons/react/dist/ssr";

import { countSr } from "@/lib/format/plural";

import { useConnectionLost } from "../hooks";

export function ConnectionBanner() {
  const { lost, pending } = useConnectionLost();
  // „Veza je ponovo uspostavljena“ is shown for a few seconds after an outage only.
  const [wasLost, setWasLost] = useState(lost);
  const [restored, setRestored] = useState(false);
  if (wasLost !== lost) {
    setWasLost(lost);
    setRestored(!lost);
  }
  useEffect(() => {
    if (!restored) return;
    const id = setTimeout(() => setRestored(false), 4000);
    return () => clearTimeout(id);
  }, [restored]);

  return (
    <div
      role="status"
      className="sticky top-14 z-sticky print:hidden"
      data-testid="admin-connection"
    >
      {lost ? (
        <p className="flex items-start gap-2 border-b border-line-strong bg-surface-3 px-4 py-2.5 type-body-s text-ink-1 lg:px-6">
          <WifiSlashIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-warning" />
          <span>
            <span className="font-semibold">
              Veza sa serverom je prekinuta — pokušavamo ponovo.
            </span>{" "}
            {pending > 0
              ? `Na čekanju: ${countSr(pending, ["izmena", "izmene", "izmena"])}. Ne zatvarajte stranicu — sve će biti sačuvano čim se veza vrati.`
              : "Izmene će biti sačuvane kad se veza vrati; podaci na ekranu možda nisu najnoviji."}
          </span>
        </p>
      ) : restored ? (
        <p className="flex items-center gap-2 border-b border-line bg-surface-1 px-4 py-2.5 type-body-s text-ink-1 lg:px-6">
          <CheckCircleIcon size={18} aria-hidden="true" className="shrink-0 text-success" />
          Veza je ponovo uspostavljena.
        </p>
      ) : null}
    </div>
  );
}
