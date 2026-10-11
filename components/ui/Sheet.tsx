"use client";

/**
 * Sheet (§8.5, §9.10–9.11): right drawer on desktop, bottom sheet on phones.
 *
 * - Drawer: x 24 px → 0 + opacity in 360 ms (sk.out); leaves to the right in 240 ms (sk.in).
 * - Bottom sheet: rises from the bottom edge; GSAP Draggable (type y) + InertiaPlugin on the
 *   handle/header — 1:1 tracking, snap points peek 42 % / full 92 % chosen from the projected
 *   end point, rubber band above full (resistance .55), dismissed when the projection shows
 *   less than 25 % or a downward flick is faster than 800 px/s. The handle is also a button
 *   (Enter toggles peek/full) and there is always a close button.
 * - modal (default): scrim, focus trap, background hidden from AT (Radix). Non-modal (3D part
 *   panel): no scrim, the page stays interactive, outside clicks do not close it.
 * - Reduced motion: 160 ms opacity only.
 */
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { loadDragPlugins, type DraggableInstance } from "@/lib/gsap/drag";
import { IconButton } from "@/components/ui/IconButton";
import {
  useControllableOpen,
  useMediaQuery,
  useOverlayMotion,
  usePresence,
} from "@/components/ui/motion";
import { DISTANCE, DUR, EASE, MEDIA, SHEET } from "@/constants/motion";
import { useFocusReturn } from "@/lib/dom/focusReturn";

export type SheetProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title: ReactNode;
  /** Extra header content under the title (count, vehicle row). */
  header?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Sticky footer (actions). */
  footer?: ReactNode;
  /** `responsive`: drawer ≥ 1024 px, bottom sheet below. */
  side?: "right" | "bottom" | "responsive";
  /** Drawer width: sm 420 px (cart), md 440/480 px (part panel). */
  size?: "sm" | "md";
  modal?: boolean;
  /** Bottom sheet opening position. */
  initialSnap?: "peek" | "full";
  /** Drawer sits under the sticky header instead of covering it (non-modal panels). */
  belowHeader?: boolean;
  /** Focus handling (Radix): e.g. return focus to a custom element when the panel closes. */
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  testId?: string;
  className?: string;
};

export function Sheet({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  header,
  description,
  children,
  footer,
  side = "responsive",
  size = "sm",
  modal = true,
  initialSnap = "full",
  belowHeader = false,
  onOpenAutoFocus,
  onCloseAutoFocus,
  testId,
  className,
}: SheetProps) {
  const [isOpen, setOpen] = useControllableOpen(open, defaultOpen, onOpenChange);
  const [present, onExited] = usePresence(isOpen);
  const isDesktop = useMediaQuery(MEDIA.desktop);
  const resolvedSide = side === "responsive" ? (isDesktop ? "right" : "bottom") : side;
  // Trigger-less sheets (opened from global state) return focus themselves (A11Y-02).
  const focusReturn = useFocusReturn(!trigger, isOpen);
  const focus = {
    onOpenAutoFocus,
    onCloseAutoFocus: (event: Event) => {
      onCloseAutoFocus?.(event);
      focusReturn.onCloseAutoFocus(event);
    },
    testId,
  };

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={setOpen} modal={modal}>
      {trigger ? <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger> : null}
      {present ? (
        <DialogPrimitive.Portal forceMount>
          {resolvedSide === "right" ? (
            <Drawer
              open={isOpen}
              present={present}
              onExited={onExited}
              modal={modal}
              size={size}
              belowHeader={belowHeader}
              title={title}
              header={header}
              description={description}
              footer={footer}
              focus={focus}
              className={className}
            >
              {children}
            </Drawer>
          ) : (
            <BottomSheet
              open={isOpen}
              present={present}
              onExited={onExited}
              onDismiss={() => setOpen(false)}
              modal={modal}
              initialSnap={initialSnap}
              title={title}
              header={header}
              description={description}
              footer={footer}
              focus={focus}
              className={className}
            >
              {children}
            </BottomSheet>
          )}
        </DialogPrimitive.Portal>
      ) : null}
    </DialogPrimitive.Root>
  );
}

type FocusProps = {
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  testId?: string;
};

type PanelProps = {
  focus?: FocusProps;
  open: boolean;
  present: boolean;
  onExited: () => void;
  modal: boolean;
  title: ReactNode;
  header?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  className?: string;
  children?: ReactNode;
};

function PanelHeader({
  title,
  header,
  description,
}: Pick<PanelProps, "title" | "header" | "description">) {
  return (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">
        <DialogPrimitive.Title className="type-h3 text-ink-1">{title}</DialogPrimitive.Title>
        {description ? (
          <DialogPrimitive.Description className="type-body-s text-ink-3">
            {description}
          </DialogPrimitive.Description>
        ) : null}
        {header}
      </div>
      <DialogPrimitive.Close asChild>
        <IconButton
          label="Zatvori"
          icon={<XIcon size={22} />}
          className="-mr-2 shrink-0"
          data-no-drag=""
        />
      </DialogPrimitive.Close>
    </>
  );
}

function outsideGuard(modal: boolean) {
  return (event: Event) => {
    if (!modal) event.preventDefault();
  };
}

function Drawer({
  focus,
  open,
  present,
  onExited,
  modal,
  size,
  belowHeader,
  title,
  header,
  description,
  footer,
  className,
  children,
}: PanelProps & { size: "sm" | "md"; belowHeader: boolean }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);

  useOverlayMotion({
    open,
    present,
    onExited,
    panel: panelRef,
    scrim: modal ? scrimRef : undefined,
    enterFrom: { x: DISTANCE.panel, opacity: 0 },
    enterDuration: DUR.panel,
    exitDuration: DUR.panelExit,
  });

  return (
    <>
      {modal ? (
        <DialogPrimitive.Overlay
          forceMount
          ref={scrimRef}
          className="fixed inset-0 z-overlay bg-scrim"
        />
      ) : null}
      <DialogPrimitive.Content
        forceMount
        ref={panelRef}
        onInteractOutside={outsideGuard(modal)}
        onOpenAutoFocus={focus?.onOpenAutoFocus}
        onCloseAutoFocus={focus?.onCloseAutoFocus}
        data-testid={focus?.testId}
        {...(description ? {} : { "aria-describedby": undefined })}
        className={cn(
          "fixed right-0 z-drawer flex w-full flex-col border-l border-edge-overlay bg-surface-3 text-ink-1 shadow-drawer outline-none",
          belowHeader ? "top-header bottom-0" : "inset-y-0",
          size === "sm" ? "max-w-[420px]" : "max-w-[440px] xl:max-w-[480px]",
          className,
        )}
      >
        <div className="flex items-start gap-3 border-b border-line px-6 pb-4 pt-3">
          <PanelHeader title={title} header={header} description={description} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {children}
        </div>
        {footer ? (
          <div className="flex flex-col gap-3 border-t border-line px-6 py-4">{footer}</div>
        ) : null}
      </DialogPrimitive.Content>
    </>
  );
}

function BottomSheet({
  focus,
  open,
  present,
  onExited,
  onDismiss,
  modal,
  initialSnap,
  title,
  header,
  description,
  footer,
  className,
  children,
}: PanelProps & { onDismiss: () => void; initialSnap: "peek" | "full" }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<"peek" | "full">(initialSnap);
  const dismissRef = useRef(onDismiss);
  useEffect(() => {
    dismissRef.current = onDismiss;
  });

  /** y offset (px) of the panel for a snap point; the panel is `full` × viewport tall. */
  const offsetFor = (point: "peek" | "full" | "closed") => {
    const vh = window.innerHeight;
    const height = SHEET.full * vh;
    if (point === "full") return 0;
    if (point === "peek") return height - SHEET.peek * vh;
    return height;
  };

  useOverlayMotion({
    open,
    present,
    onExited,
    panel: panelRef,
    scrim: modal ? scrimRef : undefined,
    enterFrom: { yPercent: 100 },
    exitTo: { yPercent: 100 },
    enterDuration: DUR.panel,
    exitDuration: DUR.panelExit,
  });

  // Position at the initial snap on open (the enter tween animates yPercent; y holds the snap).
  useGSAP(
    () => {
      const panel = panelRef.current;
      if (!panel || !open) return;
      gsap.set(panel, { y: offsetFor(initialSnap) });
    },
    { dependencies: [open] },
  );

  useGSAP(
    () => {
      const panel = panelRef.current;
      const handle = handleRef.current;
      if (!panel || !handle || !open) return;

      // The drag plugins load with the first open sheet (a few KB, well before a finger moves).
      let draggable: DraggableInstance | undefined;
      let cancelled = false;
      void loadDragPlugins().then(({ Draggable, InertiaPlugin }) => {
        if (cancelled) return;
        [draggable] = Draggable.create(panel, {
          type: "y",
          trigger: handle,
          inertia: true,
          edgeResistance: SHEET.resistance,
          bounds: { minY: 0, maxY: offsetFor("closed") },
          allowContextMenu: true,
          dragClickables: true,
          clickableTest: (element: Element) => element.closest("[data-no-drag]") !== null,
          snap: {
            y(endValue: number) {
              const closed = offsetFor("closed");
              const velocity = InertiaPlugin.getVelocity(panel, "y");
              const visible = (closed - endValue) / window.innerHeight;
              if (velocity > SHEET.flickVelocity || visible < SHEET.dismissBelow) return closed;
              const peek = offsetFor("peek");
              return Math.abs(endValue - peek) < Math.abs(endValue) ? peek : 0;
            },
          },
          onThrowComplete() {
            const y = Number(gsap.getProperty(panel, "y"));
            if (Math.abs(y - offsetFor("closed")) < 2) dismissRef.current();
            else setSnap(y === 0 ? "full" : "peek");
          },
        });
      });
      return () => {
        cancelled = true;
        draggable?.kill();
      };
    },
    { dependencies: [open] },
  );

  const toggleSnap = () => {
    const next = snap === "full" ? "peek" : "full";
    setSnap(next);
    const panel = panelRef.current;
    if (panel) {
      gsap.to(panel, {
        y: offsetFor(next),
        duration: prefersReducedMotion() ? 0 : DUR.panel,
        ease: EASE.out,
      });
    }
  };

  return (
    <>
      {modal ? (
        <DialogPrimitive.Overlay
          forceMount
          ref={scrimRef}
          className="fixed inset-0 z-overlay bg-scrim"
        />
      ) : null}
      <DialogPrimitive.Content
        forceMount
        ref={panelRef}
        onInteractOutside={outsideGuard(modal)}
        onOpenAutoFocus={focus?.onOpenAutoFocus}
        onCloseAutoFocus={focus?.onCloseAutoFocus}
        data-testid={focus?.testId}
        {...(description ? {} : { "aria-describedby": undefined })}
        style={{ height: `${SHEET.full * 100}dvh` }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-drawer flex flex-col rounded-t-2xl border-t border-edge-overlay bg-surface-3 text-ink-1 shadow-drawer outline-none",
          className,
        )}
      >
        <div ref={handleRef} className="touch-none select-none">
          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={toggleSnap}
              aria-label={snap === "full" ? "Smanji panel" : "Proširi panel"}
              className="flex h-6 w-16 cursor-grab items-center justify-center rounded-sm active:cursor-grabbing"
            >
              <span aria-hidden="true" className="block h-1 w-9 rounded-full bg-line-strong" />
            </button>
          </div>
          <div className="flex items-start gap-3 border-b border-line px-4 pb-3">
            <PanelHeader title={title} header={header} description={description} />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {children}
        </div>
        {footer ? (
          <div className="flex flex-col gap-3 border-t border-line px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            {footer}
          </div>
        ) : null}
      </DialogPrimitive.Content>
    </>
  );
}
