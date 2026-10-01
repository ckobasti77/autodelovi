import type { FormEventHandler, ReactNode, Ref } from "react";

import { saveConsentForm } from "@/app/actions/consent";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";

/**
 * Cookie consent markup (SEO-ADS §J6), shared by two renderers (PERF-01):
 * - `ConsentRoot` renders it on the server for a first visit, with no handlers. It is readable
 *   at first paint and „Prihvati sve“ / „Odbij sve“ work as a plain form post to the Server
 *   Action, so nothing about it needs JavaScript and it costs no client component hydration.
 * - `ConsentBanner` (client, loaded by `ConsentGate` after hydration in idle time or on the
 *   first interaction) renders the same markup with state and handlers and replaces it.
 * No hooks here, so it renders in both worlds; every control carries `data-consent-key`
 * (`consentDom.ts`).
 */
export function ConsentPanel({
  titleId,
  descId,
  panelRef,
  collapsed = false,
  detailed = false,
  details = null,
  pending = false,
  error = null,
  onSubmit,
  onSettings,
  onWarmSettings,
}: {
  titleId: string;
  descId: string;
  panelRef?: Ref<HTMLDivElement>;
  /** Escape collapsed the panel to its title and the decision buttons (A11Y-05). */
  collapsed?: boolean;
  /** Granular view open: `details` is shown and „Sačuvaj izbor“ appears. */
  detailed?: boolean;
  details?: ReactNode;
  pending?: boolean;
  error?: string | null;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  onSettings?: () => void;
  onWarmSettings?: () => void;
}) {
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={collapsed ? undefined : descId}
      data-reveal="off"
      data-nosnippet=""
      data-collapsed={collapsed ? "" : undefined}
      data-testid="consent-banner"
      className="fixed inset-x-0 bottom-0 z-overlay px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6"
    >
      <form
        action={saveConsentForm}
        onSubmit={onSubmit}
        className="mx-auto flex max-w-[72rem] flex-col gap-4 rounded-sm border border-line-strong bg-surface-2 p-4 shadow-drawer sm:p-5 lg:flex-row lg:items-center lg:gap-8"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 id={titleId} className="type-h4 text-ink-1">
            Kolačići
          </h2>
          {collapsed ? null : (
            <p id={descId} className="max-w-[68ch] type-body-s text-ink-2">
              Neophodne kolačiće koristimo za korpu i prijavu. Uz vašu dozvolu koristimo i
              analitičke (Google Analytics) i oglasne (Google Ads, Meta) — da vidimo odakle dolazite
              i koji oglasi vrede. Izbor menjate bilo kad, u podnožju strane.
            </p>
          )}
          {detailed ? details : null}
          <div className="flex flex-wrap items-center gap-x-5 type-body-s">
            <Link
              href={ROUTES.cookies}
              variant="inline"
              className="inline-flex min-h-6 items-center"
              data-consent-key="more"
            >
              Više o kolačićima
            </Link>
            {!detailed ? (
              <button
                type="button"
                onClick={onSettings}
                onPointerEnter={onWarmSettings}
                onFocus={onWarmSettings}
                className="inline-flex min-h-6 cursor-pointer items-center text-ink-1 underline decoration-line-strong underline-offset-4 transition-control hover:decoration-ink-1"
                data-consent-key="settings"
              >
                Podešavanja
              </button>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="type-body-s text-danger">
              {error}
            </p>
          ) : null}
        </div>
        {/* Phones: the two decisions side by side (A11Y-05: a shorter banner covers less). */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-nowrap">
          {detailed ? (
            <Button
              type="submit"
              name="choice"
              value="custom"
              variant="quiet"
              disabled={pending}
              data-consent-focus
              className="col-span-2 sm:min-w-36 sm:flex-1 lg:flex-none"
              data-consent-key="save"
            >
              Sačuvaj izbor
            </Button>
          ) : null}
          <Button
            type="submit"
            name="choice"
            value="all"
            variant="quiet"
            disabled={pending}
            data-consent-focus={detailed ? undefined : true}
            className="sm:min-w-36 sm:flex-1 lg:flex-none"
            data-consent-key="all"
          >
            Prihvati sve
          </Button>
          <Button
            type="submit"
            name="choice"
            value="none"
            variant="quiet"
            disabled={pending}
            className="sm:min-w-36 sm:flex-1 lg:flex-none"
            data-consent-key="none"
          >
            Odbij sve
          </Button>
        </div>
      </form>
    </div>
  );
}
