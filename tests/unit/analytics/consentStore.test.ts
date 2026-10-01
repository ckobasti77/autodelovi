import { beforeEach, describe, expect, it } from "vitest";

import type { ConsentRecord } from "@/lib/analytics/consent";
import { openConsentSettings, useConsent } from "@/lib/analytics/consentStore";

const record = (id: string, analytics = false): ConsentRecord => ({
  v: 1,
  analytics,
  ads: false,
  at: 1,
  id,
});

describe("consent store init (D250)", () => {
  beforeEach(() => {
    useConsent.setState({ record: null, open: false, detailed: false, initialised: false });
  });

  it("opens the banner on a first visit and stays closed for a returning visitor", () => {
    useConsent.getState().init(null);
    expect(useConsent.getState()).toMatchObject({ open: true, initialised: true });

    useConsent.setState({ initialised: false, open: false });
    useConsent.getState().init(record("a"));
    expect(useConsent.getState()).toMatchObject({ open: false, record: { id: "a" } });
  });

  it("adopts a newer server record (static panel posted before the client banner took over)", () => {
    useConsent.getState().init(null);
    useConsent.getState().init(record("b", true));
    expect(useConsent.getState()).toMatchObject({ open: false, record: { id: "b", analytics: true } });
  });

  it("ignores a refresh with the record it already has, so a reopened panel stays open", () => {
    useConsent.getState().init(record("c"));
    openConsentSettings();
    useConsent.getState().init(record("c"));
    expect(useConsent.getState()).toMatchObject({ open: true, detailed: true });
  });

  it("never closes the banner because of a later null record", () => {
    useConsent.getState().init(null);
    useConsent.getState().init(null);
    expect(useConsent.getState().open).toBe(true);
  });
});
