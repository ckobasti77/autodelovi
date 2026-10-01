"use client";

import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { useId, type ComponentProps, type ReactNode } from "react";
import { CheckIcon, MinusIcon, WarningCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

export type CheckboxProps = Omit<ComponentProps<typeof CheckboxPrimitive.Root>, "children"> & {
  label: ReactNode;
  /** Secondary text after the label (e.g. a count in the filters). */
  meta?: ReactNode;
  description?: ReactNode;
  /** Error message under the row — linked via aria-describedby, sets aria-invalid (like Field). */
  error?: ReactNode;
  /** Announced as required (aria-required); the box never triggers native validation. */
  required?: boolean;
};

/**
 * Checkbox (§9.22): 20 px box, the whole row is the 44 px hit area via the label.
 * Checked/indeterminate: accent fill with an on-accent glyph.
 */
export function Checkbox({
  label,
  meta,
  description,
  error,
  required,
  className,
  id: idProp,
  disabled,
  "aria-describedby": describedByProp,
  "aria-invalid": invalidProp,
  ...rest
}: CheckboxProps) {
  const autoId = useId();
  const id = idProp ?? `cb${autoId.replace(/:/g, "")}`;
  const descriptionId = description ? `${id}-desc` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy =
    [describedByProp, descriptionId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    // One structure with or without an error, so the box never remounts (and keeps focus)
    // when the message appears or goes away.
    <div className={cn("flex flex-col", className)} data-invalid={error ? "" : undefined}>
      <div className="flex items-start gap-3">
        <CheckboxPrimitive.Root
          id={id}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={error ? true : invalidProp}
          aria-required={required || undefined}
          className={cn(
            "peer mt-3 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-xs border border-control bg-transparent text-on-accent transition-control",
            "hover:border-ink-3 data-[state=checked]:border-accent-edge data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent-edge data-[state=indeterminate]:bg-accent",
            "focus-ring-inverse data-[state=unchecked]:focus-visible:outline-focus aria-invalid:data-[state=unchecked]:border-danger",
            "disabled:cursor-not-allowed disabled:border-line disabled:data-[state=checked]:bg-surface-3 disabled:data-[state=checked]:border-line disabled:text-ink-4",
          )}
          {...rest}
        >
          <CheckboxPrimitive.Indicator className="inline-flex">
            {rest.checked === "indeterminate" ? (
              <MinusIcon size={14} weight="bold" aria-hidden="true" />
            ) : (
              <CheckIcon size={14} weight="bold" aria-hidden="true" />
            )}
          </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
        <label
          htmlFor={id}
          className={cn(
            "flex min-h-11 flex-1 cursor-pointer flex-col justify-center py-2 type-body-s text-ink-1 peer-disabled:cursor-not-allowed peer-disabled:text-ink-4",
          )}
        >
          <span className="flex items-baseline justify-between gap-3">
            <span>{label}</span>
            {meta !== undefined ? <span className="tabular-nums text-ink-3">{meta}</span> : null}
          </span>
          {description ? (
            <span id={descriptionId} className="type-caption font-normal text-ink-3">
              {description}
            </span>
          ) : null}
        </label>
      </div>
      {error ? (
        <p
          id={errorId}
          className="flex items-start gap-1.5 pl-8 type-caption text-danger"
          data-reveal="off"
        >
          <WarningCircleIcon size={16} aria-hidden="true" className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export type CheckboxBoxProps = Omit<ComponentProps<typeof CheckboxPrimitive.Root>, "children"> & {
  /** Accessible name (no visible label, e.g. table row selection). */
  "aria-label": string;
};

/** Bare 20 px checkbox for dense places (table selection). Keep a ≥ 24 px target around it. */
export function CheckboxBox({ className, ...rest }: CheckboxBoxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-xs border border-control bg-transparent text-on-accent transition-control",
        "hover:border-ink-3 data-[state=checked]:border-accent-edge data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent-edge data-[state=indeterminate]:bg-accent",
        "focus-ring-inverse data-[state=unchecked]:focus-visible:outline-focus disabled:cursor-not-allowed disabled:border-line",
        className,
      )}
      {...rest}
    >
      <CheckboxPrimitive.Indicator className="inline-flex">
        {rest.checked === "indeterminate" ? (
          <MinusIcon size={14} weight="bold" aria-hidden="true" />
        ) : (
          <CheckIcon size={14} weight="bold" aria-hidden="true" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}
