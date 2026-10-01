import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { fetchQuery } from "convex/nextjs";

import { api } from "@/convex/_generated/api";

/**
 * `GET /api/zdravlje` (ROUTES §B3): health for uptime monitoring — the build id and whether
 * Convex answers a cheap read (the public settings singleton) within 3 s. 200 when healthy,
 * 503 when Convex is unreachable; never cached, no internals in the body (SEO-12, D268).
 */
const CONVEX_TIMEOUT_MS = 3000;

let buildId: Promise<string> | null = null;
function readBuildId(): Promise<string> {
  // `next dev` leaves the BUILD_ID of the last production build on disk; it says nothing here.
  if (process.env.NODE_ENV === "development") return Promise.resolve("development");
  buildId ??= readFile(join(process.cwd(), ".next", "BUILD_ID"), "utf8")
    .then((id) => id.trim())
    .catch(() => process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown");
  return buildId;
}

async function convexReachable(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), CONVEX_TIMEOUT_MS);
  });
  try {
    return await Promise.race([fetchQuery(api.settings.getPublic, {}).then(() => true), timeout]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const started = Date.now();
  const [build, convex] = await Promise.all([readBuildId(), convexReachable()]);
  return Response.json(
    { ok: convex, build, convex: convex ? "ok" : "unreachable", ms: Date.now() - started },
    { status: convex ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
