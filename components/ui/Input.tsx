"use client";

import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";
import { useFieldControl } from "@/components/ui/Field";

/**
 * Shared frame for text-like controls (§9.2): surface-2, 1 px control border, radius 2;
 * hover → ink-3 border; focus → focus-colour border + 1 px inner ring (2 px of colour in
 * total, ≥ 3:1 in both themes); error → danger border; disabled → surface-1, line border.
 */
export const fieldFrame =
  "flex w-full items-center rounded-xs border bg-surface-2 text-ink-1 transition-control " +
  "border-control hover:border-ink-3 " +
  "focus-within:border-focus focus-within:shadow-[inset_0_0_0_1px_var(--color-focus)] focus-within:hover:border-focus " +
  "data-[invalid]:border-danger data-[invalid]:hover:border-danger " +
  "data-[disabled]:border-line data-[disabled]:bg-surface-1 data-[disabled]:text-ink-4 data-[disabled]:hover:border-line " +
  "data-[readonly]:border-transparent data-[readonly]:bg-surface-1 data-[readonly]:hover:border-transparent";

export const fieldInput =
  "h-full min-w-0 flex-1 bg-transparent text-[1rem] leading-normal text-inherit outline-none " +
  "placeholder:text-ink-3 disabled:cursor-not-allowed focus-visible:outline-none";

export type InputProps = Omit<ComponentProps<"input">, "size" | "prefix"> & {
  /** md = 44 px; lg = 52 px (hero vehicle/search on phones); xl = 56 px (hero search). */
  size?: "md" | "lg" | "xl";
  /** Leading icon (20 px, ink-3). */
  prefix?: ReactNode;
  /** Trailing unit or control („kom.“, „RSD“, a clear button). */
  suffix?: ReactNode;
  /** Classes for the frame (width, margins). */
  className?: string;
  /** Classes for the <input> itself (e.g. mono for codes). */
  inputClassName?: string;
};

const heights = { md: "h-11", lg: "h-13", xl: "h-14" } as const;

/** Text input. Inside <Field> it picks up id, aria-describedby and aria-invalid automatically. */
export function Input({
  size = "md",
  prefix,
  suffix,
  className,
  inputClassName,
  readOnly,
  ...rest
}: InputProps) {
  const { invalid, ...control } = useFieldControl(rest);
  return (
    <div
      className={cn(fieldFrame, heights[size], "gap-2 px-3", className)}
      data-invalid={invalid ? "" : undefined}
      data-disabled={control.disabled ? "" : undefined}
      data-readonly={readOnly ? "" : undefined}
    >
      {prefix ? (
        <span aria-hidden="true" className="inline-flex shrink-0 text-ink-3">
          {prefix}
        </span>
      ) : null}
      <input
        {...rest}
        {...control}
        readOnly={readOnly}
        className={cn(fieldInput, inputClassName)}
      />
      {suffix ? (
        <span className="inline-flex shrink-0 items-center type-caption text-ink-3">{suffix}</span>
      ) : null}
    </div>
  );
}
