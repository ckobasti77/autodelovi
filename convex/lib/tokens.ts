/**
 * Capability tokens (order/inquiry status links, unsubscribe, guest carts): 256-bit random
 * values given to the client once; only their SHA-256 is stored (docs/SECURITY.md §L1).
 */

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashToken(token: string): Promise<string> {
  return sha256Hex(`tok:${token}`);
}

/** Tokens are base64url, 22–64 characters (128–384 bits). */
export function isTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{22,64}$/.test(token);
}
