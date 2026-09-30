import "server-only";

/**
 * Server data-access layer for auth (docs/SECURITY.md §D3 layer 2). Pages and layouts in
 * account areas call these at the top; Convex stays the authoritative check.
 */
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import type { FunctionReturnType } from "convex/server";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";

import { api } from "@/convex/_generated/api";
import { ROUTES } from "@/constants/routes";

export type ServerViewer = NonNullable<FunctionReturnType<typeof api.users.viewer>>;

/** The signed-in viewer for this request (deduplicated), or null. Never cached across requests. */
export const getViewer = cache(async (): Promise<ServerViewer | null> => {
  const token = await convexAuthNextjsToken();
  if (!token) return null;
  return await fetchQuery(api.users.viewer, {}, { token });
});

function signInRedirect(next: string): never {
  redirect(`${ROUTES.signIn}?next=${encodeURIComponent(next)}`);
}

/** Account pages: signed in and not blocked. */
export async function requireAccountPage(next: string): Promise<ServerViewer> {
  const viewer = await getViewer();
  if (!viewer) return signInRedirect(next);
  if (viewer.blocked) forbidden();
  return viewer;
}

/** Admin pages: staff or owner. */
export async function requireStaffPage(next: string): Promise<ServerViewer> {
  const viewer = await requireAccountPage(next);
  if (!viewer.isStaff) forbidden();
  return viewer;
}

/** Mechanic portal: any signed-in user (pending mechanics see a status screen). */
export async function requireMechanicPage(next: string): Promise<ServerViewer> {
  return await requireAccountPage(next);
}

/** First/last name for form prefills; falls back to splitting the account name from sign-up. */
export function viewerNames(viewer: ServerViewer): { firstName: string; lastName: string } {
  if (viewer.firstName || viewer.lastName) {
    return { firstName: viewer.firstName ?? "", lastName: viewer.lastName ?? "" };
  }
  const [first = "", ...rest] = (viewer.name ?? "").trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}
