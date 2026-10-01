"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";

import { useConsent } from "@/lib/analytics/consentStore";
import { useLatched } from "@/lib/hooks/useLatched";
import { CONSENT_BANNER_SELECTOR, CONSENT_KEY_ATTR } from "@/components/consent/consentDom";

type BannerComponent = ComponentType<{ serverOpen: boolean; animateIn?: boolean }>;

const loadBanner = (): Promise<BannerComponent> =>
  import("@/components/consent/ConsentBanner").then((m) => m.ConsentBanner);

/** Interactions that upgrade the static first-visit panel at once (instead of in idle time). */
const INTENT_EVENTS = ["pointerdown", "keydown", "focusin", "touchstart"] as const;
const IDLE_TIMEOUT_MS = 3000;

function whenIdle(callback: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(callback, { timeout: IDLE_TIMEOUT_MS });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(callback, 200);
  return () => window.clearTimeout(id);
}

function findControl(key: string | null): HTMLElement | null {
  if (!key) return null;
  return document.querySelector<HTMLElement>(
    `${CONSENT_BANNER_SELECTOR} [${CONSENT_KEY_ATTR}="${key}"]`,
  );
}

function keyOf(el: Element | null): string | null {
  return el?.closest(CONSENT_BANNER_SELECTOR) ? el.getAttribute(CONSENT_KEY_ATTR) : null;
}

/**
 * Loads the interactive consent banner without putting it on the hydration path (PERF-01):
 *
 * - First visit (`firstVisit`, `children` = the server-rendered `ConsentPanel`): the static panel
 *   stays as it is through hydration; the banner module is fetched in idle time or on the first
 *   interaction and replaces it in one commit. Focus inside the panel moves to the same control,
 *   and a click on a decision button made before the swap is held (no form post) and replayed
 *   on the live button; an Escape is replayed too.
 * - Returning visitor: renders nothing until `openConsentSettings()` (footer) opens the store,
 *   then loads the banner and keeps it mounted (PERF-11).
 */
export function ConsentGate({
  firstVisit,
  children = null,
}: {
  firstVisit: boolean;
  children?: ReactNode;
}) {
  const open = useConsent((s) => s.open);
  const reopened = useLatched(open);
  // The server decided once, for this document; a later refresh after a decision passes false.
  const [startedOpen] = useState(firstVisit);
  const [Live, setLive] = useState<BannerComponent | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const failed = useRef(false);
  const focusKey = useRef<string | null>(null);
  const clickKey = useRef<string | null>(null);
  const escape = useRef(false);

  const wanted = startedOpen ? upgrade : reopened;

  // First visit: upgrade in idle time after hydration, or at once on any interaction.
  useEffect(() => {
    if (!startedOpen) return;
    const request = () => setUpgrade(true);
    const onIntent = (event: Event) => {
      // Escape for the banner, not for a modal overlay that owns it (as the banner decides).
      if (
        event instanceof KeyboardEvent &&
        event.key === "Escape" &&
        !document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]')
      ) {
        escape.current = true;
      }
      request();
    };
    const onHover = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(CONSENT_BANNER_SELECTOR)) {
        request();
      }
    };
    const cancelIdle = whenIdle(request);
    for (const type of INTENT_EVENTS) {
      document.addEventListener(type, onIntent, { capture: true, passive: true });
    }
    document.addEventListener("pointerover", onHover, { passive: true });
    return () => {
      cancelIdle();
      for (const type of INTENT_EVENTS) document.removeEventListener(type, onIntent, true);
      document.removeEventListener("pointerover", onHover);
    };
  }, [startedOpen]);

  // Until the live banner is in, a decision on the static panel is held and replayed after the
  // swap instead of submitting the form (that path would bypass the client store).
  useEffect(() => {
    if (!startedOpen || Live) return;
    const onClick = (event: MouseEvent) => {
      if (failed.current || !(event.target instanceof Element)) return;
      const button = event.target.closest(`${CONSENT_BANNER_SELECTOR} button[${CONSENT_KEY_ATTR}]`);
      if (!button) return;
      event.preventDefault();
      clickKey.current = button.getAttribute(CONSENT_KEY_ATTR);
      setUpgrade(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [startedOpen, Live]);

  useEffect(() => {
    if (!wanted || Live) return;
    let cancelled = false;
    loadBanner().then(
      (banner) => {
        if (cancelled) return;
        focusKey.current = keyOf(document.activeElement);
        setLive(() => banner);
      },
      () => {
        // Chunk failed (offline, deploy in between): the static panel keeps working as a form.
        failed.current = true;
      },
    );
    return () => {
      cancelled = true;
    };
  }, [wanted, Live]);

  // After the swap, before paint: the same control keeps focus.
  useLayoutEffect(() => {
    if (!Live) return;
    findControl(focusKey.current)?.focus({ preventScroll: true });
    focusKey.current = null;
  }, [Live]);

  // Replays run as passive effects: the click interceptor above has been removed by then and
  // the banner's own Escape listener (its effect runs before its parent's) is attached.
  useEffect(() => {
    if (!Live) return;
    const key = clickKey.current;
    clickKey.current = null;
    if (escape.current) {
      escape.current = false;
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    }
    findControl(key)?.click();
  }, [Live]);

  if (Live) return <Live serverOpen={startedOpen} animateIn={!startedOpen} />;
  return startedOpen ? children : null;
}
