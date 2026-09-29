"use client";

import type { ComponentProps } from "react";
import { CaretDownIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { useFieldControl } from "@/components/ui/Field";
import { fieldFrame } from "@/components/ui/Input";

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = Omit<ComponentProps<"select">, "size"> & {
  options: SelectOption[];
  /** Optional first option with an empty value („Izaberite…“). */
  placeholder?: string;
  size?: "md" | "sm";
};

/**
 * Native select, themed (§9.3) — for short fixed lists (sort order, page size, delivery
 * method). Searchable lists use Combobox.
 */
export function Select({ options, placeholder, size = "md", className, ...rest }: SelectProps) {
  const { invalid, ...control } = useFieldControl(rest);
  return (
    <div
      className={cn(fieldFrame, "relative", size === "md" ? "h-11" : "h-9", className)}
      data-invalid={invalid ? "" : undefined}
      data-disabled={control.disabled ? "" : undefined}
    >
      <select
        {...rest}
        {...control}
        className={cn(
          "h-full w-full cursor-pointer appearance-none bg-transparent pl-3 pr-9 text-ink-1 outline-none focus-visible:outline-none disabled:cursor-not-allowed",
          size === "md" ? "text-[1rem]" : "type-body-s",
        )}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <CaretDownIcon
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-2"
      />
    </div>
  );
}
