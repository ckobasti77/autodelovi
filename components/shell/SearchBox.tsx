"use client";

/**
 * OEM search with hints (DESIGN-SYSTEM §9.5) — header dialog and hero variant.
 *
 * - A plain GET form to /pretraga, so it works without JS.
 * - With JS: an ARIA combobox; suggestions come from `fetchSuggestions` (wired to Convex in
 *   the catalog step), debounced 150 ms; recent searches (this device only) when empty.
 * - A pasted list of several codes is recognised („Prepoznato 3 broja — otvori brzu
 *   porudžbinu“).
 */
import { useConvex } from "convex/react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { ArrowRightIcon, MagnifyingGlassIcon, XIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { parsePastedOemList } from "@/lib/domain/codes";
import { countSr } from "@/lib/format/plural";
import { Button } from "@/components/ui/Button";
import { Combobox, type ComboboxItem } from "@/components/ui/Combobox";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { ROUTES } from "@/constants/routes";
import { TERMS } from "@/lib/i18n/sr/shop";
import { api } from "@/convex/_generated/api";
import { formatNumber } from "@/lib/format/number";

export type SearchSuggestion = ComboboxItem & { href: string };

export type SearchBoxProps = {
  variant?: "header" | "hero";
  /** Async suggestions for a query (catalog step); omitted → only the „all results“ row. */
  fetchSuggestions?: (query: string, signal: AbortSignal) => Promise<SearchSuggestion[]>;
  autoFocus?: boolean;
  /** Called after navigation starts (e.g. to close the search dialog). */
  onNavigate?: () => void;
  testId?: string;
  /** Results in the flow under the field (header search dialog). */
  inlineResults?: boolean;
  /** Initial query (the search results page). */
  defaultQuery?: string;
  className?: string;
};

/** Convex-backed suggestions (§9.5): exact code hits, categories, products. */
function useConvexSuggestions() {
  const convex = useConvex();
  return useCallback(
    async (query: string): Promise<SearchSuggestion[]> => {
      const r = await convex.query(api.search.suggest, { q: query });
      return [
        ...r.codes.map((c) => ({
          id: `code-${c.productId}`,
          label: c.name,
          description: c.manufacturerName,
          meta: <span className="type-code text-ink-2">{c.code}</span>,
          group: "Tačno poklapanje",
          href: ROUTES.product(c.slug),
        })),
        ...r.categories.map((c) => ({
          id: `cat-${c.slug}`,
          label: c.name,
          meta: <span className="tabular-nums">{formatNumber(c.productCount)}</span>,
          group: "Kategorije",
          href: ROUTES.category(c.slug),
        })),
        ...r.products.map((p) => ({
          id: `p-${p.productId}`,
          label: p.name,
          description: p.manufacturerName,
          group: TERMS.items,
          href: ROUTES.product(p.slug),
        })),
      ];
    },
    [convex],
  );
}

const NO_SUGGESTIONS: SearchSuggestion[] = [];
const RECENT_KEY = "sk.recentSearches.v1";
const RECENT_MAX = 5;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string").slice(0, RECENT_MAX)
      : [];
  } catch {
    return [];
  }
}

function saveRecent(query: string) {
  try {
    const next = [query, ...readRecent().filter((q) => q !== query)].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode) — recent searches are optional.
  }
}

export function SearchBox({
  variant = "header",
  fetchSuggestions,
  autoFocus,
  onNavigate,
  testId,
  inlineResults = false,
  defaultQuery = "",
  className,
}: SearchBoxProps) {
  const router = useRouter();
  const convexSuggestions = useConvexSuggestions();
  const suggest = fetchSuggestions ?? convexSuggestions;
  const [query, setQuery] = useState(defaultQuery);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const inputWrap = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery("(min-width: 48rem)");

  // A code typed into the server-rendered field before hydration (XB-01): hydration leaves the
  // DOM value alone, but the controlled input would be reset to `query` on its next update.
  // Adopt it in the hydration commit, before anything re-renders the input. On a client-side
  // mount the DOM value always equals `query`, so this is a no-op.
  useLayoutEffect(() => {
    const typed = inputWrap.current?.querySelector("input")?.value;
    if (typed !== undefined && typed !== defaultQuery) setQuery(typed);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  useEffect(() => {
    // Recent searches live in localStorage, which only exists after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser storage
    setRecent(readRecent());
  }, []);

  useEffect(() => {
    if (autoFocus) inputWrap.current?.querySelector("input")?.focus();
  }, [autoFocus]);

  const trimmed = query.trim();
  const codes = useMemo(() => parsePastedOemList(query), [query]);
  const isList = codes.length >= 2;

  const applicable = trimmed.length >= 2 && !isList && trimmed !== defaultQuery.trim();

  useEffect(() => {
    if (!applicable) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setFailed(false);
      suggest(trimmed, controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) setSuggestions(items);
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailed(true);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [applicable, suggest, trimmed]);

  const shownSuggestions = applicable ? suggestions : NO_SUGGESTIONS;

  const go = (href: string) => {
    onNavigate?.();
    router.push(href);
  };

  const submit = (value: string) => {
    const q = value.trim();
    if (!q) return;
    if (codes.length >= 2) {
      go(ROUTES.mechanicQuickOrder(codes));
      return;
    }
    saveRecent(q);
    setRecent(readRecent());
    go(ROUTES.searchFor(q));
  };

  const items: SearchSuggestion[] = useMemo(() => {
    if (!trimmed) {
      return recent.map((q) => ({
        id: `recent-${q}`,
        label: q,
        group: "Nedavne pretrage",
        href: ROUTES.searchFor(q),
      }));
    }
    if (isList) {
      return [
        {
          id: "quick-order",
          label: `Prepoznato ${countSr(codes.length, ["broj", "broja", "brojeva"])}\u00a0— otvori brzu porudžbinu`,
          description: codes.slice(0, 4).join(", ") + (codes.length > 4 ? ", …" : ""),
          href: ROUTES.mechanicQuickOrder(codes),
        },
      ];
    }
    return shownSuggestions;
  }, [trimmed, recent, isList, codes, shownSuggestions]);

  const footer: ReactNode = trimmed ? (
    <button
      type="button"
      onClick={() => submit(query)}
      className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-3 text-left type-body-s font-semibold text-ink-1 transition-control hover:bg-surface-4"
    >
      <span className="truncate">Prikaži sve rezultate za „{trimmed}“</span>
      <ArrowRightIcon size={16} aria-hidden="true" className="shrink-0" />
    </button>
  ) : null;

  const onFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit(query);
  };

  const hero = variant === "hero";

  return (
    <form
      role="search"
      action={ROUTES.search}
      method="get"
      onSubmit={onFormSubmit}
      className={cn("flex flex-col gap-2", className)}
    >
      <div className={cn("flex gap-2", hero ? "flex-col sm:flex-row" : "")}>
        <div ref={inputWrap} className="min-w-0 flex-1" data-testid={testId}>
          <Combobox
            name="q"
            aria-label="Broj dela ili naziv"
            items={items}
            inputValue={query}
            onInputValueChange={setQuery}
            onSelect={(item) => {
              const match = items.find((candidate) => candidate.id === item.id);
              if (match) go(match.href);
            }}
            onSubmit={submit}
            loading={applicable && loading}
            error={
              applicable && failed
                ? "Pretraga trenutno ne radi\u00a0— pokušajte ponovo."
                : undefined
            }
            footer={footer}
            minChars={recent.length > 0 ? 0 : 1}
            size={hero ? "xl" : "md"}
            inlineList={inlineResults}
            placeholder={wide ? "npr. 1K0 615 301 AA ili kočione pločice" : "Broj dela ili naziv"}
            prefix={<MagnifyingGlassIcon size={20} />}
            suffix={
              query ? (
                <button
                  type="button"
                  aria-label="Obriši pretragu"
                  onClick={() => {
                    setQuery("");
                    inputWrap.current?.querySelector("input")?.focus();
                  }}
                  className="-mr-1.5 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xs text-ink-3 transition-control hover:bg-surface-3 hover:text-ink-1"
                >
                  <XIcon size={16} aria-hidden="true" />
                </button>
              ) : null
            }
          />
        </div>
        {hero ? (
          <Button type="submit" size="xl" className="sm:w-auto">
            Pretraži
          </Button>
        ) : null}
      </div>
      {hero ? (
        <p className="type-caption font-normal text-ink-3" data-reveal="off">
          Broj upišite kako god ga imate&nbsp;— razmaci, tačke i crtice ne smetaju.
        </p>
      ) : null}
    </form>
  );
}
