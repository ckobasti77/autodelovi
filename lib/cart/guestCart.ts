"use client";

/**
 * Guest cart token (ARCHITECTURE §G2, SECURITY §L1): 128-bit base64url value in localStorage
 * (`sk_cart`, strictly necessary for the requested service), created on the first „Dodaj u
 * korpu“ and passed to every cart function. Only its hash is stored in Convex. After sign-in
 * the cart step merges it into the user's cart (`carts.mergeGuest`).
 */
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect } from "react";
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

/** Current token after mount (null before the first add). */
export function useGuestToken(): string | null {
  const { token, loaded } = useGuestCartStore();
  useEffect(() => {
    if (!loaded) useGuestCartStore.setState({ token: readToken(), loaded: true });
  }, [loaded]);
  return token;
}

/** Live item count for the header badge; no subscription until a cart exists. */
export function useCartCount(): number {
  const token = useGuestToken();
  const cart = useQuery(api.carts.get, token ? { guestToken: token } : "skip");
  return cart?.itemCount ?? 0;
}

export type AddSource = "catalog" | "three_d" | "quick_order" | "reorder" | "quote" | "search";

/** `addToCart(productId, quantity)` for guests and signed-in users alike. */
export function useAddToCart(source: AddSource) {
  const add = useMutation(api.carts.addItem);
  return useCallback(
    async (productId: Id<"products">, quantity = 1) => {
      const guestToken = ensureGuestToken();
      await add({ guestToken, productId, quantity, source });
    },
    [add, source],
  );
}
