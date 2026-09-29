"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/shell/ErrorState";

/** Storefront error boundary (inside the shop layout, so header and footer stay). */
export default function ShopError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return <ErrorState digest={error.digest} onRetry={retry} />;
}
