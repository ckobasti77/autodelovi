"use client";

/**
 * „Filteri“ popover for admin tables: the button shows how many filters are active; the
 * panel holds the fields and a reset. Radix Popover (focus trap, Esc, outside click).
 */
import { Popover } from "radix-ui";
import type { ReactNode } from "react";
import { FunnelIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/Button";

export function FiltersPopover({
  active,
  onReset,
  children,
}: {
  active: number;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="secondary" size="sm" icon={<FunnelIcon size={16} />}>
          Filteri{active > 0 ? ` (${active})` : ""}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          data-reveal="off"
          className="z-dropdown flex w-[min(360px,calc(100vw-24px))] flex-col gap-4 rounded-md bg-surface-3 p-4 text-ink-1 shadow-overlay outline-none"
        >
          {children}
          <div className="flex justify-between gap-2 border-t border-line pt-3">
            <Button variant="ghost" size="sm" onClick={onReset} disabled={active === 0}>
              Poništi filtere
            </Button>
            <Popover.Close asChild>
              <Button size="sm">Gotovo</Button>
            </Popover.Close>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
