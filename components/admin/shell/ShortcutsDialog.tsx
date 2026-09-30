"use client";

import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Kbd";

import type { AdminNavItem } from "./nav";

/** „?“ — the list of keyboard shortcuts (generated from the navigation keys). */
export function ShortcutsDialog({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AdminNavItem[];
}) {
  const rows: { keys: string[]; label: string }[] = [
    { keys: ["Ctrl", "K"], label: "Pretraga i komande (na Macu ⌘ K)" },
    { keys: ["/"], label: "Pretraga na stranici" },
    { keys: ["?"], label: "Ova lista" },
    ...items
      .filter((i) => i.key)
      .map((i) => ({ keys: ["g", i.key!], label: `Idi na: ${i.label}` })),
    { keys: ["n", "a"], label: "Novi artikal" },
    { keys: ["↑", "↓"], label: "Kretanje kroz redove tabele" },
    { keys: ["Enter"], label: "Otvori izabrani red" },
    { keys: ["Razmak"], label: "Izaberi red (grupne radnje)" },
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Prečice na tastaturi" size="md">
      <dl
        className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 type-body-s"
        data-reveal="off"
      >
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="flex items-center gap-1">
              {r.keys.map((k, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  {i > 0 ? (
                    <span className="text-ink-3">{r.keys[0] === "Ctrl" ? "+" : "zatim"}</span>
                  ) : null}
                  <Kbd>{k}</Kbd>
                </span>
              ))}
            </dt>
            <dd className="text-ink-2">{r.label}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
