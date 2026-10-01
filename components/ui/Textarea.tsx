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
  ref,
  ...rest
}: TextareaProps) {
  const { invalid, ...control } = useFieldControl(rest);
  const controlled = rest.value !== undefined;
  const [length, setLength] = useState(() => String(rest.defaultValue ?? "").length);
  const current = controlled ? String(rest.value).length : length;
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
          ref={(el: HTMLTextAreaElement | null) => {
            if (typeof ref === "function") ref(el);
            else if (ref) ref.current = el;
            // An uncontrolled value can change without an input event: react-hook-form's
            // register() ref writes the default, setValue / reset write later (the XB-01 restore
            // too). This callback is new on every render, so React re-attaches it after every
            // commit and the counter re-reads the element — it never contradicts the field.
            if (el && !controlled) setLength(el.value.length);
          }}
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
