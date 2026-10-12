"use client";

/**
 * Combobox — ARIA 1.2 editable combobox with a listbox popup (§9.3), our own implementation
 * (APG „combobox with list autocomplete“ pattern):
 *
 * - The input keeps DOM focus; the active option is referenced with aria-activedescendant.
 * - ↓ / ↑ open the list and move the active option (wrapping), Alt+↓ opens without moving,
 *   Enter selects the active option (or submits the query via `onSubmit` when none is
 *   active), Escape closes (a second Escape clears the input), Home/End move the caret
 *   (APG), Tab closes without selecting.
 * - Options: primary text, secondary text (ink-3), trailing meta (count or code in mono);
 *   optional group headers (11 px caps).
 * - States: loading („Tražim…“), empty (custom node), error; a polite live region announces
 *   the result count.
 * - Popup: level-3 elevation, max-height 360, 40 px options, positioned under the field.
 */
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { cn } from "@/lib/cn";
import { countSr } from "@/lib/format/plural";
import { Spinner } from "@/components/ui/Spinner";
import { fieldFrame, fieldInput } from "@/components/ui/Input";
import { useFieldControl } from "@/components/ui/Field";

export type ComboboxItem = {
  id: string;
  label: string;
  description?: ReactNode;
  /** Trailing meta — a count or a code (rendered as given). */
  meta?: ReactNode;
  /** Group header this item belongs to (items of a group must be adjacent). */
  group?: string;
  disabled?: boolean;
};

export type ComboboxProps = {
  items: ComboboxItem[];
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onSelect: (item: ComboboxItem) => void;
  /** Enter with no active option (e.g. „Prikaži sve rezultate“). */
  onSubmit?: (value: string) => void;
  loading?: boolean;
  error?: ReactNode;
  /** Shown when the query is non-empty and there are no items. */
  empty?: ReactNode;
  /** Row pinned at the end of the list (e.g. „Prikaži sve rezultate za …“). */
  footer?: ReactNode;
  placeholder?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  size?: "md" | "lg" | "xl";
  /** Minimum characters before the popup opens. */
  minChars?: number;
  name?: string;
  inputMode?: "text" | "search";
  enterKeyHint?: "search" | "go" | "enter";
  autoComplete?: string;
  id?: string;
  "aria-label"?: string;
  inputClassName?: string;
  /** Render the list in the flow under the field (inside dialogs) instead of as a popover. */
  inlineList?: boolean;
  className?: string;
};

export function Combobox({
  items,
  inputValue,
  onInputValueChange,
  onSelect,
  onSubmit,
  loading = false,
  error,
  empty,
  footer,
  placeholder,
  prefix,
  suffix,
  size = "md",
  minChars = 1,
  name,
  inputMode = "search",
  enterKeyHint = "search",
  autoComplete = "off",
  id: idProp,
  "aria-label": ariaLabel,
  inputClassName,
  inlineList = false,
  className,
}: ComboboxProps) {
  const autoId = useId();
  const baseId = `cbx${autoId.replace(/:/g, "")}`;
  const control = useFieldControl({ id: idProp });
  const inputId = control.id ?? `${baseId}-input`;
  const listId = `${baseId}-list`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listRef = useRef<HTMLUListElement>(null);

  const selectable = useMemo(() => items.filter((item) => !item.disabled), [items]);
  const activeItem = activeIndex >= 0 ? selectable[activeIndex] : undefined;
  const canOpen = inputValue.trim().length >= minChars;
  const showPopup =
    open &&
    canOpen &&
    (items.length > 0 || loading || Boolean(error) || Boolean(empty) || Boolean(footer));

  // Reset the active option whenever the result set changes.
  const [lastItems, setLastItems] = useState(items);
  if (lastItems !== items) {
    setLastItems(items);
    setActiveIndex(-1);
  }

  useEffect(() => {
    if (!activeItem || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLElement>(
      `[data-option-id="${CSS.escape(activeItem.id)}"]`,
    );
    node?.scrollIntoView({ block: "nearest" });
  }, [activeItem]);

  const move = (delta: number) => {
    if (selectable.length === 0) return;
    setActiveIndex((index) => {
      if (index < 0) return delta > 0 ? 0 : selectable.length - 1;
      return (index + delta + selectable.length) % selectable.length;
    });
  };

  const choose = (item: ComboboxItem) => {
    onSelect(item);
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) setOpen(true);
        if (!event.altKey) move(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) setOpen(true);
        move(-1);
        break;
      case "Enter":
        if (open && activeItem) {
          event.preventDefault();
          choose(activeItem);
        } else if (onSubmit) {
          event.preventDefault();
          setOpen(false);
          onSubmit(inputValue);
        }
        break;
      case "Escape":
        if (open && canOpen) {
          event.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        } else if (inputValue) {
          event.preventDefault();
          onInputValueChange("");
        }
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        break;
    }
  };

  // Render with group headers.
  let lastGroup: string | undefined;
  const rows: ReactNode[] = [];
  items.forEach((item) => {
    if (item.group && item.group !== lastGroup) {
      lastGroup = item.group;
      rows.push(
        <li
          key={`g-${item.group}`}
          role="presentation"
          className="px-3 pb-1 pt-3 type-label text-ink-3"
        >
          {item.group}
        </li>,
      );
    }
    const selectableIndex = selectable.indexOf(item);
    const active = activeItem?.id === item.id;
    rows.push(
      <li
        key={item.id}
        id={`${baseId}-opt-${item.id}`}
        data-option-id={item.id}
        role="option"
        aria-selected={active}
        aria-disabled={item.disabled || undefined}
        onMouseDown={(event) => event.preventDefault()}
        onMouseMove={() => {
          if (!item.disabled && selectableIndex !== activeIndex) setActiveIndex(selectableIndex);
        }}
        onClick={() => {
          if (!item.disabled) choose(item);
        }}
        className={cn(
          "flex min-h-10 cursor-pointer items-center gap-3 px-3 py-2",
          active && "bg-surface-4",
          item.disabled && "cursor-not-allowed text-ink-4",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate type-body-s text-ink-1">{item.label}</span>
          {item.description ? (
            <span className="truncate type-caption font-normal text-ink-3">{item.description}</span>
          ) : null}
        </span>
        {item.meta !== undefined ? (
          <span className="shrink-0 type-caption tabular-nums text-ink-3">{item.meta}</span>
        ) : null}
      </li>,
    );
  });

  const status = loading
    ? "Tražim…"
    : error
      ? ""
      : canOpen
        ? items.length === 0
          ? "Nema rezultata."
          : `${countSr(selectable.length, ["rezultat", "rezultata", "rezultata"])}.`
        : "";

  return (
    <div className={cn("relative", className)} data-reveal="off">
      <div
        className={cn(fieldFrame, { md: "h-11", lg: "h-13", xl: "h-14" }[size], "gap-2 px-3")}
        data-invalid={control.invalid ? "" : undefined}
      >
        {prefix ? (
          <span aria-hidden="true" className="inline-flex shrink-0 text-ink-3">
            {prefix}
          </span>
        ) : null}
        <input
          id={inputId}
          name={name}
          type="search"
          role="combobox"
          aria-label={ariaLabel}
          aria-describedby={control["aria-describedby"]}
          aria-invalid={control["aria-invalid"]}
          aria-autocomplete="list"
          aria-expanded={showPopup}
          aria-controls={listId}
          aria-activedescendant={
            showPopup && activeItem ? `${baseId}-opt-${activeItem.id}` : undefined
          }
          autoComplete={autoComplete}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode={inputMode}
          enterKeyHint={enterKeyHint}
          placeholder={placeholder}
          value={inputValue}
          onChange={(event) => {
            onInputValueChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className={cn(fieldInput, inputClassName)}
        />
        {suffix}
      </div>

      <div
        className={cn(
          inlineList
            ? "mt-2 overflow-hidden rounded-md border border-line bg-surface-2"
            : "absolute inset-x-0 top-full z-dropdown mt-1 overflow-hidden rounded-md border border-edge-overlay bg-surface-3 shadow-overlay",
          !showPopup && "hidden",
        )}
      >
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel ?? "Predlozi"}
          className="max-h-[360px] overflow-y-auto rounded-[inherit] py-1"
        >
          {rows}
        </ul>
        {loading ? (
          <div className="flex h-10 items-center gap-2 px-3 type-body-s text-ink-2">
            <Spinner size={16} />
            Tražim…
          </div>
        ) : error ? (
          <div className="px-3 py-2.5 type-body-s text-danger">{error}</div>
        ) : items.length === 0 && empty ? (
          <div className="px-3 py-2.5 type-body-s text-ink-2">{empty}</div>
        ) : null}
        {footer ? (
          <div className="border-t border-line" onMouseDown={(event) => event.preventDefault()}>
            {footer}
          </div>
        ) : null}
      </div>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {open ? status : ""}
      </span>
    </div>
  );
}
