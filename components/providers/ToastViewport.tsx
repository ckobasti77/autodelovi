"use client";

/**
 * Toast viewport (§9.13, §8.5), loaded by `Toaster` from `components/ui/Toast` with the first
 * `toast()` call (PERF-11). Bottom-centre on phones, bottom-right on desktop, 360 px, max 3.
 * Enter 16 px + opacity in 220 ms (sk.out), exit opacity in 160 ms (sk.in); 5 s auto-dismiss,
 * paused on hover/focus (Radix); errors stay until closed and are announced assertively.
 */
import { Toast as ToastPrimitive } from "radix-ui";
import { useRef, type ReactNode } from "react";
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
import {
  dismissToast as dismiss,
  removeToast as remove,
  useToasts,
  type ToastRecord,
  type ToastVariant,
} from "@/components/ui/Toast";
import { DISTANCE, DUR, MEDIA } from "@/constants/motion";
import { gsap } from "@/lib/gsap/client";

const DEFAULT_DURATION = 5000;

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
        "pointer-events-auto flex w-full max-w-[360px] items-start gap-3 rounded-md border border-edge-overlay bg-surface-3 py-3 pl-4 pr-2 text-ink-1 shadow-overlay",
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

export function ToastViewport() {
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
          // Above the mobile action bar (its height already includes the safe area).
          "inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom),calc(var(--bottom-bar-h)+0.75rem))] items-center",
          "lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-[360px]",
        )}
        data-reveal="off"
      />
    </ToastPrimitive.Provider>
  );
}
