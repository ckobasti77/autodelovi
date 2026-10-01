"use client";

/**
 * Toasts (§9.13, §8.5): bottom-centre on phones, bottom-right on desktop, 360 px, max 3.
 * Enter 16 px + opacity in 220 ms (sk.out), exit opacity in 160 ms (sk.in); 5 s auto-dismiss,
 * paused on hover/focus (Radix); errors stay until closed and are announced assertively.
 *
 *   toast.success("OEM broj kopiran");
 *   toast.error("Porudžbina nije poslata", { description: "Proverite vezu i pokušajte ponovo." });
 *
 * This module is only the queue and the `toast()` API, so the ~30 islands that import it stay
 * light. The viewport (radix Toast, motion, icons) lives in `components/providers/ToastViewport`
 * and loads on the first `toast()` call (PERF-11); toasts raised before it arrives are queued.
 */
import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

export type ToastVariant = "success" | "info" | "warning" | "error";

export type ToastAction = {
  label: string;
  /** Screen-reader alternative for the action (Radix requirement). */
  altText?: string;
  onClick?: () => void;
  href?: string;
};

export type ToastOptions = {
  description?: string;
  action?: ToastAction;
  /** ms; errors default to persistent. */
  duration?: number;
};

export type ToastRecord = ToastOptions & {
  id: string;
  title: string;
  variant: ToastVariant;
  open: boolean;
};

const MAX_VISIBLE = 3;

let records: ToastRecord[] = [];
const listeners = new Set<() => void>();
let counter = 0;

function emit() {
  for (const listener of listeners) listener();
}

function update(next: ToastRecord[]) {
  records = next;
  emit();
}

function show(variant: ToastVariant, title: string, options: ToastOptions = {}): string {
  counter += 1;
  const id = `t${Date.now().toString(36)}${counter}`;
  let next = [...records, { ...options, id, title, variant, open: true }];
  const open = next.filter((record) => record.open);
  if (open.length > MAX_VISIBLE) {
    const oldest = open.find((record) => record.variant !== "error") ?? open[0];
    next = next.map((record) => (record.id === oldest?.id ? { ...record, open: false } : record));
  }
  update(next);
  return id;
}

function dismiss(id: string): void {
  update(records.map((record) => (record.id === id ? { ...record, open: false } : record)));
}

/** Drops a toast after its exit animation (viewport only). */
export function removeToast(id: string): void {
  update(records.filter((record) => record.id !== id));
}

export { dismiss as dismissToast };

export const toast = Object.assign(
  (title: string, options?: ToastOptions) => show("info", title, options),
  {
    success: (title: string, options?: ToastOptions) => show("success", title, options),
    info: (title: string, options?: ToastOptions) => show("info", title, options),
    warning: (title: string, options?: ToastOptions) => show("warning", title, options),
    error: (title: string, options?: ToastOptions) => show("error", title, options),
    dismiss,
  },
);

const EMPTY: ToastRecord[] = [];

/** Queue snapshot for the viewport (re-renders on every change). */
export function useToasts(): ToastRecord[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => records,
    () => EMPTY,
  );
}

const ToastViewport = dynamic(
  () => import("@/components/providers/ToastViewport").then((m) => m.ToastViewport),
  { ssr: false },
);

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let used = false;
/** True from the first toast on (the viewport then stays mounted for exits and later toasts). */
function getUsed(): boolean {
  if (records.length > 0) used = true;
  return used;
}

/** Mounted once by Providers; loads the viewport with the first toast. */
export function Toaster() {
  const active = useSyncExternalStore(subscribe, getUsed, () => false);
  return active ? <ToastViewport /> : null;
}
