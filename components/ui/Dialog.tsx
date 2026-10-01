"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { useRef, type ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/IconButton";
import { useControllableOpen, useOverlayMotion, usePresence } from "@/components/ui/motion";
import { DISTANCE, DUR } from "@/constants/motion";
import { useFocusReturn } from "@/lib/dom/focusReturn";

export type DialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the dialog (rendered via Radix Trigger asChild). */
  trigger?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Footer actions, right-aligned: secondary first, primary last. */
  footer?: ReactNode;
  /** 480 px (confirmations) or 640 px (forms). */
  size?: "sm" | "md";
  /** Block Esc / outside click (e.g. while a destructive action is running). */
  dismissible?: boolean;
  /** `alertdialog` for confirmations that interrupt. */
  role?: "dialog" | "alertdialog";
  /** `top` anchors the panel near the top (search), `center` otherwise. */
  position?: "center" | "top";
  className?: string;
};

/**
 * Dialog (§9.14): surface-3, radius 6, level 4; scrim fades 220 ms, panel lifts 8 px + fades
 * 240 ms (sk.out) and leaves in 160 ms (sk.in). Focus moves in on open and returns to the
 * trigger on close (Radix); without a `trigger` it returns to the element that was focused
 * when the dialog opened (useFocusReturn, A11Y-02). On phones use Sheet for anything longer than a confirmation.
 */
export function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  footer,
  size = "sm",
  dismissible = true,
  role = "dialog",
  position = "center",
  className,
}: DialogProps) {
  const [isOpen, setOpen] = useControllableOpen(open, defaultOpen, onOpenChange);
  const [present, onExited] = usePresence(isOpen);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const focusReturn = useFocusReturn(!trigger, isOpen);

  useOverlayMotion({
    open: isOpen,
    present,
    onExited,
    panel: panelRef,
    scrim: scrimRef,
    enterFrom: { y: DISTANCE.ui, opacity: 0 },
    exitTo: { opacity: 0 },
    enterDuration: DUR.panelExit,
    exitDuration: 0.16,
  });

  const guard = (event: Event) => {
    if (!dismissible) event.preventDefault();
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      {present ? (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay
            forceMount
            ref={scrimRef}
            className="fixed inset-0 z-overlay bg-scrim"
          />
          <div
            className={cn(
              "pointer-events-none fixed inset-0 z-dialog grid grid-cols-[minmax(0,1fr)] justify-items-center p-4",
              position === "center" ? "items-center" : "items-start pt-[max(1rem,8vh)]",
            )}
          >
            <DialogPrimitive.Content
              forceMount
              ref={panelRef}
              role={role}
              onCloseAutoFocus={focusReturn.onCloseAutoFocus}
              onEscapeKeyDown={guard}
              onPointerDownOutside={guard}
              className={cn(
                "pointer-events-auto flex max-h-[min(88dvh,720px)] w-full min-w-0 flex-col rounded-md border border-edge-overlay bg-surface-3 text-ink-1 shadow-drawer outline-none",
                size === "sm" ? "max-w-[480px]" : "max-w-[640px]",
                className,
              )}
              {...(description ? {} : { "aria-describedby": undefined })}
            >
              <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-5">
                <DialogPrimitive.Title className="pt-1.5 type-h3 text-ink-1">
                  {title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
                  <IconButton
                    label="Zatvori"
                    icon={<XIcon size={20} />}
                    className="-mr-2 -mt-1"
                    disabled={!dismissible}
                  />
                </DialogPrimitive.Close>
              </div>
              {description ? (
                <DialogPrimitive.Description className="px-6 type-body text-ink-2">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
              {children ? (
                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4 type-body">{children}</div>
              ) : null}
              {footer ? (
                <div className="flex flex-col-reverse gap-3 border-t border-line px-6 py-4 sm:flex-row sm:justify-end">
                  {footer}
                </div>
              ) : null}
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Portal>
      ) : null}
    </DialogPrimitive.Root>
  );
}

/** Close wrapper for footer buttons: <DialogClose asChild><Button …/></DialogClose>. */
export const DialogClose = DialogPrimitive.Close;
