import { CheckIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";

const STEPS = [
  {
    title: "Pošaljete upit",
    text: "Broj šasije, opis i fotografija starog dela, ako je imate.",
  },
  {
    title: "Proverimo kod dobavljača",
    text: "Tražimo deo koji odgovara vozilu, sa cenom i rokom isporuke.",
  },
  {
    title: "Stiže ponuda",
    text: "Javljamo se kanalom koji ste izabrali. Ponudu prihvatate ili odbijate na stranici upita.",
  },
] as const;

/**
 * What happens with an inquiry, in three steps (the inquiry form, the thank-you page and the
 * status page before a quote). Without `reached` it is a numbered list; with it, the steps
 * before `reached` are done, that one is current and the rest wait — the node language of the
 * order timeline (§10.6). No hooks: the form (client) and the pages (server) both render it.
 */
export function InquirySteps({
  reached,
  className,
}: {
  /** Number of completed steps (1 = the inquiry is in, we are checking). */
  reached?: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {STEPS.map((step, i) => {
        const state =
          reached === undefined
            ? "plain"
            : i < reached
              ? "done"
              : i === reached
                ? "current"
                : "future";
        return (
          <li key={step.title} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < STEPS.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute top-7 bottom-1 left-[11px] w-px bg-line-strong"
              />
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "relative inline-flex size-6 shrink-0 items-center justify-center rounded-full border type-code-s",
                state === "plain" && "border-line-strong bg-surface-2 text-ink-2",
                state === "done" && "border-success bg-success text-bg",
                state === "current" && "border-2 border-accent bg-bg text-ink-1",
                state === "future" && "border-line-strong bg-bg text-ink-3",
              )}
            >
              {state === "done" ? <CheckIcon size={12} weight="bold" /> : i + 1}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span
                className={cn(
                  "type-body-s font-semibold",
                  state === "future" ? "text-ink-2" : "text-ink-1",
                )}
                aria-current={state === "current" ? "step" : undefined}
              >
                {step.title}
                {state === "done" ? <span className="sr-only"> — završeno</span> : null}
                {state === "current" ? <span className="sr-only"> — u toku</span> : null}
              </span>
              <span className="type-body-s text-ink-2">{step.text}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
