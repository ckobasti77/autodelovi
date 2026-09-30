"use client";

/**
 * The signed-in viewer on the client (`users.viewer`, live): role, mechanic status, tier
 * name, credit flag. `undefined` while loading, `null` when signed out. UX only — every
 * authorization decision is re-made in Convex.
 */
import { useConvexAuth, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";

export function useViewer() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const viewer = useQuery(api.users.viewer, isAuthenticated ? {} : "skip");
  if (isLoading) return undefined;
  if (!isAuthenticated) return null;
  return viewer;
}

/** Approved mechanics land in `/majstor`; everyone else in `/nalog`. */
export function isMechanicViewer(
  viewer: ReturnType<typeof useViewer>,
): boolean {
  return Boolean(viewer && viewer.mechanicStatus !== "none" && !viewer.isStaff);
}
