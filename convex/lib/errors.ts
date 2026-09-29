/**
 * Error convention: every expected failure is a `ConvexError` with `{ code, message }`
 * (message in Serbian, safe to show to the user). Unexpected failures stay plain errors.
 */
import { ConvexError, type Value } from "convex/values";

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "BLOCKED"
  | "NOT_FOUND"
  | "INVALID"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "OUT_OF_STOCK"
  | "PRICE_CHANGED"
  | "EMPTY_CART"
  | "SPAM"
  | "DISABLED"
  | "EXPIRED"
  | "DUPLICATE";

export type ErrorData = { code: ErrorCode; message: string; [key: string]: Value };

export function fail(code: ErrorCode, message: string, extra: Record<string, Value> = {}): never {
  throw new ConvexError<ErrorData>({ ...extra, code, message });
}

export function notFound(message = "Traženi zapis ne postoji."): never {
  return fail("NOT_FOUND", message);
}

export function invalid(message: string, field?: string): never {
  return fail("INVALID", message, field ? { field } : {});
}
