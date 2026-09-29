"use client";

/**
 * Toasts (§9.13, §8.5): bottom-centre on phones, bottom-right on desktop, 360 px, max 3.
 * Enter 16 px + opacity in 220 ms (sk.out), exit opacity in 160 ms (sk.in); 5 s auto-dismiss,
 * paused on hover/focus (Radix); errors stay until closed and are announced assertively.
 *
 *   toast.success("OEM broj kopiran");
 *   toast.error("Porudžbina nije poslata", { description: "Proverite vezu i pokušajte ponovo." });
 */
import { Toast as ToastPrimitive } from "radix-ui";
import { useRef, useSyncExternalStore, type ReactNode } from "react";
import {
  CheckCircleIcon,
  InfoIcon,
  WarningCircleIcon,
  WarningIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/IconButton";
import { useMediaQuery, useOverlayMotion, usePresence } from "@/components/ui/motion";
import { DISTANCE, DUR, MEDIA } from "@/constants/motion";
import { gsap } from "@/lib/gsap/client";

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

type ToastRecord = ToastOptions & {
  id: string;
  title: string;
  variant: ToastVariant;
  open: boolean;
};

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 5000;

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

function dismiss(id: string) {
  update(records.map((record) => (record.id === id ? { ...record, open: false } : record)));
}

function remove(id: string) {
  update(records.filter((record) => record.id !== id));
}

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

function useToasts(): ToastRecord[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => records,
    () => EMPTY,
  );
}

const icons: Record<ToastVariant, ReactNode> = {
  success: <CheckCircleIcon size={20} weight="fill" className="text-success" />,
  info: <InfoIcon size={20} weight="fill" className="text-info" />,
  warning: <WarningIcon size={20} weight="fill" className="text-warning" />,
  error: <WarningCircleIcon size={20} weight="fill" className="text-danger" />,
};

function ToastItem({ record }: { record: ToastRecord }) {
  const [present, onExited] = usePresence(record.open);
  const ref = useRef<HTMLLIElement>(null);

  useOverlayMotion({
    open: record.open,
    present,
    onExited: () => {
      onExited();
      remove(record.id);
    },
    panel: ref,
    enterFrom: { y: DISTANCE.toast, opacity: 0 },
    exitTo: { opacity: 0 },
    enterDuration: DUR.base,
    exitDuration: 0.16,
  });

  if (!present) return null;
  const isError = record.variant === "error";

  return (
    <ToastPrimitive.Root
      ref={ref}
      forceMount
      open={record.open}
      onOpenChange={(open) => {
        if (!open) dismiss(record.id);
      }}
      onSwipeStart={() => {
        if (ref.current) gsap.set(ref.current, { clearProps: "transform" });
      }}
      duration={record.duration ?? (isError ? Number.POSITIVE_INFINITY : DEFAULT_DURATION)}
      type={isError ? "foreground" : "background"}
      className={cn(
        "pointer-events-auto flex w-full max-w-[360px] items-start gap-3 rounded-sm border border-edge-overlay bg-surface-3 py-3 pl-4 pr-2 text-ink-1 shadow-overlay",
        "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)]",
        "data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform",
        "data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=end]:translate-y-[var(--radix-toast-swipe-end-y)]",
      )}
    >
      <span aria-hidden="true" className="mt-px inline-flex shrink-0">
        {icons[record.variant]}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 py-px">
        <ToastPrimitive.Title className="type-body-s font-semibold text-ink-1">
          {record.title}
        </ToastPrimitive.Title>
        {record.description ? (
          <ToastPrimitive.Description className="type-body-s text-ink-2">
            {record.description}
          </ToastPrimitive.Description>
        ) : null}
        {record.action ? (
          <ToastPrimitive.Action altText={record.action.altText ?? record.action.label} asChild>
            {record.action.href ? (
              <a
                href={record.action.href}
                className="self-start type-body-s font-semibold text-ink-1 underline decoration-line-strong underline-offset-4 transition-control hover:decoration-accent"
              >
                {record.action.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={record.action.onClick}
                className="self-start cursor-pointer type-body-s font-semibold text-ink-1 underline decoration-line-strong underline-offset-4 transition-control hover:decoration-accent"
              >
                {record.action.label}
              </button>
            )}
          </ToastPrimitive.Action>
        ) : null}
      </div>
      <ToastPrimitive.Close asChild>
        <IconButton label="Zatvori obaveštenje" size="sm" icon={<XIcon size={18} />} />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

/** Mounted once by Providers. */
export function Toaster() {
  const items = useToasts();
  const isDesktop = useMediaQuery(MEDIA.desktop);
  return (
    <ToastPrimitive.Provider swipeDirection={isDesktop ? "right" : "down"} label="Obaveštenje">
      {items.map((record) => (
        <ToastItem key={record.id} record={record} />
      ))}
      <ToastPrimitive.Viewport
        label="Obaveštenja ({hotkey})"
        className={cn(
          "pointer-events-none fixed z-toast flex flex-col gap-2 outline-none",
          "inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] items-center",
          "lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[360px]",
        )}
        data-reveal="off"
      />
    </ToastPrimitive.Provider>
  );
}
