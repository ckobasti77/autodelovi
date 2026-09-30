"use client";

import { useState } from "react";

/**
 * `true` from the first render in which `flag` is true, for good. Mounts a lazily loaded overlay
 * on first use and keeps it mounted afterwards, so its exit animation and focus return still run.
 * Uses React's "adjust state while rendering" pattern — no extra effect pass.
 */
export function useLatched(flag: boolean): boolean {
  const [latched, setLatched] = useState(flag);
  if (flag && !latched) setLatched(true);
  return latched || flag;
}
