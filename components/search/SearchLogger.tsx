"use client";

import { useMutation } from "convex/react";
import { useEffect } from "react";

import { api } from "@/convex/_generated/api";
import { track } from "@/lib/analytics/track";

/**
 * Logs the query once per results page (`search.log` feeds „Traženo, a nemamo“) and fires the
 * `search` analytics event. Rate-limited and silently dropped in Convex.
 */
export function SearchLogger({
  query,
  resultsCount,
  exactCodeHit,
}: {
  query: string;
  resultsCount: number;
  exactCodeHit: boolean;
}) {
  const log = useMutation(api.search.log);
  useEffect(() => {
    track({ name: "search", term: query, results: resultsCount });
    log({ query, resultsCount, exactCodeHit, source: "search_page" }).catch(() => undefined);
    // Once per query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  return null;
}
