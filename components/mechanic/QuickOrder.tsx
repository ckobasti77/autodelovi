"use client";

/**
 * Quick order (§10.9, ARCHITECTURE §A4): paste „OEM količina“ lines or upload a small CSV →
 * parse locally (rows appear at once) → `mechanicPortal.quickOrderMatch` → exact / more
 * options / not found → „Dodaj sve u korpu“ (one `carts.addMany`) and „Pošalji upit za
 * nepronađene“ (one `mechanicPortal.inquireMissing`, contact from the profile).
 *
 * Prices and stock are the server's snapshot for this mechanic; the cart re-prices on read
 * and the order re-prices on submit.
 */
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
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
import { cn } from "@/lib/cn";
import {
  decodeQuickOrderFile,
  parseQuickOrder,
  QUICK_ORDER_MAX_CHARS,
  type QuickOrderParse,
} from "@/lib/domain/quickOrder";
import { canOrderQuantity } from "@/lib/domain/stock";
import { formatRSD } from "@/lib/format/money";
import { countSr } from "@/lib/format/plural";
import { leadTimeLabel, stockStatusOf } from "@/lib/i18n/sr/catalog";
import { QUALITY_LABEL, QUICK_ORDER_COPY as COPY } from "@/lib/i18n/sr/mechanic";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
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
};

const DRAFT_KEY = "sk.quickorder.v1";
const MAX_FILE_BYTES = 200 * 1024;

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
  if (row.status === "ambiguous") return row.options.find((o) => o.card._id === row.selected) ?? null;
  return null;
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

function StatusBadge({ status }: { status: Row["status"] }) {
  if (status === "pending") return <Skeleton className="h-6 w-20" />;
  if (status === "exact")
    return (
      <Badge tone="success" icon={<CheckCircleIcon size={14} />}>
        {COPY.exact}
      </Badge>
    );
  if (status === "ambiguous")
    return (
      <Badge tone="accent" icon={<MagnifyingGlassIcon size={14} />}>
        {COPY.ambiguous}
      </Badge>
    );
  return (
    <Badge tone="warning" icon={<WarningCircleIcon size={14} />}>
      {COPY.notFound}
    </Badge>
  );
}

function OptionPrice({ option, quantity }: { option: Option; quantity: number }) {
  const retail = option.card.retailPricePara;
  return (
    <span className="flex flex-col items-end text-right" data-reveal="off">
      {retail !== null && option.unitPricePara < retail ? (
        <span className="type-caption-s text-ink-3">
          <span className="sr-only">Maloprodajna cena:</span>
          <span aria-hidden="true">MP </span>
          <s className="decoration-1">{formatRSD(retail)}</s>
        </span>
      ) : null}
      <span className="type-numeral-s tabular-nums text-accent-text">{formatRSD(option.unitPricePara)}</span>
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
        className="self-start type-body-s font-semibold text-ink-1 underline decoration-line-strong underline-offset-4 transition-control hover:decoration-accent"
      >
        {option.card.name}
      </RouteLink>
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 type-caption text-ink-3">
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
}: {
  initialText?: string;
  /** Overview variant: shorter textarea. */
  compact?: boolean;
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
  const [error, setError] = useState<string | null>(null);
  const [sentInquiry, setSentInquiry] = useState<{ number: string; token: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
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
      setError(
        result.rejected.length
          ? "Nijedan red ne liči na broj dela. Proverite brojeve."
          : "Upišite bar jedan broj dela.",
      );
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
      setRows(
        pendingRows.map((row) => {
          const hit = byKey.get(row.key);
          if (!hit) return { ...row, status: "not_found" };
          return {
            ...row,
            code: hit.code,
            quantity: hit.quantity,
            status: hit.status,
            options: hit.options,
            selected: null,
          };
        }),
      );
      // Phones: the input box sits above the results — bring the answer into view.
      if (window.matchMedia("(max-width: 1023px)").matches) {
        requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ block: "start" }));
      }
    } catch (err) {
      setRows([]);
      setError(convexErrorMessage(err, "Provera nije uspela. Pokušajte ponovo za nekoliko sekundi."));
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
      setError("Fajl je veći od 200 KB. Za veće liste pošaljite nam ga e-poštom.");
      return;
    }
    const content = decodeQuickOrderFile(await file.arrayBuffer()).slice(0, QUICK_ORDER_MAX_CHARS);
    setText(content);
    await run(content);
  };

  const update = (key: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  const summary = useMemo(() => {
    let lines = 0;
    let units = 0;
    let totalPara = 0;
    let retailPara = 0;
    const blocked: Row[] = [];
    for (const row of rows) {
      const option = chosenOption(row);
      if (!option) continue;
      if (!orderable(option, row.quantity).ok) {
        blocked.push(row);
        continue;
      }
      lines++;
      units += row.quantity;
      totalPara += option.unitPricePara * row.quantity;
      retailPara += (option.card.retailPricePara ?? option.unitPricePara) * row.quantity;
    }
    const waiting = rows.filter((r) => r.status === "ambiguous" && !r.selected).length;
    const missing = rows.filter((r) => r.status === "not_found");
    return { lines, units, totalPara, retailPara, waiting, missing, blocked };
  }, [rows]);

  const addAll = async () => {
    const items = rows
      .map((row) => ({ row, option: chosenOption(row) }))
      .filter((x): x is { row: Row; option: Option } => x.option !== null && orderable(x.option, x.row.quantity).ok)
      .map((x) => ({ productId: x.option.card._id, quantity: x.row.quantity }));
    if (items.length === 0) return;
    setAdding(true);
    try {
      const result = await addMany({ items, source: "quick_order" });
      const addedIds = new Set(result.added);
      const remaining = rows.filter((row) => {
        const option = chosenOption(row);
        return !(option && addedIds.has(option.card._id));
      });
      setRows(remaining);
      if (remaining.length === 0) setText("");
      if (result.rejected.length) {
        toast.warning(
          `Dodato: ${result.added.length}. Nije dodato: ${result.rejected.length} — ${result.rejected[0]!.reason}`,
          { action: { label: "Pogledaj korpu", onClick: openCartDrawer } },
        );
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
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-x-(--gutter)" data-reveal="off">
      <section
        aria-labelledby="qo-title"
        className="flex flex-col gap-3 self-start rounded-sm border border-line-strong bg-surface-1 p-4 sm:p-5 lg:sticky lg:top-[calc(var(--header-h)+1rem)] lg:col-span-5 xl:col-span-4"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="qo-title" className="type-h3 text-ink-1">
            {COPY.title}
          </h2>
          {text ? (
            <button
              type="button"
              onClick={() => {
                setText("");
                setRows([]);
                setParsed(null);
                setError(null);
              }}
              className="inline-flex min-h-11 cursor-pointer items-center type-body-s text-ink-3 underline decoration-line-strong underline-offset-4 hover:text-ink-1"
            >
              {COPY.clear}
            </button>
          ) : null}
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run(text);
          }}
        >
          <label htmlFor="qo-input" className="sr-only">
            Brojevi delova i količine
          </label>
          <textarea
            id="qo-input"
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
            className="min-h-32 w-full resize-y rounded-xs border border-control bg-surface-2 px-3 py-2.5 font-mono text-[0.9375rem] leading-relaxed text-ink-1 transition-control placeholder:text-ink-3 hover:border-ink-3 focus:border-focus focus:shadow-[inset_0_0_0_1px_var(--color-focus)] focus:outline-none"
          />
          <p id="qo-help" className="type-caption text-ink-3">
            {COPY.help}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              icon={<MagnifyingGlassIcon size={20} />}
              loading={checking}
              className="grow sm:grow-0"
              data-testid={TEST_IDS.mechanicQuickOrderCheck}
            >
              {COPY.check}
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<FileArrowUpIcon size={20} />}
              onClick={() => fileRef.current?.click()}
              className="grow sm:grow-0"
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
          <p className="type-caption-s text-ink-3">{COPY.csvHelp}</p>
        </form>
        {parsed && (parsed.rejected.length > 0 || parsed.truncated) ? (
          <div className="rounded-xs border border-warning/40 bg-warning-subtle p-3 type-caption text-ink-2">
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
          <p role="alert" className="flex items-start gap-2 type-body-s text-danger">
            <WarningCircleIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}
        {sentInquiry ? (
          <p role="status" className="flex items-start gap-2 rounded-xs bg-success-subtle p-3 type-body-s text-ink-1">
            <CheckCircleIcon size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
            <span>
              Upit {sentInquiry.number} je poslat.{" "}
              <Link href={ROUTES.inquiryStatus(sentInquiry.token)} variant="inline" reloadDocument>
                Status upita
              </Link>
            </span>
          </p>
        ) : null}
      </section>

      <div
        ref={resultsRef}
        tabIndex={-1}
        aria-busy={checking}
        aria-label="Rezultat provere"
        className="flex min-w-0 scroll-mt-[calc(var(--header-h)+1rem)] flex-col outline-none lg:col-span-7 xl:col-span-8"
      >
        {hasRows ? (
          <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line pb-3" role="status">
              {checking ? (
                <span className="type-body-s text-ink-2">Proveravam {countSr(rows.length, ["broj", "broja", "brojeva"])}…</span>
              ) : (
                <>
                  <span className="type-body-s text-ink-2">
                    <strong className="font-semibold text-ink-1">{counts.exact}</strong> {COPY.exact.toLowerCase()}
                  </span>
                  <span className="type-body-s text-ink-2">
                    <strong className="font-semibold text-ink-1">{counts.ambiguous}</strong> {COPY.ambiguous.toLowerCase()}
                  </span>
                  <span className="type-body-s text-ink-2">
                    <strong className="font-semibold text-ink-1">{counts.notFound}</strong> {COPY.notFound.toLowerCase()}
                  </span>
                </>
              )}
            </div>
            <ol className="flex flex-col divide-y divide-line">
              {rows.map((row) => {
                const option = chosenOption(row);
                const check = option ? orderable(option, row.quantity) : null;
                const maxQty = option && !option.card.allowBackorder && !option.card.leadTimeDays
                  ? Math.max(1, Math.min(999, option.card.stockQty))
                  : 999;
                return (
                  <li
                    key={row.key}
                    data-testid={TEST_IDS.mechanicQuickOrderRow}
                    data-status={row.status}
                    className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="flex min-w-0 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="type-code text-ink-1">{row.code}</span>
                        <StatusBadge status={row.status} />
                        <span className="type-caption-s text-ink-3">red {row.lineNo}</span>
                      </div>
                      {row.status === "pending" ? (
                        <Skeleton className="h-10 w-full max-w-md" />
                      ) : row.status === "exact" && option ? (
                        <OptionSummary option={option} />
                      ) : row.status === "ambiguous" ? (
                        <fieldset className="flex flex-col gap-2">
                          <legend className="mb-1 type-caption text-ink-2">{COPY.choose}</legend>
                          {row.options.map((o) => {
                            const selected = row.selected === o.card._id;
                            return (
                              <label
                                key={o.card._id}
                                className={cn(
                                  "grid cursor-pointer grid-cols-[1.25rem_minmax(0,1fr)_auto] items-start gap-3 rounded-xs border p-3 transition-control",
                                  selected ? "border-accent bg-accent-subtle" : "border-line-strong hover:border-ink-3",
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
                                <OptionPrice option={o} quantity={row.quantity} />
                              </label>
                            );
                          })}
                        </fieldset>
                      ) : (
                        <p className="type-body-s text-ink-2">
                          Ovaj broj nemamo u katalogu. Pošaljite ga u upitu — proverimo kod dobavljača.
                        </p>
                      )}
                      {option && check && !check.ok ? (
                        <p className="flex items-center gap-1.5 type-caption text-warning">
                          <WarningCircleIcon size={16} aria-hidden="true" />
                          {check.available > 0
                            ? `Na stanju je još ${check.available} kom.`
                            : "Trenutno nije na stanju — nije dodato u korpu."}
                          {check.available > 0 ? (
                            <button
                              type="button"
                              className="ml-1 inline-flex min-h-11 cursor-pointer items-center text-ink-1 underline decoration-line-strong underline-offset-4"
                              onClick={() => update(row.key, { quantity: check.available })}
                            >
                              Smanji na {check.available}
                            </button>
                          ) : null}
                        </p>
                      ) : option && check?.backorder ? (
                        <p className="type-caption text-info">
                          Deo je po porudžbini{option.card.leadTimeDays ? `, rok ${leadTimeLabel(option.card.leadTimeDays)}` : ""}.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-row-reverse items-start justify-between gap-3 sm:flex-col sm:items-end sm:justify-start">
                      <div className="flex items-center gap-1">
                        {row.status !== "pending" ? (
                          <QuantityStepper
                            size="sm"
                            value={row.quantity}
                            max={maxQty}
                            onChange={(quantity) => update(row.key, { quantity })}
                            label={`Količina: ${row.code}`}
                          />
                        ) : null}
                        <IconButton
                          label={`Ukloni red ${row.code}`}
                          icon={<XIcon size={18} />}
                          variant="ghost"
                          onClick={() => remove(row.key)}
                        />
                      </div>
                      {row.status === "exact" && option ? <OptionPrice option={option} quantity={row.quantity} /> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
            {!checking ? (
              <div className="sticky bottom-0 z-sticky -mx-page mt-2 flex flex-col gap-3 border-t border-line-strong bg-bg-raised/95 px-page pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-header sm:mx-0 sm:px-0 sm:bg-bg/95">
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
                      <span className="type-numeral-m tabular-nums text-accent-text">{formatRSD(summary.totalPara)}</span>
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    icon={<ShoppingCartSimpleIcon size={20} />}
                    loading={adding}
                    disabled={summary.lines === 0}
                    onClick={() => void addAll()}
                    className="grow sm:grow-0"
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
                      className="grow sm:grow-0"
                      data-testid={TEST_IDS.mechanicQuickOrderInquire}
                    >
                      {COPY.inquire(summary.missing.length)}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <QuickOrderEmpty />
        )}
      </div>
    </div>
  );
}

/** Before the first check: what the parser accepts, as a small reference plate. */
function QuickOrderEmpty() {
  const examples: [string, string][] = [
    ["1K0615301AA 2", "broj, pa količina"],
    ["5Q0 698 151 x4", "razmaci i „x“ su u redu"],
    ["2x 1K0-698-151", "količina ispred broja"],
    ["1K0615301AA;Disk;2", "red iz Excela ili CSV-a"],
  ];
  return (
    <div className="flex flex-col gap-4 rounded-sm border border-dashed border-line-strong p-5 sm:p-6">
      <p className="type-body text-ink-2">
        Nalepite brojeve iz poruke, Excela ili sa kutije. Posle provere vidite šta je na stanju i po kojoj ceni, pa sve
        dodajete u korpu jednim klikom.
      </p>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)]">
        {examples.map(([code, note]) => (
          <div key={code} className="contents">
            <dt className="type-code text-ink-1">{code}</dt>
            <dd className="type-body-s text-ink-3">{note}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
