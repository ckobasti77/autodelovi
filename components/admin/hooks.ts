"use client";

/**
 * Small admin hooks: a minute clock for SLA timers and „pre 3 min“ labels (queries take
 * `nowMinute` as an argument because Convex queries must not read the wall clock), and a
 * debounced value for search fields, and the connection state behind the offline banner.
 */
import { useConvexConnectionState } from "convex/react";
import { useEffect, useState, useSyncExternalStore } from "react";

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

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether staff writes can reach Convex right now (FLOW-19). `lost` is true when the browser is
 * offline, or when a socket that had connected stays down for more than 1.5 s (short reconnects
 * after a token refresh do not flash the banner). `pending` counts queued mutations and actions:
 * the Convex client replays them on reconnect, so they are waiting, not failed.
 */
export function useConnectionLost(): { lost: boolean; pending: number } {
  const state = useConvexConnectionState();
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const socketDown = state.hasEverConnected && !state.isWebSocketConnected;
  const [late, setLate] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setLate(socketDown), socketDown ? 1500 : 0);
    return () => clearTimeout(id);
  }, [socketDown]);
  return {
    lost: !online || (socketDown && late),
    pending: state.inflightMutations + state.inflightActions,
  };
}
