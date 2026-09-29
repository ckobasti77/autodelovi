"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr";

import { Dialog } from "@/components/ui/Dialog";
import { IconButton } from "@/components/ui/IconButton";
import { Kbd } from "@/components/ui/Kbd";
import { SearchBox } from "@/components/shell/SearchBox";
import { TEST_IDS } from "@/constants/testIds";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

/**
 * Header search entry: a field-like button (≥ 1280 px) or an icon button that opens the OEM
 * search in a top-anchored dialog. „/“ opens it from anywhere outside a text field.
 */
export function HeaderSearch() {
  const [open, setOpen] = useState(false);

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
        data-testid={TEST_IDS.headerSearchTrigger}
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
        aria-keyshortcuts="/"
        className="xl:hidden"
      />
      <Dialog open={open} onOpenChange={setOpen} title="Pretraga delova" position="top" size="md">
        <SearchBox
          variant="header"
          autoFocus
          testId={TEST_IDS.headerSearchInput}
          inlineResults
          onNavigate={() => setOpen(false)}
        />
        <p className="mt-3 type-caption font-normal text-ink-3">
          Broj upišite kako god ga imate&nbsp;— razmaci, tačke i crtice ne smetaju.
        </p>
      </Dialog>
    </>
  );
}
