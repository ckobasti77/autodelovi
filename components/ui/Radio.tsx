"use client";

import { RadioGroup as RadioPrimitive } from "radix-ui";
import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type RadioOption = {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
};

export type RadioGroupProps = Omit<ComponentProps<typeof RadioPrimitive.Root>, "children"> & {
  /** Group label (rendered as the legend-like caption; also the accessible name). */
  label: ReactNode;
  options: RadioOption[];
  error?: ReactNode;
};

/**
 * Radio group (§9.22): 20 px circles, arrow keys move within the group (Radix roving focus),
 * each row is a 44 px label.
 */
export function RadioGroup({ label, options, error, className, ...rest }: RadioGroupProps) {
  const autoId = useId();
  const base = `rg${autoId.replace(/:/g, "")}`;
  const labelId = `${base}-label`;
  const errorId = error ? `${base}-err` : undefined;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span id={labelId} className="type-caption text-ink-2" data-reveal="off">
        {label}
      </span>
      <RadioPrimitive.Root
        aria-labelledby={labelId}
        aria-describedby={errorId}
        aria-invalid={error ? true : undefined}
        className="flex flex-col"
        {...rest}
      >
        {options.map((option) => {
          const id = `${base}-${option.value}`;
          return (
            <div key={option.value} className="flex items-start gap-3">
              <RadioPrimitive.Item
                id={id}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  "peer mt-3 inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-control transition-control",
                  "hover:border-ink-3 data-[state=checked]:border-accent-edge",
                  "disabled:cursor-not-allowed disabled:border-line",
                )}
              >
                <RadioPrimitive.Indicator className="block size-2.5 rounded-full bg-accent-edge" />
              </RadioPrimitive.Item>
              <label
                htmlFor={id}
                className="flex min-h-11 flex-1 cursor-pointer flex-col justify-center py-2 type-body-s text-ink-1 peer-disabled:cursor-not-allowed peer-disabled:text-ink-4"
              >
                <span>{option.label}</span>
                {option.description ? (
                  <span className="type-caption font-normal text-ink-3">{option.description}</span>
                ) : null}
              </label>
            </div>
          );
        })}
      </RadioPrimitive.Root>
      {error ? (
        <p id={errorId} className="type-caption text-danger" data-reveal="off">
          {error}
        </p>
      ) : null}
    </div>
  );
}
