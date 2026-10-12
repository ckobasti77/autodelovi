"use client";

/**
 * Quick order (§10.9, ARCHITECTURE §A4): paste „OEM količina“ lines or upload a small CSV →
 * parse locally (rows appear at once) → `mechanicPortal.quickOrderMatch` → exact / more
 * options / not found → „Dodaj sve u korpu“ (one `carts.addMany`) and „Pošalji upit za
 * nepronađene“ (one `mechanicPortal.inquireMissing`, contact from the profile).
 *
 * Prices and stock are the server's snapshot for this mechanic; the cart re-prices on read
 * and the order re-prices on submit.
 *
 * Layout (UI-BOOST §7.7): the input is a raised panel (sticky from `lg`), with the format
 * reference behind „Kako se upisuje“; the answer is one panel of system rows — line number,
 * mono code, status chip, article, price, stepper, „Ukloni“ — whose geometry follows the
 * panel's own width (container query), and a sticky summary bar. `aside` is what the page puts
 * under the answer (the overview on `/majstor`); without it an idle panel says what to expect.
 */
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  FileArrowUpIcon,
  MagnifyingGlassIcon,
  PaperPlaneTiltIcon,
  ShoppingCartSimpleIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { openCartDrawer } from "@/lib/cart/drawer";
import { useCart } from "@/lib/cart/guestCart";
import { useBottomInset } from "@/lib/dom/bottomInset";
import { cn } from "@/lib/cn";
import {
  decodeQuickOrderFile,
  parseQuickOrder,
  QUICK_ORDER_MAX_CHARS,
  QUICK_ORDER_MAX_QTY,
  type QuickOrderParse,
} from "@/lib/domain/quickOrder";
import { canOrderQuantity } from "@/lib/domain/stock";
import { formatRSD } from "@/lib/format/money";
import { countSr } from "@/lib/format/plural";
import { leadTimeLabel, stockStatusOf } from "@/lib/i18n/sr/catalog";
import { QUALITY_LABEL, QUICK_ORDER_COPY as COPY } from "@/lib/i18n/sr/mechanic";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Reveal } from "@/components/reveal/Reveal";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Disclosure, DisclosureCaret } from "@/components/ui/Disclosure";
import { Link } from "@/components/ui/Link";
import { RouteLink } from "@/components/ui/RouteLink";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Skeleton } from "@/components/ui/Skeleton";
import { StockBadge } from "@/components/ui/StockBadge";
import { toast } from "@/components/ui/Toast";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

type MatchResult = FunctionReturnType<typeof api.mechanicPortal.quickOrderMatch>;
type MatchRow = MatchResult["rows"][number];
type Option = MatchRow["options"][number];

type Row = {
  key: string;
  lineNo: number;
  code: string;
  quantity: number;
  status: "pending" | MatchRow["status"];
  options: Option[];
  selected: Id<"products"> | null;
  /** The typed quantity when it was outside 1–999; cleared once the stepper is used. */
  requestedQuantity?: number | undefined;
};

/** Rows that resolve to one product are checked and added as one line (FLOW-21). */
type Group = {
  option: Option;
  total: number;
  rows: Row[];
  inCart: number;
  ok: boolean;
  /** How many more units the cart can take (stock minus what is already in the cart). */
  canAdd: number;
};

/** A message under the input; `retry` when sending the same list again is the way out. */
type Failure = { message: string; retry?: boolean };

const DRAFT_KEY = "sk.quickorder.v1";
const MAX_FILE_BYTES = 200 * 1024;
const INPUT_ID = "qo-input";

/** What the parser accepts (shown behind „Kako se upisuje“). */
const FORMAT_EXAMPLES: [string, string][] = [
  ["1K0615301AA 2", "broj, pa količina"],
  ["5Q0 698 151 x4", "razmaci i „x“ su u redu"],
  ["2x 1K0-698-151", "količina ispred broja"],
  ["1K0615301AA;Disk;2", "red iz Excela ili CSV-a"],
];

/**
 * One row geometry for every state (pending, exact, more options, not found): line number,
 * article, price, controls. Below 36 rem of panel width the stepper and the price move under
 * the article as one line and „Ukloni“ sits in the row's top right corner (icon only).
 */
const ROW =
  "relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-x-3 gap-y-3 px-4 py-4 sm:px-5 @xl:grid-cols-[1.5rem_minmax(0,1fr)_9rem_auto] @xl:gap-x-4";

function rowsFromParse(parsed: QuickOrderParse): Row[] {
  return parsed.items.map((item) => ({
    key: item.key,
    lineNo: item.lineNo,
    code: item.candidates[0]!.code,
    quantity: item.candidates[0]!.quantity,
    status: "pending",
    options: [],
    selected: null,
  }));
}

function chosenOption(row: Row): Option | null {
  if (row.status === "exact") return row.options[0] ?? null;
  if (row.status === "ambiguous")
    return row.options.find((o) => o.card._id === row.selected) ?? null;
  return null;
}

function groupRows(rows: Row[], inCart: ReadonlyMap<string, number>): Map<string, Group> {
  const groups = new Map<string, Group>();
  for (const row of rows) {
    const option = chosenOption(row);
    if (!option) continue;
    const group = groups.get(option.card._id) ?? {
      option,
      total: 0,
      rows: [],
      inCart: inCart.get(option.card._id) ?? 0,
      ok: true,
      canAdd: 0,
    };
    group.total += row.quantity;
    group.rows.push(row);
    groups.set(option.card._id, group);
  }
  for (const group of groups.values()) {
    const check = orderable(group.option, group.inCart + group.total);
    group.ok = check.ok;
    group.canAdd = Math.max(0, check.available - group.inCart);
  }
  return groups;
}

function orderable(option: Option, quantity: number) {
  return canOrderQuantity(
    {
      stockQty: option.card.stockQty,
      allowBackorder: option.card.allowBackorder,
      ...(option.card.leadTimeDays !== null ? { leadTimeDays: option.card.leadTimeDays } : {}),
    },
    quantity,
  );
}

/** The one status chip of a row: icon + word, sentence case, optionally with a count. */
function StatusBadge({ status, count }: { status: Row["status"]; count?: number }) {
  if (status === "pending") return <Skeleton className="h-6 w-20" />;
  const tail =
    count === undefined ? null : <span className="tabular-nums font-semibold">{count}</span>;
  if (status === "exact")
    return (
      <Badge tone="success" size="text" icon={<CheckCircleIcon size={14} />}>
        {COPY.exact}
        {tail}
      </Badge>
    );
  if (status === "ambiguous")
    return (
      <Badge tone="accent" size="text" icon={<MagnifyingGlassIcon size={14} />}>
        {COPY.ambiguous}
        {tail}
      </Badge>
    );
  return (
    <Badge tone="warning" size="text" icon={<WarningCircleIcon size={14} />}>
      {COPY.notFound}
      {tail}
    </Badge>
  );
}

function OptionPrice({
  option,
  quantity,
  className,
}: {
  option: Option;
  quantity: number;
  className?: string;
}) {
  const retail = option.card.retailPricePara;
  return (
    <span
      className={cn("flex flex-col items-end whitespace-nowrap text-right", className)}
      data-reveal="off"
    >
      {retail !== null && option.unitPricePara < retail ? (
        <span className="type-caption-s text-ink-3">
          <span className="sr-only">Maloprodajna cena:</span>
          <span aria-hidden="true">MP </span>
          <s className="decoration-1">{formatRSD(retail)}</s>
        </span>
      ) : null}
      <span className="type-numeral-s tabular-nums text-accent-text">
        {formatRSD(option.unitPricePara)}
      </span>
      {quantity > 1 ? (
        <span className="type-caption-s tabular-nums text-ink-3">
          {quantity} kom. · {formatRSD(option.unitPricePara * quantity)}
        </span>
      ) : null}
    </span>
  );
}

function OptionSummary({ option }: { option: Option }) {
  return (
    <span className="flex min-w-0 flex-col gap-1">
      <RouteLink
        href={ROUTES.product(option.card.slug)}
        className="self-start rounded-xs type-body-s font-semibold text-ink-1 link-underline"
      >
        {option.card.name}
      </RouteLink>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 type-caption font-normal text-ink-3">
        <span>{option.card.manufacturerName}</span>
        <span>{QUALITY_LABEL[option.card.quality]}</span>
        <span className="type-code-s">{option.matchedCode}</span>
      </span>
      <StockBadge
        status={stockStatusOf(option.card.stockState)}
        quantity={option.card.stockQty}
        leadTime={leadTimeLabel(option.card.leadTimeDays)}
      />
    </span>
  );
}

export function QuickOrder({
  initialText = "",
  compact = false,
  aside,
}: {
  initialText?: string;
  /** Overview variant: shorter textarea, the panel carries the title. */
  compact?: boolean;
  /** Shown under the answer (the portal overview). Without it an idle panel fills the column. */
  aside?: ReactNode;
}) {
  const match = useMutation(api.mechanicPortal.quickOrderMatch);
  const addMany = useMutation(api.carts.addMany);
  const inquire = useMutation(api.mechanicPortal.inquireMissing);

  const [text, setText] = useState(initialText);
  const [parsed, setParsed] = useState<QuickOrderParse | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [checking, setChecking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [inquiring, setInquiring] = useState(false);
  const [error, setError] = useState<Failure | null>(null);
  const [sentInquiry, setSentInquiry] = useState<{ number: string; token: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const cart = useCart();
  const autoRan = useRef(false);

  // Draft survives navigation within the tab (a mechanic checks a part and comes back).
  useEffect(() => {
    if (initialText) return;
    try {
      const draft = sessionStorage.getItem(DRAFT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of browser storage after hydration
      if (draft) setText(draft);
    } catch {
      // Storage unavailable.
    }
  }, [initialText]);
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_KEY, text);
    } catch {
      // Storage unavailable.
    }
  }, [text]);

  const run = async (source: string) => {
    const result = parseQuickOrder(source);
    setParsed(result);
    setError(null);
    setSentInquiry(null);
    const pendingRows = rowsFromParse(result);
    setRows(pendingRows);
    if (pendingRows.length === 0) {
      setError({
        message: result.rejected.length
          ? "Nijedan red ne liči na broj dela. Proverite brojeve."
          : "Upišite bar jedan broj dela.",
      });
      return;
    }
    setChecking(true);
    requestAnimationFrame(() => resultsRef.current?.focus({ preventScroll: true }));
    try {
      const response = await match({
        items: result.items.map((i) => ({
          key: i.key,
          candidates: i.candidates.map((c) => ({ code: c.code, quantity: c.quantity })),
        })),
      });
      const byKey = new Map(response.rows.map((r) => [r.key, r]));
      const itemsByKey = new Map(result.items.map((i) => [i.key, i]));
      setRows(
        pendingRows.map((row) => {
          const hit = byKey.get(row.key);
          if (!hit) return { ...row, status: "not_found" };
          // The reading the server matched; it may carry a typed quantity outside 1–999.
          const reading = itemsByKey
            .get(row.key)
            ?.candidates.find(
              (c) => c.normalized === hit.normalized && c.quantity === hit.quantity,
            );
          return {
            ...row,
            code: hit.code,
            quantity: hit.quantity,
            status: hit.status,
            options: hit.options,
            selected: null,
            ...(hit.status !== "not_found" && reading?.requestedQuantity !== undefined
              ? { requestedQuantity: reading.requestedQuantity }
              : {}),
          };
        }),
      );
      // Phones: the input box sits above the results — bring the answer into view.
      if (window.matchMedia("(max-width: 1023px)").matches) {
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ block: "start" }));
      }
    } catch (err) {
      setRows([]);
      setError({
        message: convexErrorMessage(
          err,
          "Provera nije uspela. Pokušajte ponovo za nekoliko sekundi.",
        ),
        retry: true,
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (initialText && !autoRan.current) {
      autoRan.current = true;
      void run(initialText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError({ message: "Fajl je veći od 200 KB. Za veće liste pošaljite nam ga e-poštom." });
      return;
    }
    const content = decodeQuickOrderFile(await file.arrayBuffer()).slice(0, QUICK_ORDER_MAX_CHARS);
    setText(content);
    await run(content);
  };

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));
  /** „Spoji redove“: the first row takes the summed quantity, the others go. */
  const merge = (keys: string[]) =>
    setRows((prev) => {
      const [first, ...rest] = keys;
      const total = prev
        .filter((r) => keys.includes(r.key))
        .reduce((sum, r) => sum + r.quantity, 0);
      return prev
        .filter((r) => !rest.includes(r.key))
        .map((r) =>
          r.key === first ? { ...r, quantity: Math.min(QUICK_ORDER_MAX_QTY, total) } : r,
        );
    });

  const inCart = useMemo(
    () => new Map<string, number>((cart?.lines ?? []).map((l) => [l.productId, l.quantity])),
    [cart],
  );
  const groups = useMemo(() => groupRows(rows, inCart), [rows, inCart]);

  const summary = useMemo(() => {
    let lines = 0;
    let units = 0;
    let totalPara = 0;
    let retailPara = 0;
    for (const group of groups.values()) {
      if (!group.ok) continue;
      const { option, total } = group;
      lines++;
      units += total;
      totalPara += option.unitPricePara * total;
      retailPara += (option.card.retailPricePara ?? option.unitPricePara) * total;
    }
    const waiting = rows.filter((r) => r.status === "ambiguous" && !r.selected).length;
    const missing = rows.filter((r) => r.status === "not_found");
    return { lines, units, totalPara, retailPara, waiting, missing };
  }, [rows, groups]);

  const showBar = rows.length > 0 && !checking;
  useBottomInset(barRef, showBar);

  const addAll = async () => {
    // One line per product with the summed quantity: `carts.addMany` checks each line
    // against stock plus what is already in the cart, so duplicates can no longer slip past.
    const items = [...groups.values()]
      .filter((g) => g.ok)
      .map((g) => ({ productId: g.option.card._id, quantity: g.total }));
    if (items.length === 0) return;
    setAdding(true);
    try {
      const result = await addMany({ items, source: "quick_order" });
      const addedIds = new Set<string>(result.added);
      // Rejected rows stay in the list; their row message is recomputed from the fresh cart.
      const remaining = rows.filter((row) => {
        const option = chosenOption(row);
        return !(option && addedIds.has(option.card._id));
      });
      setRows(remaining);
      if (remaining.length === 0) setText("");
      if (result.rejected.length) {
        toast.warning(COPY.partlyAdded(result.added.length, result.rejected.length), {
          action: { label: "Pogledaj korpu", onClick: openCartDrawer },
        });
      } else {
        toast.success(`U korpi: ${countSr(result.added.length, ["stavka", "stavke", "stavki"])}.`, {
          action: { label: "Pogledaj korpu", onClick: openCartDrawer },
        });
      }
    } catch (err) {
      toast.error(convexErrorMessage(err, "Stavke nisu dodate. Pokušajte ponovo."));
    } finally {
      setAdding(false);
    }
  };

  const sendInquiry = async () => {
    if (summary.missing.length === 0) return;
    setInquiring(true);
    try {
      const result = await inquire({
        items: summary.missing.slice(0, 50).map((r) => ({ code: r.code, quantity: r.quantity })),
      });
      setSentInquiry(result);
      const remaining = rows.filter((r) => r.status !== "not_found");
      setRows(remaining);
      if (remaining.length === 0) setText("");
      toast.success(`Upit ${result.number} je poslat. Javljamo se telefonom.`);
    } catch (err) {
      toast.error(convexErrorMessage(err, "Upit nije poslat. Pokušajte ponovo ili nas pozovite."));
    } finally {
      setInquiring(false);
    }
  };

  const hasRows = rows.length > 0;
  const counts = {
    exact: rows.filter((r) => r.status === "exact").length,
    ambiguous: rows.filter((r) => r.status === "ambiguous").length,
    notFound: summary.missing.length,
  };

  return (
    <div className="grid gap-5 lg:grid-cols-12 lg:gap-x-(--gutter)" data-reveal="off">
      <Reveal
        as="section"
        eager
        aria-label={COPY.title}
        className="flex flex-col gap-4 self-start panel-raised p-4 sm:p-5 lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:col-span-5 xl:col-span-4"
      >
        <div className="flex min-h-11 items-center justify-between gap-3">
          <h2 className="type-h3 text-ink-1">{compact ? COPY.title : "Brojevi delova"}</h2>
          {text ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setText("");
                setRows([]);
                setParsed(null);
                setError(null);
              }}
              className="-mr-2 max-lg:h-11"
            >
              {COPY.clear}
            </Button>
          ) : null}
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(text);
          }}
        >
          <label htmlFor={INPUT_ID} className="sr-only">
            Brojevi delova i količine
          </label>
          <textarea
            ref={inputRef}
            id={INPUT_ID}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, QUICK_ORDER_MAX_CHARS))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void run(text);
              }
            }}
            rows={compact ? 5 : 8}
            spellCheck={false}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder={COPY.placeholder}
            aria-describedby="qo-help"
            data-testid={TEST_IDS.mechanicQuickOrderInput}
            className="min-h-32 w-full resize-y rounded-sm border border-control bg-surface-2 px-3 py-2.5 font-mono text-[1rem] leading-relaxed text-ink-1 transition-control placeholder:text-ink-3 hover:border-ink-3 focus:border-focus focus:shadow-[inset_0_0_0_1px_var(--color-focus)] focus:outline-none"
          />
          <p id="qo-help" className="type-caption font-normal text-ink-3">
            {COPY.help}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              icon={<MagnifyingGlassIcon size={20} />}
              loading={checking}
              className="min-w-0 grow"
              data-testid={TEST_IDS.mechanicQuickOrderCheck}
            >
              {COPY.check}
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<FileArrowUpIcon size={20} />}
              onClick={() => fileRef.current?.click()}
              className="min-w-0 grow"
            >
              {COPY.csv}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-label={COPY.csv}
              onChange={(e) => void onFile(e)}
              data-testid={TEST_IDS.mechanicQuickOrderFile}
            />
          </div>
        </form>
        {parsed && (parsed.rejected.length > 0 || parsed.truncated) ? (
          <div className="rounded-sm border border-warning/40 bg-warning-subtle p-3 type-caption font-normal text-ink-2">
            {parsed.rejected.length ? (
              <p>
                Nisu prepoznati redovi{" "}
                {parsed.rejected
                  .slice(0, 5)
                  .map((r) => `${r.lineNo} („${r.raw.slice(0, 24)}“)`)
                  .join(", ")}
                {parsed.rejected.length > 5 ? " …" : ""}.
              </p>
            ) : null}
            {parsed.truncated ? <p>Prikazano je prvih 200 stavki.</p> : null}
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="flex flex-col items-start gap-2.5">
            <p className="flex items-start gap-2 type-body-s text-danger">
              <WarningCircleIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
              {error.message}
            </p>
            {error.retry ? (
              <Button
                variant="quiet"
                size="sm"
                icon={<ArrowsClockwiseIcon size={16} />}
                onClick={() => void run(text)}
                className="max-lg:h-11"
              >
                Proverite ponovo
              </Button>
            ) : null}
          </div>
        ) : null}
        {sentInquiry ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-sm bg-success-subtle p-3 type-body-s text-ink-1"
          >
            <CheckCircleIcon
              size={18}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-success"
            />
            <span>
              Upit {sentInquiry.number} je poslat.{" "}
              <Link href={ROUTES.inquiryStatus(sentInquiry.token)} variant="inline" reloadDocument>
                Status upita
              </Link>
            </span>
          </p>
        ) : null}
        <Disclosure
          className="-mb-2 border-t border-line"
          summaryClassName="flex min-h-11 items-center justify-between gap-3 rounded-xs type-body-s font-medium text-ink-2 transition-control hover:text-ink-1"
          contentClassName="flex flex-col gap-3 pb-3"
          summary={
            <>
              Kako se upisuje
              <DisclosureCaret size={16} className="text-ink-3" />
            </>
          }
        >
          <p className="type-body-s text-ink-2">
            Nalepite brojeve iz poruke, Excela ili sa kutije — ovako ih čitamo:
          </p>
          <dl className="grid gap-x-5 gap-y-2 panel-inset p-3 sm:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-1 xl:grid-cols-[auto_minmax(0,1fr)]">
            {FORMAT_EXAMPLES.map(([code, note]) => (
              <div key={code} className="contents">
                <dt className="type-code text-ink-1">{code}</dt>
                <dd className="type-caption font-normal text-ink-3 max-sm:-mt-1.5 lg:max-xl:-mt-1.5">
                  {note}
                </dd>
              </div>
            ))}
          </dl>
          <p className="type-caption font-normal text-ink-3">{COPY.csvHelp}</p>
        </Disclosure>
      </Reveal>

      <div className="flex min-w-0 flex-col gap-5 lg:col-span-7 xl:col-span-8">
        <div
          ref={resultsRef}
          tabIndex={-1}
          role="region"
          aria-busy={checking}
          aria-label="Rezultat provere"
          hidden={!hasRows && aside !== undefined}
          className="min-w-0 scroll-mt-[calc(var(--header-h)+1rem)] outline-none"
        >
          {hasRows ? (
            <>
              <div className="@container panel">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
                  <h2 className="type-h4 text-ink-1">Rezultat provere</h2>
                  <div role="status" className="flex flex-wrap items-center gap-2">
                    {checking ? (
                      <span className="type-body-s text-ink-2">
                        Proveravam {countSr(rows.length, ["broj", "broja", "brojeva"])}…
                      </span>
                    ) : (
                      <>
                        <StatusBadge status="exact" count={counts.exact} />
                        <StatusBadge status="ambiguous" count={counts.ambiguous} />
                        <StatusBadge status="not_found" count={counts.notFound} />
                      </>
                    )}
                  </div>
                </div>
                <ol className="flex flex-col divide-y divide-line">
                  {rows.map((row) => {
                    const option = chosenOption(row);
                    const group = option ? (groups.get(option.card._id) ?? null) : null;
                    const check =
                      option && group ? orderable(option, group.inCart + group.total) : null;
                    const others =
                      group && group.rows.length > 1
                        ? group.rows.filter((r) => r.key !== row.key)
                        : [];
                    const maxQty =
                      option && !option.card.allowBackorder && !option.card.leadTimeDays
                        ? Math.max(
                            1,
                            Math.min(
                              QUICK_ORDER_MAX_QTY,
                              option.card.stockQty - (group?.inCart ?? 0),
                            ),
                          )
                        : QUICK_ORDER_MAX_QTY;
                    return (
                      <li
                        key={row.key}
                        data-testid={TEST_IDS.mechanicQuickOrderRow}
                        data-status={row.status}
                        className={ROW}
                      >
                        <span className="pt-0.5 text-right type-caption font-normal tabular-nums text-ink-3">
                          <span className="sr-only">Red </span>
                          {row.lineNo}
                        </span>
                        <div className="flex min-w-0 flex-col gap-2">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 @max-xl:pr-10">
                            <span className="type-code text-ink-1">{row.code}</span>
                            <StatusBadge status={row.status} />
                          </div>
                          {row.status === "pending" ? (
                            <span className="flex flex-col gap-2" aria-hidden="true">
                              <Skeleton className="h-4 w-64 max-w-full" />
                              <Skeleton className="h-4 w-40 max-w-full" />
                            </span>
                          ) : row.status === "exact" && option ? (
                            <OptionSummary option={option} />
                          ) : row.status === "ambiguous" ? (
                            <fieldset className="flex flex-col gap-2">
                              <legend className="mb-1.5 type-caption text-ink-2">
                                {COPY.choose}
                              </legend>
                              {row.options.map((o) => {
                                const selected = row.selected === o.card._id;
                                return (
                                  <label
                                    key={o.card._id}
                                    className={cn(
                                      "grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-sm border p-3 transition-control @md:grid-cols-[1.25rem_minmax(0,1fr)_auto]",
                                      selected
                                        ? "border-accent bg-accent-subtle"
                                        : "border-line bg-surface-2 hover:border-ink-3",
                                    )}
                                  >
                                    <input
                                      type="radio"
                                      name={`qo-${row.key}`}
                                      checked={selected}
                                      onChange={() => update(row.key, { selected: o.card._id })}
                                      className="mt-1 size-4 accent-(--color-accent)"
                                    />
                                    <OptionSummary option={o} />
                                    <OptionPrice
                                      option={o}
                                      quantity={row.quantity}
                                      className="@max-md:col-start-2 @max-md:items-start @max-md:text-left"
                                    />
                                  </label>
                                );
                              })}
                            </fieldset>
                          ) : (
                            <p className="type-body-s text-ink-2">
                              Ovaj broj nemamo u katalogu. Pošaljite ga u upitu — proverimo kod
                              dobavljača.
                            </p>
                          )}
                          {row.requestedQuantity !== undefined ? (
                            <p className="flex items-start gap-1.5 type-caption text-warning">
                              <WarningCircleIcon
                                size={16}
                                aria-hidden="true"
                                className="mt-0.5 shrink-0"
                              />
                              {COPY.quantityOutOfRange(row.requestedQuantity, row.quantity)}
                            </p>
                          ) : null}
                          {group && others.length > 0 ? (
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-2 type-caption text-ink-2">
                              {COPY.duplicate(
                                others.map((r) => r.lineNo),
                                group.total,
                              )}
                              <Button
                                variant="quiet"
                                size="sm"
                                className="max-lg:h-11"
                                onClick={() => merge(group.rows.map((r) => r.key))}
                              >
                                {COPY.merge}
                              </Button>
                            </p>
                          ) : null}
                          {group && check && !check.ok ? (
                            <p className="flex flex-wrap items-center gap-x-3 gap-y-2 type-caption text-warning">
                              <span className="flex items-start gap-1.5">
                                <WarningCircleIcon
                                  size={16}
                                  aria-hidden="true"
                                  className="mt-0.5 shrink-0"
                                />
                                {group.canAdd > 0
                                  ? COPY.canAdd(group.canAdd, group.inCart)
                                  : group.inCart > 0
                                    ? COPY.allInCart
                                    : COPY.outOfStock}
                              </span>
                              {group.canAdd > 0 && others.length === 0 ? (
                                <Button
                                  variant="quiet"
                                  size="sm"
                                  className="max-lg:h-11"
                                  onClick={() =>
                                    update(row.key, {
                                      quantity: group.canAdd,
                                      requestedQuantity: undefined,
                                    })
                                  }
                                >
                                  {COPY.reduceTo(group.canAdd)}
                                </Button>
                              ) : null}
                            </p>
                          ) : option && check?.backorder ? (
                            <p className="type-caption text-info">
                              Deo je po porudžbini
                              {option.card.leadTimeDays
                                ? `, rok ${leadTimeLabel(option.card.leadTimeDays)}`
                                : ""}
                              .
                            </p>
                          ) : null}
                        </div>
                        <div className="col-start-2 flex flex-wrap items-center justify-between gap-3 @xl:contents">
                          <div className="flex items-center gap-1.5 @xl:col-start-4 @xl:row-start-1 @xl:self-start">
                            {row.status !== "pending" ? (
                              <QuantityStepper
                                size="sm"
                                value={row.quantity}
                                max={maxQty}
                                onChange={(quantity) =>
                                  update(row.key, { quantity, requestedQuantity: undefined })
                                }
                                label={`Količina: ${row.code}`}
                              />
                            ) : (
                              <Skeleton className="h-11 w-36 lg:h-9 lg:w-28" />
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<XIcon size={16} />}
                              onClick={() => remove(row.key)}
                              className="max-lg:h-11 @max-xl:absolute @max-xl:right-1.5 @max-xl:top-1.5 @max-xl:w-11 @max-xl:px-0"
                            >
                              <span className="sr-only @xl:not-sr-only">Ukloni</span>
                              <span className="sr-only"> red {row.code}</span>
                            </Button>
                          </div>
                          <div className="ml-auto flex justify-end @xl:col-start-3 @xl:row-start-1 @xl:pt-0.5">
                            {row.status === "pending" ? (
                              <Skeleton className="h-6 w-20" />
                            ) : row.status === "exact" && option ? (
                              <OptionPrice option={option} quantity={row.quantity} />
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
              {showBar ? (
                // Sticky summary (VIS-02): registered as a bottom inset so focused rows scroll
                // clear of it; a fade above the edge shows the rows pass beneath. One button row
                // on phones (≈ 104 px), the inquiry collapses to an icon there.
                <div
                  ref={barRef}
                  className="sticky bottom-0 z-sticky -mx-page mt-3 flex flex-col gap-2 border-t border-line-strong bg-bg-raised/95 px-page pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-header before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-6 before:bg-linear-to-t before:from-bg before:to-transparent sm:mx-0 sm:gap-3 sm:bg-bg/95 sm:px-0"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="type-body-s text-ink-2" aria-live="polite">
                      {summary.lines > 0
                        ? `${countSr(summary.lines, ["stavka", "stavke", "stavki"])} · ${summary.units} kom.`
                        : "Nema stavki za korpu."}
                      {summary.waiting > 0 ? ` ${COPY.waiting(summary.waiting)}` : ""}
                    </span>
                    {summary.lines > 0 ? (
                      <span className="flex items-baseline gap-2">
                        {summary.retailPara > summary.totalPara ? (
                          <s className="type-caption text-ink-3">{formatRSD(summary.retailPara)}</s>
                        ) : null}
                        <span className="type-numeral-m tabular-nums text-accent-text">
                          {formatRSD(summary.totalPara)}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-2 sm:flex-wrap">
                    <Button
                      size="lg"
                      icon={<ShoppingCartSimpleIcon size={20} />}
                      loading={adding}
                      disabled={summary.lines === 0}
                      onClick={() => void addAll()}
                      className="min-w-0 grow sm:grow-0"
                      data-testid={TEST_IDS.mechanicQuickOrderAddAll}
                    >
                      {COPY.addAll(summary.lines)}
                    </Button>
                    {summary.missing.length > 0 ? (
                      <Button
                        size="lg"
                        variant="secondary"
                        icon={<PaperPlaneTiltIcon size={20} />}
                        loading={inquiring}
                        onClick={() => void sendInquiry()}
                        className="w-13 shrink-0 px-0 sm:w-auto sm:px-5"
                        data-testid={TEST_IDS.mechanicQuickOrderInquire}
                      >
                        <span className="sr-only sm:not-sr-only">
                          {COPY.inquire(summary.missing.length)}
                        </span>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <QuickOrderIdle onStart={() => inputRef.current?.focus()} />
          )}
        </div>
        {aside}
      </div>
    </div>
  );
}

/**
 * Before the first check: what the answer will look like — the three states a row can end in,
 * shown with their own chips — and the way to start.
 */
function QuickOrderIdle({ onStart }: { onStart: () => void }) {
  const states: [Exclude<Row["status"], "pending">, string][] = [
    ["exact", "Jedan artikal za taj broj — ide u korpu."],
    ["ambiguous", "Isti broj kod više proizvođača — birate jednog."],
    ["not_found", "Nemamo ga u katalogu — šaljete upit jednim klikom."],
  ];
  return (
    <Reveal eager index={1} className="flex flex-col items-start gap-5 panel p-5 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="type-h4 text-ink-1">Rezultat provere</h2>
        <p className="max-w-[60ch] type-body text-ink-2">
          Nalepite brojeve iz poruke, Excela ili sa kutije. Posle provere vidite šta je na stanju i
          po kojoj ceni, pa sve dodajete u korpu jednim klikom.
        </p>
      </div>
      <dl className="flex w-full flex-col divide-y divide-line border-y border-line">
        {states.map(([status, note]) => (
          <div
            key={status}
            className="grid items-center gap-x-4 gap-y-1 py-3 sm:grid-cols-[9.5rem_minmax(0,1fr)]"
          >
            <dt className="flex">
              <StatusBadge status={status} />
            </dt>
            <dd className="type-body-s text-ink-2">{note}</dd>
          </div>
        ))}
      </dl>
      <Button variant="quiet" onClick={onStart}>
        Upišite brojeve
      </Button>
    </Reveal>
  );
}
