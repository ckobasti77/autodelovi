import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  CarIcon,
  ChatCircleTextIcon,
  ReceiptIcon,
} from "@phosphor-icons/react/dist/ssr";

import { Reveal } from "@/components/reveal/Reveal";
import { RevealText } from "@/components/text-reveal/RevealText";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";

const BENEFITS = [
  {
    Icon: ReceiptIcon,
    title: "Porudžbine",
    body: "Dokle je stigla svaka porudžbina i „Poruči ponovo“ za iste delove.",
  },
  {
    Icon: CarIcon,
    title: "Vozila",
    body: "Vozilo sačuvate jednom; katalog posle prikazuje delove koji mu odgovaraju.",
  },
  {
    Icon: ChatCircleTextIcon,
    title: "Upiti",
    body: "Svi upiti po broju šasije i njihov status.",
  },
] as const;

/** What the account holds — the default companion of an auth form. */
export function AccountBenefits() {
  return (
    <div className="flex flex-col gap-6">
      <ul className="flex flex-col gap-4">
        {BENEFITS.map(({ Icon, title, body }) => (
          <li key={title} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-4">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center panel-inset text-ink-2"
            >
              <Icon size={20} />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="type-body-s font-semibold text-ink-1">{title}</span>
              <span className="type-body-s text-ink-2">{body}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-line pt-5 type-body-s text-ink-2">
        Vodite servis? Rabat i brza porudžbina idu uz majstorski nalog.{" "}
        <Link
          href={ROUTES.mechanics}
          variant="standalone"
          icon={<ArrowRightIcon size={14} />}
          className="type-body-s"
        >
          Za majstore
        </Link>
      </p>
    </div>
  );
}

/** A real sequence as a short numbered list (password reset). */
export function AuthSteps({ steps }: { steps: readonly string[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {steps.map((step, index) => (
        <li key={step} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-4">
          <span
            aria-hidden="true"
            className="flex size-10 items-center justify-center panel-inset type-numeral-s tabular-nums text-ink-2"
          >
            {index + 1}
          </span>
          <span className="type-body-s text-ink-2">{step}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Shared frame of the auth pages. A split, not one box in a void: the statement and what the
 * account is for on the left (columns 1–5), the form in a 12 px panel on the right (7–11) with
 * the secondary path as links under a rule. Phones read in task order — title, form, the rest.
 * The panel is an eager block (usable from the first frame); its copy arrives with it.
 */
export function AuthFrame({
  title,
  lead,
  children,
  footer,
  aside,
  asideLabel = "Šta dobijate uz nalog",
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  /** Secondary paths (other auth pages), as links. */
  footer?: ReactNode;
  /** Replaces the account benefits beside the form. */
  aside?: ReactNode;
  /** Accessible name of that companion block. */
  asideLabel?: string;
}) {
  return (
    <section className="px-page pb-(--space-section) pt-10 lg:pt-16" aria-labelledby="auth-title">
      <div className="mx-auto grid max-w-[30rem] gap-x-(--gutter) gap-y-8 lg:mx-0 lg:max-w-none lg:grid-cols-12 lg:grid-rows-[auto_1fr]">
        <div className="flex flex-col gap-3 lg:col-span-5">
          <RevealText as="h1" id="auth-title" className="type-h1 text-ink-1">
            {title}
          </RevealText>
          {lead ? (
            <RevealText as="p" className="max-w-[44ch] type-body text-ink-2">
              {lead}
            </RevealText>
          ) : null}
        </div>
        <Reveal
          eager
          className="flex flex-col gap-6 panel rounded-xl p-5 sm:p-8 lg:col-span-5 lg:col-start-7 lg:row-span-2 lg:row-start-1 lg:self-start"
        >
          {children}
          {footer ? (
            <div className="flex flex-col gap-2 border-t border-line pt-5 type-body-s text-ink-2">
              {footer}
            </div>
          ) : null}
        </Reveal>
        <Reveal
          as="aside"
          eager
          index={1}
          aria-label={asideLabel}
          className="lg:col-span-5 lg:col-start-1 lg:row-start-2"
        >
          {aside ?? <AccountBenefits />}
        </Reveal>
      </div>
    </section>
  );
}
