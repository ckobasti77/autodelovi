"use client";

/**
 * Command palette (Ctrl/⌘ + K): one field for order and inquiry numbers, OEM / SKU / cross
 * numbers, product names, phone, e-mail and PIB (`adminSearch.run`), plus sections and
 * actions. Combobox pattern: the input owns focus, ↑/↓ move the active option, Enter opens.
 */
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  ChatCircleTextIcon,
  KeyboardIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  PlusIcon,
  ReceiptIcon,
  UsersIcon,
  WrenchIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/cn";
import { foldForSearch } from "@/lib/domain/search";
import { ADMIN_INQUIRY_STATUS, ADMIN_ORDER_STATUS } from "@/lib/i18n/sr/admin";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Kbd } from "@/components/ui/Kbd";
import { Spinner } from "@/components/ui/Spinner";
import { ADMIN } from "@/constants/routes";

import type { AdminNavItem } from "./nav";

type Option = {
  id: string;
  section: string;
  label: string;
  meta?: string;
  mono?: boolean;
  icon: ReactNode;
  badge?: ReactNode;
  run: () => void;
};

const KIND_ICON = {
  order: <ReceiptIcon size={18} />,
  inquiry: <ChatCircleTextIcon size={18} />,
  product: <PackageIcon size={18} />,
  customer: <UsersIcon size={18} />,
  mechanic: <WrenchIcon size={18} />,
} as const;

function useDebounced(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function CommandPalette({
  open,
  onOpenChange,
  items,
  onShortcuts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: AdminNavItem[];
  onShortcuts: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Pretraga i komande"
      size="md"
      position="top"
    >
      {open ? (
        <PaletteBody items={items} close={() => onOpenChange(false)} onShortcuts={onShortcuts} />
      ) : null}
    </Dialog>
  );
}

function PaletteBody({
  items,
  close,
  onShortcuts,
}: {
  items: AdminNavItem[];
  close: () => void;
  onShortcuts: () => void;
}) {
  const router = useRouter();
  const listId = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const term = useDebounced(q.trim(), 150);
  const hits = useQuery(api.adminSearch.run, term.length >= 2 ? { q: term } : "skip");
  const searching = term.length >= 2 && hits === undefined;

  const options = useMemo<Option[]>(() => {
    const go = (href: string) => () => {
      close();
      router.push(href);
    };
    const out: Option[] = [];
    for (const h of hits ?? []) {
      const status = h.orderStatus
        ? ADMIN_ORDER_STATUS[h.orderStatus]
        : h.inquiryStatus
          ? ADMIN_INQUIRY_STATUS[h.inquiryStatus]
          : null;
      out.push({
        id: `hit:${h.kind}:${h.id}`,
        section: "Rezultati",
        label: h.title,
        meta: h.meta,
        mono: h.kind === "order" || h.kind === "inquiry",
        icon: KIND_ICON[h.kind],
        badge: status ? <Badge tone={status.tone}>{status.label}</Badge> : undefined,
        run: go(h.href),
      });
    }
    const folded = foldForSearch(q);
    const navMatches = items.filter(
      (i) => !folded || foldForSearch(`${i.label} ${i.keywords ?? ""}`).includes(folded),
    );
    for (const i of navMatches) {
      const Icon = i.icon;
      out.push({
        id: `nav:${i.href}`,
        section: "Idi na",
        label: i.label,
        icon: <Icon size={18} />,
        run: go(i.href),
      });
    }
    const actions: Option[] = [
      {
        id: "act:new-product",
        section: "Radnje",
        label: "Novi artikal",
        icon: <PlusIcon size={18} />,
        run: go(ADMIN.productNew),
      },
      {
        id: "act:shortcuts",
        section: "Radnje",
        label: "Prečice na tastaturi",
        icon: <KeyboardIcon size={18} />,
        run: () => {
          close();
          onShortcuts();
        },
      },
    ];
    for (const a of actions) if (!folded || foldForSearch(a.label).includes(folded)) out.push(a);
    return out;
  }, [hits, items, q, close, router, onShortcuts]);

  const current = Math.min(active, Math.max(0, options.length - 1));

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((current + 1) % Math.max(1, options.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current - 1 + options.length) % Math.max(1, options.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      options[current]?.run();
    }
  };

  let lastSection = "";
  return (
    <div className="-mx-6 -my-4 flex flex-col" data-reveal="off">
      <div className="flex items-center gap-3 border-b border-line px-6 py-3">
        <MagnifyingGlassIcon size={20} className="shrink-0 text-ink-3" aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={options[current] ? `${listId}-${current}` : undefined}
          aria-autocomplete="list"
          aria-label="Pretraga: broj porudžbine, OEM, šifra, telefon, e-mail"
          placeholder="Broj porudžbine, OEM, šifra, telefon, e-mail…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-10 min-w-0 flex-1 bg-transparent text-[1rem] text-ink-1 outline-none placeholder:text-ink-3"
        />
        {searching ? <Spinner size={16} label="Traži se" /> : null}
      </div>
      <ul
        id={listId}
        role="listbox"
        aria-label="Rezultati"
        className="max-h-[min(60dvh,480px)] overflow-y-auto py-2"
      >
        {options.length === 0 ? (
          <li className="px-6 py-6 type-body-s text-ink-2" role="presentation">
            {term.length >= 2 && !searching
              ? `Nema rezultata za „${term}“.`
              : "Upišite bar dva znaka."}
          </li>
        ) : null}
        {options.map((o, index) => {
          const header = o.section !== lastSection ? o.section : null;
          lastSection = o.section;
          return (
            <li key={o.id} role="presentation">
              {header ? (
                <p className="px-6 pb-1 pt-3 type-label uppercase text-ink-3" aria-hidden="true">
                  {header}
                </p>
              ) : null}
              <div
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === current}
                onMouseMove={() => setActive(index)}
                onClick={() => o.run()}
                className={cn(
                  "mx-2 flex min-h-11 cursor-pointer items-center gap-3 rounded-xs px-4 type-body-s",
                  index === current ? "bg-selected text-ink-1" : "text-ink-2",
                )}
              >
                <span className="shrink-0 text-ink-3" aria-hidden="true">
                  {o.icon}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className={cn("truncate text-ink-1", o.mono && "type-code")}>
                    {o.label}
                  </span>
                  {o.meta ? (
                    <span className="truncate type-caption text-ink-3">{o.meta}</span>
                  ) : null}
                </span>
                {o.badge}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-6 py-2.5 type-caption text-ink-3">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> izbor
        </span>
        <span>
          <Kbd>Enter</Kbd> otvori
        </span>
        <span>
          <Kbd>Esc</Kbd> zatvori
        </span>
      </p>
    </div>
  );
}
