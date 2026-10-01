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
import { whenIdle } from "@/lib/dom/idle";
import { useLatched } from "@/lib/hooks/useLatched";
import { CONSENT_BANNER_SELECTOR, CONSENT_KEY_ATTR } from "@/components/consent/consentDom";

type BannerComponent = ComponentType<{ serverOpen: boolean; animateIn?: boolean }>;

const loadBanner = (): Promise<BannerComponent> =>
  import("@/components/consent/ConsentBanner").then((m) => m.ConsentBanner);

/**
 * Interactions that upgrade the static first-visit panel. Nothing else does: the swap replaces
 * the panel's DOM, and a swap without user input would paint the banner copy a second time as a
 * new, late Largest Contentful Paint (Chromium stops recording LCP at the first input).
 */
const INTENT_EVENTS = ["pointerdown", "keydown", "focusin", "touchstart"] as const;
const IDLE_TIMEOUT_MS = 3000;

/** Fetches and evaluates the banner module ahead of the swap; a failure surfaces on the swap. */
const warmBanner = () => void loadBanner().catch(() => undefined);

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
 *   stays as it is through hydration and paints with the first frame. The banner module is
 *   warmed in idle time (or when a pointer reaches the panel) and replaces the panel in one
 *   commit on the first interaction — never before it, so the swap cannot become a late LCP.
 *   A press inside the panel does not swap: its click on a decision button is held (no form
 *   post) and replayed on the live button, so the pressed control is never replaced under the
 *   pointer. Focus inside the panel moves to the same control; an Escape is replayed too.
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

  // First visit: warm the module in idle time, swap on the first interaction.
  useEffect(() => {
    if (!startedOpen) return;
    const request = () => setUpgrade(true);
    // A press that started inside the panel: its focus waits for the click (held below).
    let pressInPanel = false;
    const onIntent = (event: Event) => {
      const inPanel =
        event.target instanceof Element && event.target.closest(CONSENT_BANNER_SELECTOR) !== null;
      if (event instanceof KeyboardEvent) {
        pressInPanel = false;
        // Escape for the banner, not for a modal overlay that owns it (as the banner decides).
        if (
          event.key === "Escape" &&
          !document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"]')
        ) {
          escape.current = true;
        }
        request();
      } else if (event.type === "focusin") {
        if (!(inPanel && pressInPanel)) request();
      } else {
        pressInPanel = inPanel;
        if (inPanel) warmBanner();
        else request();
      }
    };
    const onHover = (event: Event) => {
      if (event.target instanceof Element && event.target.closest(CONSENT_BANNER_SELECTOR)) {
        warmBanner();
      }
    };
    const cancelIdle = whenIdle(warmBanner, IDLE_TIMEOUT_MS);
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
