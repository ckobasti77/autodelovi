import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";

/**
 * `POST /api/revalidate` (ROUTES §B3): Convex's dispatcher purges cache tags after catalog,
 * settings and content changes. Header `x-revalidate-secret` must equal `REVALIDATE_SECRET`;
 * body `{ tags: string[] }`. Settings and legal content expire immediately, the catalog is
 * served stale while it refreshes (`max`).
 */
const IMMEDIATE = new Set(["settings", "faqs"]);

/** Constant-time comparison (both digests have the same length whatever the input). */
function secretMatches(given: string | null, secret: string): boolean {
  if (!given) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(given), digest(secret));
}

export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET?.trim();
  if (!secret || !secretMatches(request.headers.get("x-revalidate-secret"), secret)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  let tags: unknown;
  try {
    tags = ((await request.json()) as { tags?: unknown }).tags;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (!Array.isArray(tags) || tags.length === 0 || tags.length > 20) {
    return Response.json({ ok: false }, { status: 400 });
  }
  const clean = tags.filter(
    (t): t is string => typeof t === "string" && /^[a-z0-9:_-]{1,200}$/i.test(t),
  );
  for (const tag of clean) {
    revalidateTag(tag, IMMEDIATE.has(tag) || tag.startsWith("content:") ? { expire: 0 } : "max");
  }
  return Response.json({ ok: true, revalidated: clean });
}
