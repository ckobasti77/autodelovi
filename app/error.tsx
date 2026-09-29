"use client";

import { useEffect } from "react";

import { ErrorState } from "@/components/shell/ErrorState";
import { MAIN_ID } from "@/components/shell/SkipLink";

/** Error boundary for routes outside the shop group (styleguide, future admin fallback). */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id={MAIN_ID} tabIndex={-1} className="outline-none">
      <ErrorState digest={error.digest} onRetry={retry} />
    </main>
  );
}
