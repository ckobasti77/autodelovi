"use client";

/**
 * Guest cart token (ARCHITECTURE §G2, SECURITY §L1): 128-bit base64url value in localStorage
 * (`sk_cart`, strictly necessary for the requested service), created on the first „Dodaj u
 * korpu“ and passed to every cart function. Only its hash is stored in Convex. After sign-in
 * the cart step merges it into the user's cart (`carts.mergeGuest`).
 */
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
import { create } from "zustand";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const KEY = "sk_cart";
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{22,64}$/;

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function readToken(): string | null {
  try {
    const value = localStorage.getItem(KEY);
    return value && TOKEN_SHAPE.test(value) ? value : null;
  } catch {
    return null;
  }
}

type GuestCartState = { token: string | null; loaded: boolean };

const useGuestCartStore = create<GuestCartState>(() => ({ token: null, loaded: false }));

/** Token for cart calls, created on demand. */
export function ensureGuestToken(): string {
  const existing = useGuestCartStore.getState().token ?? readToken();
  if (existing) {
    useGuestCartStore.setState({ token: existing, loaded: true });
    return existing;
  }
  const token = randomToken();
  try {
    localStorage.setItem(KEY, token);
  } catch {
    // Private mode without storage: the cart lives for this tab only.
  }
  useGuestCartStore.setState({ token, loaded: true });
  return token;
}

/** Forget the guest token (after an order converted the cart, or after a merge on sign-in). */
export function resetGuestToken(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable — the in-memory token is dropped below anyway.
  }
  useGuestCartStore.setState({ token: null, loaded: true });
}

/** Current token after mount (null before the first add). */
export function useGuestToken(): string | null {
  const { token, loaded } = useGuestCartStore();
  useEffect(() => {
    if (!loaded) useGuestCartStore.setState({ token: readToken(), loaded: true });
  }, [loaded]);
  return token;
}

/** `carts.get` args for this visitor, or "skip" when no cart can exist yet. */
export function useCartArgs(): { guestToken?: string } | "skip" {
  const token = useGuestToken();
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (isLoading) return "skip";
  if (isAuthenticated) return {};
  return token ? { guestToken: token } : "skip";
}

/** The visitor's cart, priced for them (undefined while loading, null when none exists). */
export function useCart() {
  const args = useCartArgs();
  const cart = useQuery(api.carts.get, args);
  return args === "skip" ? null : cart;
}

/** Live item count for the header badge; no subscription until a cart exists. */
export function useCartCount(): number {
  return useCart()?.itemCount ?? 0;
}

/**
 * After sign-in the guest cart moves into the user's cart (quantities summed, capped by
 * stock) and the guest token is forgotten. Mounted once in the shop layout.
 */
export function useMergeGuestCartOnSignIn(): void {
  const { isAuthenticated } = useConvexAuth();
  const token = useGuestToken();
  const merge = useMutation(api.carts.mergeGuest);
  const done = useRef(false);
  useEffect(() => {
    if (!isAuthenticated || !token || done.current) return;
    done.current = true;
    merge({ guestToken: token })
      .catch(() => undefined)
      .finally(() => resetGuestToken());
  }, [isAuthenticated, token, merge]);
}

export type AddSource = "catalog" | "three_d" | "quick_order" | "reorder" | "quote" | "search";

/** `addToCart(productId, quantity)` for guests and signed-in users alike. */
export function useAddToCart(source: AddSource) {
  const add = useMutation(api.carts.addItem);
  const { isAuthenticated } = useConvexAuth();
  return useCallback(
    async (productId: Id<"products">, quantity = 1) => {
      const guestToken = isAuthenticated ? undefined : ensureGuestToken();
      try {
        await add({ ...(guestToken ? { guestToken } : {}), productId, quantity, source });
      } catch (error) {
        // A token whose cart was already ordered: start a fresh guest cart once.
        const code = (error as { data?: { code?: unknown } }).data?.code;
        if (!guestToken || code !== "CONFLICT") throw error;
        resetGuestToken();
        await add({ guestToken: ensureGuestToken(), productId, quantity, source });
      }
    },
    [add, source, isAuthenticated],
  );
}
