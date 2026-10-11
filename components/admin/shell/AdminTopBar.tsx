"use client";

/**
 * Paper top bar (56 px): menu (below 1024 px), breadcrumb, palette trigger with its shortcut,
 * the notification bell and the account menu.
 */
import { useAuthActions } from "@convex-dev/auth/react";
import { usePathname, useRouter } from "next/navigation";
import {
  KeyboardIcon,
  ListIcon,
  MagnifyingGlassIcon,
  SignOutIcon,
  StorefrontIcon,
  UserCircleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Kbd } from "@/components/ui/Kbd";
import { Menu } from "@/components/ui/Menu";
import { RouteLink } from "@/components/ui/RouteLink";
import { ROUTES } from "@/constants/routes";
import { ROLE_LABEL } from "@/lib/i18n/sr/admin";

import { breadcrumbTrail, useAdminShell } from "./context";
import { NotificationBell } from "./NotificationBell";

export function AdminTopBar({
  crumb,
  nowMinute,
  onMenu,
  onShortcuts,
}: {
  crumb: string | null;
  nowMinute: number;
  onMenu: () => void;
  onShortcuts: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useAuthActions();
  const { viewer, openPalette } = useAdminShell();
  const trail = breadcrumbTrail(pathname, crumb);

  return (
    <header data-sticky-header="" className="sticky top-0 z-sticky h-14 shrink-0 border-b border-line bg-surface-1 print:hidden">
      {/* Same 1680 px column as <main>, so the bar lines up with the workspace at 2560 (VIS-39). */}
      <div className="mx-auto flex h-full w-full max-w-[1680px] items-center gap-3 px-4 lg:px-6">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Meni administracije"
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-sm text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1 focus-ring-inset lg:hidden"
        >
          <ListIcon size={22} aria-hidden="true" />
        </button>
        <nav aria-label="Putanja" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5 type-body-s">
            {trail.map((t, i) => {
              const last = i === trail.length - 1;
              return (
                <li
                  key={t.href}
                  className={
                    last ? "min-w-0 truncate" : "hidden shrink-0 items-center gap-1.5 sm:flex"
                  }
                >
                  {last ? (
                    <span aria-current="page" className="truncate font-semibold text-ink-1">
                      {t.label}
                    </span>
                  ) : (
                    <>
                      <RouteLink
                        href={t.href}
                        className="rounded-sm text-ink-3 transition-control hover:text-ink-1"
                      >
                        {t.label}
                      </RouteLink>
                      <span aria-hidden="true" className="text-ink-4">
                        /
                      </span>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
        <button
          type="button"
          onClick={openPalette}
          className="hidden h-9 w-[min(360px,32vw)] cursor-pointer items-center gap-2 rounded-sm border border-control bg-surface-2 px-3 text-left type-body-s text-ink-3 transition-control hover:border-ink-3 focus-ring-inset md:flex"
        >
          <MagnifyingGlassIcon size={18} aria-hidden="true" />
          <span className="flex-1 truncate">Broj porudžbine, OEM, telefon…</span>
          <Kbd>Ctrl K</Kbd>
        </button>
        <button
          type="button"
          onClick={openPalette}
          aria-label="Pretraga"
          className="inline-flex size-10 cursor-pointer items-center justify-center rounded-sm text-ink-2 transition-control hover:bg-surface-2 focus-ring-inset md:hidden"
        >
          <MagnifyingGlassIcon size={20} aria-hidden="true" />
        </button>
        <NotificationBell nowMinute={nowMinute} />
        <Menu
          align="end"
          trigger={
            <button
              type="button"
              aria-label={`Nalog: ${viewer.name}`}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-sm px-2 text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1 focus-ring-inset"
            >
              <UserCircleIcon size={22} aria-hidden="true" />
              <span className="hidden max-w-40 truncate type-body-s xl:inline">{viewer.name}</span>
            </button>
          }
          items={[
            {
              type: "label",
              label: `${viewer.email ?? viewer.name} · ${viewer.isOwner ? ROLE_LABEL.owner : ROLE_LABEL.staff}`,
            },
            { label: "Prodavnica", icon: <StorefrontIcon size={18} />, href: ROUTES.home },
            {
              label: "Prečice na tastaturi",
              icon: <KeyboardIcon size={18} />,
              onSelect: onShortcuts,
            },
            { type: "separator" },
            {
              label: "Odjavi se",
              icon: <SignOutIcon size={18} />,
              onSelect: () => {
                void signOut().then(() => router.replace(ROUTES.signIn));
              },
            },
          ]}
        />
      </div>
    </header>
  );
}
