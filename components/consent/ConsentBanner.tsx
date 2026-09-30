"use client";

/**
 * Cookie consent (SEO-ADS §J6): a non-modal bottom sheet (`role="dialog"`, no focus trap, no
 * scrim) that is in the server HTML on the first visit — no layout shift, readable at first
 * paint, and „Prihvati sve“ / „Odbij sve“ work without JavaScript (form post to the Server
 * Action). Granular view: Neophodni (always on), Analitika, Oglašavanje. Reopened from the
 * footer („Podešavanja kolačića“).
 */
import { useMutation } from "convex/react";
import { useId, useRef, useState, type FormEvent } from "react";

import { saveConsent, saveConsentForm } from "@/app/actions/consent";
import { api } from "@/convex/_generated/api";
import type { ConsentChoice } from "@/lib/analytics/consent";
import { useConsent } from "@/lib/analytics/consentStore";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { EASE } from "@/constants/motion";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { Switch } from "@/components/ui/Switch";
import { MAIN_ID } from "@/components/shell/SkipLink";
import { ROUTES } from "@/constants/routes";

export function ConsentBanner({ serverOpen }: { serverOpen: boolean }) {
  const { record, open, detailed, initialised, setRecord, setDetailed } = useConsent();
  const recordConsent = useMutation(api.consent.record);
  const titleId = useId();
  const descId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState(record?.analytics ?? false);
  const [ads, setAds] = useState(record?.ads ?? false);
  // Before hydration the server decides; afterwards the store does.
  const visible = initialised ? open : serverOpen;
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  // Reopened from the footer: start from the saved choice (state adjusted during render).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAnalytics(record?.analytics ?? false);
      setAds(record?.ads ?? false);
    }
  }

  // Exit (and re-entry from the footer) with GSAP; the first paint is never animated.
  const wasVisible = useRef(visible);
  useGSAP(
    () => {
      const el = panel.current;
      if (!el || wasVisible.current === visible) return;
      wasVisible.current = visible;
      const reduce = prefersReducedMotion();
      if (visible) {
        gsap.fromTo(el, reduce ? { opacity: 0 } : { opacity: 0, y: 24 }, {
          opacity: 1,
          y: 0,
          duration: reduce ? 0.16 : 0.36,
          ease: EASE.out,
        });
        el.querySelector<HTMLElement>("[data-consent-focus]")?.focus();
      } else {
        gsap.to(el, {
          ...(reduce ? { opacity: 0 } : { opacity: 0, y: 24 }),
          duration: reduce ? 0.16 : 0.24,
          ease: EASE.in,
          onComplete: () => setMounted(false),
        });
      }
    },
    { dependencies: [visible] },
  );

  async function decide(choice: ConsentChoice) {
    // Buttons are disabled while saving (focus drops to <body>), so remember it first.
    const hadFocus = panel.current?.contains(document.activeElement) ?? false;
    setPending(true);
    setError(null);
    try {
      const saved = await saveConsent(choice);
      // The banner is about to disappear: hand focus to the page instead of losing it.
      setRecord(saved);
      if (hadFocus) document.getElementById(MAIN_ID)?.focus({ preventScroll: true });
      void recordConsent({ consentId: saved.id, analytics: saved.analytics, ads: saved.ads }).catch(
        () => {
          // The cookie holds the decision; the log entry is best effort.
        },
      );
    } catch {
      setError("Izbor nije sačuvan. Pokušajte ponovo.");
    } finally {
      setPending(false);
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const value = submitter?.value;
    void decide(
      value === "all"
        ? { analytics: true, ads: true }
        : value === "none"
          ? { analytics: false, ads: false }
          : { analytics, ads },
    );
  }

  if (!mounted) return null;

  return (
    <div
      ref={panel}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      aria-describedby={descId}
      data-reveal="off"
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
          <p id={descId} className="max-w-[68ch] type-body-s text-ink-2">
            Neophodne kolačiće koristimo za korpu i prijavu. Uz vašu dozvolu koristimo i analitičke
            (Google Analytics) i oglasne (Google Ads, Meta) — da vidimo odakle dolazite i koji
            oglasi vrede. Izbor menjate bilo kad, u podnožju strane.{" "}
            <Link href={ROUTES.cookies} variant="inline">
              Više o kolačićima
            </Link>
          </p>
          {detailed ? (
            <fieldset className="mt-2 flex flex-col divide-y divide-line border-y border-line">
              <legend className="sr-only">Kategorije kolačića</legend>
              <Switch
                label="Neophodni"
                description="Korpa, prijava, izbor kolačića. Uvek uključeni."
                checked
                disabled
              />
              <Switch
                label="Analitika"
                description="Google Analytics 4: posete i pretrage, bez ličnih podataka."
                name="analytics"
                checked={analytics}
                onCheckedChange={setAnalytics}
                data-testid="consent-analytics"
              />
              <Switch
                label="Oglašavanje"
                description="Google Ads i Meta: merenje oglasa i konverzija."
                name="ads"
                checked={ads}
                onCheckedChange={setAds}
                data-testid="consent-ads"
              />
            </fieldset>
          ) : null}
          {error ? (
            <p role="alert" className="type-body-s text-danger">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          {detailed ? (
            <Button
              type="submit"
              name="choice"
              value="custom"
              variant="quiet"
              disabled={pending}
              data-consent-focus
              className="min-w-36 flex-1 lg:flex-none"
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
            className="min-w-36 flex-1 lg:flex-none"
          >
            Prihvati sve
          </Button>
          <Button
            type="submit"
            name="choice"
            value="none"
            variant="quiet"
            disabled={pending}
            className="min-w-36 flex-1 lg:flex-none"
          >
            Odbij sve
          </Button>
          {!detailed ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setDetailed(true)}
              className="min-w-36 flex-1 lg:flex-none"
            >
              Podešavanja
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
