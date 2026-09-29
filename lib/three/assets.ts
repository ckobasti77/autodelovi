/**
 * 3D asset URLs (frozen by docs/3D-CONTRACT.md §F7.7) and the model prefetch.
 *
 * The orchestrator starts `prefetchModel` at the same moment it imports the canvas chunk, so
 * the GLB and the JavaScript download in parallel; the canvas later awaits the same promise.
 * Progress is real (bytes received / expected) and drives the 2 px hairline in the stage.
 */
import type { Tier } from "@/lib/three/tier";

export const MODEL_URL = { high: "/models/car.glb", mid: "/models/car-lite.glb" } as const;
export const ENV_URL = "/models/env/studio-512.hdr";
export const SHADOW_URL = {
  assembled: "/models/car-shadow.webp",
  exploded: "/models/car-shadow-exploded.webp",
} as const;

/** Fallback sizes for progress when Content-Length is missing (manifest `models.*.bytes`). */
const EXPECTED_BYTES = { high: 3_700_000, mid: 2_700_000 } as const;

type Listener = (fraction: number) => void;

type Prefetch = {
  tier: Exclude<Tier, "low">;
  promise: Promise<ArrayBuffer>;
  fraction: number;
  listeners: Set<Listener>;
};

let current: Prefetch | null = null;

async function download(entry: Prefetch): Promise<ArrayBuffer> {
  const response = await fetch(MODEL_URL[entry.tier], { credentials: "same-origin" });
  if (!response.ok || !response.body) throw new Error(`Model HTTP ${response.status}`);
  const total = Number(response.headers.get("content-length")) || EXPECTED_BYTES[entry.tier];
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    entry.fraction = Math.min(received / total, 0.99);
    for (const l of entry.listeners) l(entry.fraction);
  }
  const out = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  entry.fraction = 1;
  for (const l of entry.listeners) l(1);
  return out.buffer;
}

/** Starts (once per tier) and returns the model download. */
export function prefetchModel(tier: Exclude<Tier, "low">): Promise<ArrayBuffer> {
  if (current && current.tier === tier) return current.promise;
  const entry: Prefetch = {
    tier,
    fraction: 0,
    listeners: new Set(),
    promise: Promise.resolve(new ArrayBuffer(0)),
  };
  entry.promise = download(entry);
  // A failed download may be retried by a later call.
  entry.promise.catch(() => {
    if (current === entry) current = null;
  });
  current = entry;
  return entry.promise;
}

/** Subscribe to download progress (0 … 1); returns an unsubscribe function. */
export function onModelProgress(listener: Listener): () => void {
  const entry = current;
  if (!entry) return () => {};
  entry.listeners.add(listener);
  listener(entry.fraction);
  return () => entry.listeners.delete(listener);
}
