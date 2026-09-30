/**
 * Consent record sent with orders and inquiries (DATA-MODEL `consentV`). Marketing, analytics
 * and ads stay false until the consent banner (step 19) records a choice.
 */
export function buildConsent(legal: { terms: string; privacy: string }) {
  return {
    termsVersion: legal.terms,
    privacyVersion: legal.privacy,
    acceptedAt: Date.now(),
    marketingEmail: false,
    analytics: false,
    ads: false,
  };
}

/**
 * Form start time for the anti-spam timing check (Convex rejects submissions faster than 3 s).
 * `useState(formStartTime)` keeps the first value for the component's life.
 */
export function formStartTime(): number {
  return Date.now();
}
