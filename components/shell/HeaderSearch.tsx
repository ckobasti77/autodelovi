"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";

import { IconButton } from "@/components/ui/IconButton";
import { Kbd } from "@/components/ui/Kbd";
import { TEST_IDS } from "@/constants/testIds";
import { useLatched } from "@/lib/hooks/useLatched";

const loadPanel = () => import("@/components/shell/HeaderSearchPanel");
const HeaderSearchPanel = dynamic(() => loadPanel().then((m) => m.HeaderSearchPanel), {
  ssr: false,
});
/** Warm the dialog chunk on the first sign of intent (hover, focus), never during page load. */
const warm = () => void loadPanel();

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * Header search entry: a field-like button (≥ 1280 px) or an icon button that opens the OEM
 * search in a top-anchored dialog. „/“ opens it from anywhere outside a text field.
 *
 * Only the triggers hydrate with the page; the dialog (radix Dialog + SearchBox) loads on
 * intent and stays mounted after the first open so its exit animation and focus return run
 * (PERF-01). The triggers are plain buttons, so they carry the popup state themselves.
 */
export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  const mounted = useLatched(open);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        onPointerEnter={warm}
        onFocus={warm}
        data-testid={TEST_IDS.headerSearchTrigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="/"
        className="hidden h-10 w-64 cursor-pointer items-center gap-2.5 rounded-xs border border-control bg-surface-2 px-3 text-left type-body-s text-ink-3 transition-control hover:border-ink-3 hover:text-ink-2 xl:flex 2xl:w-72"
      >
        <MagnifyingGlassIcon size={18} aria-hidden="true" className="shrink-0" />
        <span className="flex-1 truncate">Broj dela ili naziv</span>
        <Kbd aria-hidden="true">/</Kbd>
      </button>
      <IconButton
        label="Pretraga delova"
        icon={<MagnifyingGlassIcon size={24} />}
        onClick={() => setOpen(true)}
        onPointerEnter={warm}
        onFocus={warm}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts="/"
        className="xl:hidden"
      />
      {mounted ? <HeaderSearchPanel open={open} onOpenChange={setOpen} /> : null}
    </>
  );
}
