"use client";

import { useSyncExternalStore } from "react";

import { MEDIA } from "@/constants/motion";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(MEDIA.reducedMotion);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(MEDIA.reducedMotion).matches;
// Server render assumes motion is allowed; nothing is hidden by this value, so no mismatch risk.
const getServerSnapshot = () => false;

/** Live `prefers-reduced-motion: reduce` flag for components that branch in render. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
