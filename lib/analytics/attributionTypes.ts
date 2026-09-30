/** Attribution shapes mirrored from `convex/lib/validators.ts` (`touchV`, `attributionV`). */
export type Touch = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  msclkid?: string;
  referrer?: string;
  landingPath?: string;
  at: number;
};

export type Attribution = {
  first?: Touch;
  last?: Touch;
  fbp?: string;
  fbc?: string;
  gaClientId?: string;
  consentAnalytics: boolean;
  consentAds: boolean;
};
