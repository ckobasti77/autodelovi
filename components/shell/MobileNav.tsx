"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ListIcon } from "@phosphor-icons/react/dist/ssr";

import { IconButton } from "@/components/ui/IconButton";
import type { ContactLink } from "@/config/site";
import { TEST_IDS } from "@/constants/testIds";
import { useLatched } from "@/lib/hooks/useLatched";

const loadPanel = () => import("@/components/shell/MobileNavPanel");
const MobileNavPanel = dynamic(() => loadPanel().then((m) => m.MobileNavPanel), { ssr: false });
/** Warm the sheet chunk on the first sign of intent (hover, focus, touch), never during load. */
const warm = () => void loadPanel();

/**
 * Mobile menu trigger (< 1024 px). Only the button hydrates with the page; the sheet with the
 * navigation, account and contact channels (`MobileNavPanel`) loads on intent and stays
 * mounted after the first open so its exit animation and focus return run (PERF-01).
 */
export function MobileNav({
  contacts,
  className,
}: {
  contacts: ContactLink[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useLatched(open);

  return (
    <div className={className}>
      <IconButton
        label="Otvori meni"
        icon={<ListIcon size={24} />}
        data-testid={TEST_IDS.mobileMenuTrigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        onPointerEnter={warm}
        onPointerDown={warm}
        onFocus={warm}
      />
      {mounted ? (
        <MobileNavPanel contacts={contacts} open={open} onOpenChange={setOpen} />
      ) : null}
    </div>
  );
}
