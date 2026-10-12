"use client";

import { cn } from "@/lib/cn";
import { CheckboxBox } from "@/components/ui/Checkbox";

/**
 * A choice in a multi-select group (service types, makes): a filled 44 px chip that holds its
 * checkbox — the whole chip is the target. Unselected chips are a quiet surface, not an
 * outline (a group of them would be a wall of boxes); the chosen one takes the accent tint.
 */
export function ChoiceChip({
  on,
  onChange,
  onBlur,
  testId,
  children,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  onBlur?: () => void;
  testId?: string;
  children: string;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-sm border px-3 type-body-s transition-control",
        on
          ? "border-accent bg-accent-subtle text-ink-1"
          : "border-line bg-surface-2 text-ink-2 hover:border-line-strong hover:text-ink-1",
      )}
    >
      <CheckboxBox
        aria-label={children}
        checked={on}
        onCheckedChange={(checked) => onChange(checked === true)}
        {...(onBlur ? { onBlur } : {})}
        {...(testId ? { "data-testid": testId } : {})}
      />
      {children}
    </label>
  );
}
