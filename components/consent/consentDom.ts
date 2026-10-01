/**
 * DOM contract shared by the server-rendered consent panel, the client banner and the gate that
 * swaps one for the other (PERF-01). Kept in its own module so the gate does not pull the panel
 * markup (Button, Link, the Server Action reference) into the first load.
 */
export const CONSENT_BANNER_SELECTOR = "[data-testid='consent-banner']";

/** Marks the panel's controls so the gate can carry focus and a pending click across the swap. */
export const CONSENT_KEY_ATTR = "data-consent-key";

export type ConsentControlKey = "more" | "settings" | "save" | "all" | "none";
