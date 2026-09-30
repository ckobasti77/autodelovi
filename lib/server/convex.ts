import "server-only";

/**
 * Convex access from the Next server (ARCHITECTURE §G2). `fetchPublic` never carries a token,
 * so its results are safe to cache across visitors; `fetchAsUser` is per request only.
 */
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

type PublicQuery = FunctionReference<"query", "public">;

export async function fetchPublic<Q extends PublicQuery>(
  ref: Q,
  args: FunctionArgs<Q>,
): Promise<FunctionReturnType<Q>> {
  return await fetchQuery(ref, args);
}

export async function fetchAsUser<Q extends PublicQuery>(
  ref: Q,
  args: FunctionArgs<Q>,
): Promise<FunctionReturnType<Q>> {
  const token = await convexAuthNextjsToken();
  return await fetchQuery(ref, args, token ? { token } : {});
}
