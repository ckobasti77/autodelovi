"use client";

/**
 * Cookie consent (SEO-ADS §J6): a non-modal bottom sheet (`role="dialog"`, no focus trap, no
 * scrim). Granular view: Neophodni (always on), Analitika, Oglašavanje. Reopened from the
 * footer („Podešavanja kolačića“). The markup lives in `ConsentPanel`; this is its interactive
 * renderer.
 *
 * Never part of the first load (PERF-01/PERF-11): on a first visit the server renders the
 * static `ConsentPanel` (readable at first paint, decisions work as a form post without
 * JavaScript) and `ConsentGate` swaps this module in on the first interaction (warmed in idle
 * time; never swapped without input, so the swap cannot be a late LCP); returning visitors load
 * it only when the footer reopens it.
 *
 * While mounted it registers its height as a bottom inset (A11Y-05), so focused page controls
 * scroll above it; Escape collapses it to the title and the decision buttons. The granular
 * view loads on demand (`ConsentDetails`). `data-nosnippet` keeps the cookie copy out of
 * search snippets (SEO-11).
 */
import { useMutation } from "convex/react";
import dynamic from "next/dynamic";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { saveConsent } from "@/app/actions/consent";
import { api } from "@/convex/_generated/api";
import type { ConsentChoice } from "@/lib/analytics/consent";
import { useConsent } from "@/lib/analytics/consentStore";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { EASE } from "@/constants/motion";
import { ConsentPanel } from "@/components/consent/ConsentPanel";
import { MAIN_ID } from "@/components/shell/SkipLink";
import { useBottomInset } from "@/lib/dom/bottomInset";

const loadDetails = () => import("@/components/consent/ConsentDetails");
const ConsentDetails = dynamic(() => loadDetails().then((m) => m.ConsentDetails), { ssr: false });
const warmDetails = () => void loadDetails();

/** Escape belongs to a modal overlay when one is open or focused; never steal it from them. */
function escapeOwnedElsewhere(event: KeyboardEvent, banner: HTMLElement | null): boolean {
  if (event.defaultPrevented) return true;
  const active = document.activeElement;
  const dialog =
    active instanceof Element ? active.closest('[role="dialog"], [role="alertdialog"]') : null;
  if (dialog && dialog !== banner) return true;
  return (
    document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]') !== null
  );
}

export function ConsentBanner({
  serverOpen,
  animateIn = false,
}: {
  /** Server-read state for the first paint (first visit: true). */
  serverOpen: boolean;
  /** Mounted on demand (reopened from the footer): enter with the animation and take focus. */
  animateIn?: boolean;
}) {
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
  // Escape collapses the banner to its title and decision buttons (A11Y-05); it never decides.
  const [collapsed, setCollapsed] = useState(false);
  // Focus the first switch when the granular view is opened from „Podešavanja“ (A11Y-06).
  const [focusSwitch, setFocusSwitch] = useState(false);
  useBottomInset(panel, mounted);

  // Reopened from the footer: start from the saved choice (state adjusted during render).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setAnalytics(record?.analytics ?? false);
      setAds(record?.ads ?? false);
      setCollapsed(false);
      setFocusSwitch(false);
    }
  }

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || escapeOwnedElsewhere(event, panel.current)) return;
      setCollapsed(true);
      setDetailed(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, setDetailed]);

  // Exit (and re-entry from the footer) with GSAP; the first paint is never animated.
  const wasVisible = useRef(animateIn ? false : visible);
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
    <ConsentPanel
      titleId={titleId}
      descId={descId}
      panelRef={panel}
      collapsed={collapsed}
      detailed={detailed}
      details={
        <ConsentDetails
          analytics={analytics}
          ads={ads}
          onAnalyticsChange={setAnalytics}
          onAdsChange={setAds}
          focusFirst={focusSwitch}
        />
      }
      pending={pending}
      error={error}
      onSubmit={onSubmit}
      onSettings={() => {
        setCollapsed(false);
        setFocusSwitch(true);
        setDetailed(true);
      }}
      onWarmSettings={warmDetails}
    />
  );
}
