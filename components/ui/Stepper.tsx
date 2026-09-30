import { RouteLink as NextLink } from "@/components/ui/RouteLink";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

export type Step = { id: string; label: string };

export type StepperProps = {
  steps: Step[];
  /** Zero-based index of the current step. */
  current: number;
  /** Link to revisit a completed step („Izmeni“); omit to render completed steps as text. */
  hrefFor?: (step: Step, index: number) => string;
  /** Client-state flows: completed steps get an „Izmeni“ button instead of a link. */
  onSelect?: (index: number) => void;
  className?: string;
};

/**
 * Checkout stepper (§9.12). Desktop: numbered list, completed steps show a check and an
 * „Izmeni“ link, the current step has a 2 px accent underline and aria-current="step".
 * Phones: „Korak 2 od 4 · Dostava“ + a 4-segment bar.
 */
export function Stepper({ steps, current, hrefFor, onSelect, className }: StepperProps) {
  const active = steps[current];
  return (
    <nav aria-label="Koraci porudžbine" className={className} data-reveal="off">
      <div className="flex flex-col gap-2 md:hidden">
        <p className="type-body-s text-ink-2">
          Korak {current + 1} od {steps.length}
          {active ? <span className="text-ink-1"> · {active.label}</span> : null}
        </p>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
          aria-hidden="true"
        >
          {steps.map((step, index) => (
            <span
              key={step.id}
              className={cn("h-1 rounded-xs", index <= current ? "bg-accent" : "bg-line-strong")}
            />
          ))}
        </div>
      </div>

      <ol className="hidden items-stretch gap-8 border-b border-line md:flex">
        {steps.map((step, index) => {
          const done = index < current;
          const isCurrent = index === current;
          const href = done && hrefFor ? hrefFor(step, index) : undefined;
          return (
            <li
              key={step.id}
              aria-current={isCurrent ? "step" : undefined}
              className={cn(
                "-mb-px flex h-12 items-center gap-2.5 border-b-2",
                isCurrent ? "border-accent text-ink-1" : "border-transparent",
                done ? "text-ink-2" : !isCurrent && "text-ink-3",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-xs type-numeral-s",
                  isCurrent ? "text-accent-text" : done ? "text-success" : "text-ink-3",
                )}
              >
                {done ? <CheckIcon size={16} weight="bold" /> : index + 1}
              </span>
              <span className="type-body-s font-semibold">
                <span className="sr-only">
                  Korak {index + 1}
                  {done ? ", završen" : ""}:{" "}
                </span>
                {step.label}
              </span>
              {href ? (
                <NextLink
                  href={href}
                  className="type-caption font-normal text-ink-2 underline decoration-line-strong underline-offset-4 transition-control hover:text-ink-1 hover:decoration-accent"
                >
                  Izmeni<span className="sr-only">: {step.label}</span>
                </NextLink>
              ) : done && onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  className="cursor-pointer type-caption font-normal text-ink-2 underline decoration-line-strong underline-offset-4 transition-control hover:text-ink-1 hover:decoration-accent"
                >
                  Izmeni<span className="sr-only">: {step.label}</span>
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
