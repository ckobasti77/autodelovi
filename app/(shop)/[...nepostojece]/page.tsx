import { notFound } from "next/navigation";

/**
 * Catch-all for URLs no storefront route matches (PERF-13, D261): `notFound()` renders the rich
 * shop 404 (`app/(shop)/not-found.tsx`) inside the shop layout, so the root `app/not-found.tsx`
 * can stay lightweight. More specific routes, route handlers and other groups always win.
 */
export default function UnknownShopPath(): never {
  notFound();
}
