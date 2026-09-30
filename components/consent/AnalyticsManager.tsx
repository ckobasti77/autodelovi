"use client";

/**
 * Loads and feeds the ad/analytics tags per consent (SEO-ADS §J6–§J7). Always declares the
 * Consent Mode defaults (local queue only). `gtag.js` is requested only after analytics or
 * ads consent with a configured GA4 / Google Ads id; Meta `fbevents.js` only after ads
 * consent with a Pixel id. Withdrawing consent updates Consent Mode, revokes the Pixel,
 * unregisters the adapters and deletes the tags' cookies.
 */
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { TRACKING_COOKIE_PATTERNS } from "@/lib/analytics/consent";
import { useConsent } from "@/lib/analytics/consentStore";
import {
  clearTrackingCookies,
  declareConsentDefaults,
  googleAdapter,
  loadGoogleTag,
  loadMetaPixel,
  metaAdapter,
  metaPageView,
  revokeMeta,
  updateConsentMode,
  type TagIds,
} from "@/lib/analytics/tags";
import { registerAnalyticsAdapter } from "@/lib/analytics/track";

export function AnalyticsManager({ ids }: { ids: TagIds }) {
  const record = useConsent((s) => s.record);
  const pathname = usePathname();
  const pixelActive = useRef(false);
  const firstPath = useRef(true);

  useEffect(() => {
    declareConsentDefaults();
  }, []);

  const analytics = record?.analytics ?? false;
  const ads = record?.ads ?? false;
  const decided = record !== null;

  useEffect(() => {
    if (!decided) return;
    const choice = { analytics, ads };
    updateConsentMode(choice);
    const cleanups: (() => void)[] = [];
    if (loadGoogleTag(ids, choice)) {
      cleanups.push(registerAnalyticsAdapter("google", googleAdapter(ids, choice)));
    }
    if (ads && ids.metaPixelId) {
      loadMetaPixel(ids.metaPixelId);
      if (!pixelActive.current) metaPageView();
      pixelActive.current = true;
      cleanups.push(registerAnalyticsAdapter("meta", metaAdapter()));
    } else if (pixelActive.current) {
      revokeMeta();
      pixelActive.current = false;
    }
    if (!analytics && !ads) clearTrackingCookies(TRACKING_COOKIE_PATTERNS);
    return () => cleanups.forEach((fn) => fn());
  }, [decided, analytics, ads, ids]);

  // Meta counts page views itself only on full loads; client navigations are sent here
  // (GA4 enhanced measurement tracks history changes on its own).
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (pixelActive.current) metaPageView();
  }, [pathname]);

  return null;
}
