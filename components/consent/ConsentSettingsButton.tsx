"use client";

import { openConsentSettings } from "@/lib/analytics/consentStore";

/** Footer control that reopens the consent panel in the granular view. */
export function ConsentSettingsButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openConsentSettings}
      className={className}
      data-testid="consent-reopen"
    >
      Podešavanja kolačića
    </button>
  );
}
