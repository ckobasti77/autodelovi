"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { MinusIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

export type QuantityStepperProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  /** From stock, or 99 for „po porudžbini“. */
  max?: number;
  /** Accessible name, e.g. „Količina: Kočioni disk prednji“. */
  label: string;
  size?: "md" | "sm";
  className?: string;
};

/**
 * Quantity stepper (§9.2): [−] [ 2 ] [+], 44 px buttons, value changes instantly; ↑/↓ on the
 * input; long-press repeats every 120 ms after 400 ms.
 *
 * `sm` is a density for desktop tables only: 36 px from `lg` with a fine pointer, and the
 * system's 44 px touch minimum everywhere else — phones, tablets, touch laptops (VIS-10, D247).
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  label,
  size = "md",
  className,
}: QuantityStepperProps) {
  const repeat = useRef<{ delay?: number; interval?: number }>({});
  const latest = useRef(value);
  useEffect(() => {
    latest.current = value;
  }, [value]);

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const stop = () => {
    window.clearTimeout(repeat.current.delay);
    window.clearInterval(repeat.current.interval);
    repeat.current = {};
  };
  useEffect(() => stop, []);

  const step = (delta: number) => {
    const next = clamp(latest.current + delta);
    if (next !== latest.current) {
      latest.current = next;
      onChange(next);
    }
  };

  const startRepeat = (delta: number) => {
    step(delta);
    stop();
    repeat.current.delay = window.setTimeout(() => {
      repeat.current.interval = window.setInterval(() => step(delta), 120);
    }, 400);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      step(-1);
    }
  };

  const h = size === "md" ? "h-11" : "h-11 lg:pointer-fine:h-9";
  const buttonClasses = cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center text-ink-1 transition-control hover:bg-surface-3 disabled:cursor-not-allowed disabled:text-ink-4 disabled:hover:bg-transparent",
    size === "md" ? "size-11" : "size-11 lg:pointer-fine:size-9",
  );

  return (
    <div
      role="group"
      aria-label={label}
      data-reveal="off"
      className={cn(
        "inline-flex items-stretch rounded-xs border border-control bg-surface-2",
        h,
        className,
      )}
    >
      <button
        type="button"
        aria-label="Smanji količinu"
        disabled={value <= min}
        onPointerDown={(event) => {
          if (event.button === 0) startRepeat(-1);
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onClick={(event) => {
          // Keyboard and assistive-technology activation (pointer presses are handled above).
          if (event.detail === 0) step(-1);
        }}
        className={buttonClasses}
      >
        <MinusIcon size={18} aria-hidden="true" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={value}
        aria-label="Količina"
        onKeyDown={onKeyDown}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(parsed)) onChange(clamp(parsed));
        }}
        className="w-14 border-x border-control bg-transparent text-center text-[1rem] tabular-nums text-ink-1 outline-none [appearance:textfield] focus-visible:shadow-[inset_0_0_0_2px_var(--color-focus)] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label="Povećaj količinu"
        disabled={value >= max}
        onPointerDown={(event) => {
          if (event.button === 0) startRepeat(1);
        }}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
        onClick={(event) => {
          // Keyboard and assistive-technology activation (pointer presses are handled above).
          if (event.detail === 0) step(1);
        }}
        className={buttonClasses}
      >
        <PlusIcon size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
