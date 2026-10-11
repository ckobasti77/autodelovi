"use client";

/**
 * Admin shell (DESIGN-SYSTEM §10.10): night sidebar + paper workspace. Portaled overlays
 * (menus, dialogs, toasts) inherit the paper theme because the shell marks <body> while it
 * is mounted; the sidebar pins the night theme on its own subtree. The whole shell is
 * `data-reveal="off"` (no text entrances in a working tool).
 */
import { useMutation } from "convex/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { XIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { useHydrated } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { useControllableOpen, useOverlayMotion, usePresence } from "@/components/ui/motion";
import { DISTANCE, DUR } from "@/constants/motion";

import { useNowMinute } from "../hooks";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopBar } from "./AdminTopBar";
import { CommandPalette } from "./CommandPalette";
import { ConnectionBanner } from "./ConnectionBanner";
import { AdminShellContext, type AdminViewer } from "./context";
import { navItems } from "./nav";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { useAdminHotkeys } from "./useAdminHotkeys";

function MobileNav({
  open,
  onOpenChange,
  isOwner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isOwner: boolean;
}) {
  const [isOpen, setOpen] = useControllableOpen(open, false, onOpenChange);
  const [present, onExited] = usePresence(isOpen);
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  useOverlayMotion({
    open: isOpen,
    present,
    onExited,
    panel,
    scrim,
    enterFrom: { x: -DISTANCE.panel, opacity: 0 },
    enterDuration: DUR.panel,
    exitDuration: DUR.panelExit,
  });
  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={setOpen}>
      {present ? (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay
            forceMount
            ref={scrim}
            className="fixed inset-0 z-overlay bg-scrim lg:hidden"
          />
          <DialogPrimitive.Content
            forceMount
            ref={panel}
            aria-describedby={undefined}
            data-theme="night"
            className="fixed inset-y-0 left-0 z-drawer w-[min(280px,86vw)] bg-bg text-ink-1 outline-none lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Meni administracije</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton
                label="Zatvori meni"
                icon={<XIcon size={20} />}
                className="absolute right-2 top-2 z-raised"
              />
            </DialogPrimitive.Close>
            <AdminSidebar isOwner={isOwner} variant="full" onNavigate={() => setOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      ) : null}
    </DialogPrimitive.Root>
  );
}

export function AdminShell({ viewer, children }: { viewer: AdminViewer; children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [crumb, setCrumbState] = useState<string | null>(null);
  const nowMinute = useNowMinute();
  // The connection strip reads the browser and the Convex socket: client only, after hydration.
  const hydrated = useHydrated();
  const pathname = usePathname();
  const items = useMemo(() => navItems(viewer.isOwner), [viewer.isOwner]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const setCrumb = useCallback((label: string | null) => setCrumbState(label), []);
  useAdminHotkeys({ items, openPalette, openShortcuts });
  const touch = useMutation(api.staff.touchStaffActivity);
  useEffect(() => {
    void touch({}).catch(() => undefined);
  }, [touch]);

  useEffect(() => {
    const body = document.body;
    const previous = body.getAttribute("data-theme");
    body.setAttribute("data-theme", "paper");
    return () => {
      if (previous === null) body.removeAttribute("data-theme");
      else body.setAttribute("data-theme", previous);
    };
  }, []);

  // Close the drawer after navigation (the drawer links also close it on click).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (menuOpen) setMenuOpen(false);
  }

  const value = useMemo(() => ({ viewer, openPalette, setCrumb }), [viewer, openPalette, setCrumb]);

  return (
    <AdminShellContext.Provider value={value}>
      <div
        className="grid min-h-dvh grid-cols-1 bg-bg text-ink-1 lg:max-[1365px]:grid-cols-[64px_minmax(0,1fr)] min-[1366px]:grid-cols-[268px_minmax(0,1fr)] print:block"
        data-theme="paper"
        data-reveal="off"
      >
        <aside
          data-theme="night"
          className="hidden border-r border-line bg-bg text-ink-1 lg:block print:hidden"
        >
          <div className="sticky top-0 h-dvh">
            <AdminSidebar isOwner={viewer.isOwner} variant="auto" />
          </div>
        </aside>
        <div className="flex min-w-0 flex-col">
          <AdminTopBar
            crumb={crumb}
            nowMinute={nowMinute}
            onMenu={() => setMenuOpen(true)}
            onShortcuts={openShortcuts}
          />
          {hydrated ? <ConnectionBanner /> : null}
          <main
            id="sadrzaj"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1680px] flex-1 px-4 py-6 outline-none lg:px-6 print:p-0"
          >
            {children}
          </main>
        </div>
      </div>
      <MobileNav open={menuOpen} onOpenChange={setMenuOpen} isOwner={viewer.isOwner} />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={items}
        onShortcuts={openShortcuts}
      />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} items={items} />
    </AdminShellContext.Provider>
  );
}
