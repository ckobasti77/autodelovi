/**
 * Status-link capabilities for orders and inquiries (`/porudzbina/<token>`, `/upit/<token>`).
 *
 * The token is HMAC-SHA-256(LINK_TOKEN_SECRET, "<kind>:<number>") in base64url (256 bits), so
 * the dispatcher can rebuild the link for every later e-mail while the database still stores
 * only SHA-256(token) (docs/SECURITY.md §L1). Rotating the secret invalidates old links; the
 * nightly job never rewrites hashes on its own (DECISIONS D171).
 */
import { linkTokenSecret } from "./env";
import { hashToken } from "./tokens";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let keyCache: { secret: string; key: CryptoKey } | null = null;

async function hmacKey(): Promise<CryptoKey> {
  const secret = linkTokenSecret();
  if (keyCache && keyCache.secret === secret) return keyCache.key;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  keyCache = { secret, key };
  return key;
}

export type LinkKind = "order" | "inquiry";

export async function statusLinkToken(kind: LinkKind, number: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(),
    new TextEncoder().encode(`${kind}:${number}`),
  );
  return toBase64Url(new Uint8Array(signature));
}

/** Token + its stored hash for a new document. */
export async function issueStatusLink(
  kind: LinkKind,
  number: string,
): Promise<{ token: string; tokenHash: string }> {
  const token = await statusLinkToken(kind, number);
  return { token, tokenHash: await hashToken(token) };
}
