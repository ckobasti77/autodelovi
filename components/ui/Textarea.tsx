"use client";

import { useState, type ChangeEvent, type ComponentProps } from "react";

import { cn } from "@/lib/cn";
import { useFieldControl } from "@/components/ui/Field";
import { fieldFrame } from "@/components/ui/Input";

const formatCount = (n: number) =>
  new Intl.NumberFormat("sr-Latn-RS", { useGrouping: "always" }).format(n);

export type TextareaProps = ComponentProps<"textarea"> & {
  /** Show „142 / 1.000“ under the field when maxLength is set (default true). */
  showCount?: boolean;
};

/** Textarea (§9.2): at least 4 rows, counter in ink-3 when a limit exists. */
export function Textarea({
  rows = 4,
  showCount = true,
  className,
  onChange,
  maxLength,
  ...rest
}: TextareaProps) {
  const { invalid, ...control } = useFieldControl(rest);
  const initial = String(rest.value ?? rest.defaultValue ?? "");
  const [length, setLength] = useState(initial.length);
  const current = rest.value !== undefined ? String(rest.value).length : length;
  const counterId = control.id ? `${control.id}-count` : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        className={cn(fieldFrame, "px-3 py-2.5")}
        data-invalid={invalid ? "" : undefined}
        data-disabled={control.disabled ? "" : undefined}
        data-readonly={rest.readOnly ? "" : undefined}
      >
        <textarea
          {...rest}
          {...control}
          rows={Math.max(rows, 4)}
          maxLength={maxLength}
          aria-describedby={
            [control["aria-describedby"], showCount && maxLength ? counterId : undefined]
              .filter(Boolean)
              .join(" ") || undefined
          }
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setLength(event.target.value.length);
            onChange?.(event);
          }}
          className="min-h-24 w-full resize-y bg-transparent text-[1rem] leading-normal text-inherit outline-none placeholder:text-ink-3 focus-visible:outline-none"
        />
      </div>
      {showCount && maxLength ? (
        <p
          id={counterId}
          className="self-end type-caption font-normal tabular-nums text-ink-3"
          data-reveal="off"
        >
          {formatCount(current)} / {formatCount(maxLength)}
        </p>
      ) : null}
    </div>
  );
}
