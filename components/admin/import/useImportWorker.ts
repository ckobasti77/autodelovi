"use client";

/**
 * Promise-based access to the import Web Worker (lib/excel/import.worker.ts). One worker
 * per wizard; terminated on unmount.
 */
import { useCallback, useEffect, useRef } from "react";

import type { WorkerRequest, WorkerResponse } from "@/lib/excel/importProtocol";

type Pending = { resolve: (value: WorkerResponse) => void; reject: (error: Error) => void };

type RequestWithoutId = WorkerRequest extends infer R
  ? R extends { id: number }
    ? Omit<R, "id">
    : never
  : never;

export function useImportWorker() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(1);

  useEffect(() => {
    const worker = new Worker(new URL("../../../lib/excel/import.worker.ts", import.meta.url), {
      type: "module",
    });
    const waiting = pending.current;
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      const entry = waiting.get(message.id);
      if (!entry) return;
      waiting.delete(message.id);
      if (message.type === "error") entry.reject(new Error(message.message));
      else entry.resolve(message);
    };
    worker.onerror = () => {
      for (const entry of waiting.values()) entry.reject(new Error("Obrada fajla je prekinuta."));
      waiting.clear();
    };
    workerRef.current = worker;
    return () => {
      worker.terminate();
      workerRef.current = null;
      waiting.clear();
    };
  }, []);

  const request = useCallback(
    <T extends WorkerResponse["type"]>(
      message: RequestWithoutId,
      transfer: Transferable[] = [],
    ): Promise<Extract<WorkerResponse, { type: T }>> => {
      const worker = workerRef.current;
      if (!worker) return Promise.reject(new Error("Obrada fajla nije spremna."));
      const id = nextId.current++;
      return new Promise((resolve, reject) => {
        pending.current.set(id, {
          resolve: (value) => resolve(value as Extract<WorkerResponse, { type: T }>),
          reject,
        });
        worker.postMessage({ ...message, id } as WorkerRequest, transfer);
      });
    },
    [],
  );

  return request;
}
