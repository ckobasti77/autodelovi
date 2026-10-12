import { cn } from "@/lib/cn";

/** What happens after a workshop registers — a real sequence, so it is numbered. */
export const APPROVAL_STEPS = [
  "Proverimo firmu u registru i odredimo nivo rabata.",
  "Odobrenje vam javljamo e-poštom; posle prijave vidite svoju cenu na svakom artiklu.",
  "Brza porudžbina, cenovnik i istorija su u portalu „Majstor“.",
] as const;

/**
 * „Šta sledi“ after registration: the registration aside, the confirmation page and the
 * status screen of a pending account show the same three steps.
 */
export function ApprovalSteps({ className }: { className?: string }) {
  return (
    <ol className={cn("flex flex-col gap-4", className)}>
      {APPROVAL_STEPS.map((step, index) => (
        <li key={step} className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center panel-inset type-numeral-s tabular-nums text-ink-2"
          >
            {index + 1}
          </span>
          <span className="pt-1.5 type-body-s text-ink-2">{step}</span>
        </li>
      ))}
    </ol>
  );
}
