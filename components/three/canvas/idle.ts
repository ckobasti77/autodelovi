/**
 * Runs a list of small jobs in idle time (one or more per idle callback while time remains),
 * so BVH and edge-line building never block scrolling (contract F7.3). Returns a cancel
 * function.
 */
type IdleDeadlineLike = { timeRemaining: () => number; didTimeout?: boolean };

const requestIdle: (cb: (d: IdleDeadlineLike) => void) => number =
  typeof window !== "undefined" && "requestIdleCallback" in window
    ? (cb) => window.requestIdleCallback(cb, { timeout: 2000 })
    : (cb) => window.setTimeout(() => cb({ timeRemaining: () => 8 }), 32);

const cancelIdle: (id: number) => void =
  typeof window !== "undefined" && "cancelIdleCallback" in window
    ? (id) => window.cancelIdleCallback(id)
    : (id) => window.clearTimeout(id);

export function runInIdleSlices(
  jobs: Array<() => void>,
  onDone?: () => void,
  budgetMs = 6,
): () => void {
  let index = 0;
  let handle = 0;
  let cancelled = false;
  const step = (deadline: IdleDeadlineLike) => {
    if (cancelled) return;
    const started = performance.now();
    do {
      const job = jobs[index++];
      if (!job) break;
      job();
    } while (
      index < jobs.length &&
      deadline.timeRemaining() > budgetMs &&
      performance.now() - started < budgetMs
    );
    if (index < jobs.length) handle = requestIdle(step);
    else onDone?.();
  };
  handle = requestIdle(step);
  return () => {
    cancelled = true;
    cancelIdle(handle);
  };
}
