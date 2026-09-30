"use client";

/**
 * Small admin hooks: a minute clock for SLA timers and „pre 3 min“ labels (queries take
 * `nowMinute` as an argument because Convex queries must not read the wall clock), and a
 * debounced value for search fields.
 */
import { useEffect, useState } from "react";

const minute = () => Math.floor(Date.now() / 60_000) * 60_000;

/** Current time rounded down to the minute; re-renders once a minute. */
export function useNowMinute(): number {
  const [now, setNow] = useState(minute);
  useEffect(() => {
    const id = setInterval(() => setNow(minute()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function useDebouncedValue<T>(value: T, ms = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
