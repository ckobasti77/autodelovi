"use client";

import { Switch as SwitchPrimitive } from "radix-ui";
import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

export type SwitchProps = Omit<ComponentProps<typeof SwitchPrimitive.Root>, "children"> & {
  label: ReactNode;
  description?: ReactNode;
};

/**
 * Switch (§9.22): 44 × 24 track; on = accent track with an on-accent knob. The knob moves
 * with the press ease (140 ms sk.snap); state is also exposed as text via the label.
 */
export function Switch({ label, description, className, id: idProp, ...rest }: SwitchProps) {
  const autoId = useId();
  const id = idProp ?? `sw${autoId.replace(/:/g, "")}`;
  const descriptionId = description ? `${id}-desc` : undefined;
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <label
        htmlFor={id}
        className="flex min-h-11 cursor-pointer flex-col justify-center type-body-s text-ink-1"
      >
        <span>{label}</span>
        {description ? (
          <span id={descriptionId} className="type-caption font-normal text-ink-3">
            {description}
          </span>
        ) : null}
      </label>
      <SwitchPrimitive.Root
        id={id}
        aria-describedby={descriptionId}
        className={cn(
          "group inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border p-0.5 transition-control",
          "border-control bg-surface-3 data-[state=checked]:border-accent-edge data-[state=checked]:bg-accent",
          "data-[state=checked]:focus-ring-inverse disabled:cursor-not-allowed disabled:border-line disabled:bg-surface-2",
        )}
        {...rest}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            "block size-4.5 rounded-full bg-ink-3 transition-transform duration-[var(--dur-quick)] ease-sk-snap",
            "data-[state=checked]:translate-x-5 data-[state=checked]:bg-on-accent group-disabled:bg-ink-4",
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  );
}
