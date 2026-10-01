"use client";

import { useEffect, useRef } from "react";

import { Switch } from "@/components/ui/Switch";

/**
 * Granular consent view (three categories). Loaded only when the visitor opens „Podešavanja“
 * or reopens the panel from the footer, so the switch primitive stays out of the first load
 * (PERF-11). `focusFirst` moves focus to the first switch that can change (A11Y-06): the
 * „Podešavanja“ button that opened this view is gone, and focus must not fall to <body>.
 */
export function ConsentDetails({
  analytics,
  ads,
  onAnalyticsChange,
  onAdsChange,
  focusFirst,
}: {
  analytics: boolean;
  ads: boolean;
  onAnalyticsChange: (value: boolean) => void;
  onAdsChange: (value: boolean) => void;
  focusFirst: boolean;
}) {
  const root = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    if (!focusFirst) return;
    root.current?.querySelector<HTMLElement>('[role="switch"]:not([disabled])')?.focus();
  }, [focusFirst]);

  return (
    <fieldset ref={root} className="mt-2 flex flex-col divide-y divide-line border-y border-line">
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
        onCheckedChange={onAnalyticsChange}
        data-testid="consent-analytics"
      />
      <Switch
        label="Oglašavanje"
        description="Google Ads i Meta: merenje oglasa i konverzija."
        name="ads"
        checked={ads}
        onCheckedChange={onAdsChange}
        data-testid="consent-ads"
      />
    </fieldset>
  );
}
