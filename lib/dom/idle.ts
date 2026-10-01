/**
 * Runs `callback` once the main thread is idle, at most `timeout` ms later (a short timer where
 * `requestIdleCallback` is missing, e.g. Safari). Returns a cancel function. For warming
 * on-demand modules after hydration without adding to it (PERF-01).
 */
export function whenIdle(callback: () => void, timeout = 3000): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 200);
  return () => window.clearTimeout(id);
}
