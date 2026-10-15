"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { Kbd } from "@/components/ui/Kbd";
import { OWN_SEARCH_ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";
import { useLatched } from "@/lib/hooks/useLatched";
import { useSearchPanel } from "@/lib/search/panel";

const loadPanel = () => import("@/components/shell/HeaderSearchPanel");
const HeaderSearchPanel = dynamic(() => loadPanel().then((m) => m.HeaderSearchPanel), {
  ssr: false,
});
/** Warm the dialog chunk on the first sign of intent (hover, focus), never during page load. */
export const warmSearchPanel = () => void loadPanel();

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * Header search entry — the primary action of the header at every width: a field-like button
 * that takes the free space (at most 256 / 288 / 320 px from 1024 / 1280 / 1536 px, so the bar
 * fits beside the logo and the nav, D387) and opens the OEM search in a top-anchored dialog.
 * „/“ opens it from anywhere outside a text field (the key hint shows from 1280 px); the mobile
 * action bar opens the same dialog through `useSearchPanel`.
 *
 * On a page that opens with its own search field (`OWN_SEARCH_ROUTES`: home, search) the header
 * field steps back while the page is at its top (`site-header-search`, a CSS scroll timeline).
 * The route decides — known on the server — not a `:root:has(…)` selector, which made the
 * browser restyle the whole document on every DOM change (D330).
 *
 * Only the trigger hydrates with the page; the dialog (radix Dialog + SearchBox) loads on
 * intent and stays mounted after the first open so its exit animation and focus return run
 * (PERF-01). The trigger is a plain button, so it carries the popup state itself.
 */
export function HeaderSearch({ className }: { className?: string }) {
  const open = useSearchPanel((s) => s.open);
  const setOpen = useSearchPanel((s) => s.setOpen);
  const mounted = useLatched(open);
  const stepsBack = OWN_SEARCH_ROUTES.includes(usePathname());

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onPointerEnter={warmSearchPanel}
        onFocus={warmSearchPanel}
        data-testid={TEST_IDS.headerSearchTrigger}
        aria-label="Pretraga delova: broj dela ili naziv"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="/"
        className={cn(
          "flex h-11 min-w-0 cursor-pointer items-center gap-2.5 rounded-sm border border-line-strong bg-surface-2 px-3 text-left type-body-s text-ink-3 shadow-rest transition-control hover:border-ink-4 hover:bg-surface-3 hover:text-ink-2 lg:h-10",
          stepsBack && "site-header-search",
          className,
        )}
      >
        <MagnifyingGlassIcon size={18} aria-hidden="true" className="shrink-0 text-ink-2" />
        <span className="min-w-0 flex-1 truncate">Broj dela ili naziv</span>
        <span aria-hidden="true" className="hidden xl:inline-flex">
          <Kbd>/</Kbd>
        </span>
      </button>
      {mounted ? <HeaderSearchPanel open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
