import { describe, expect, it } from "vitest";

import { isTokenPath, redactedPageUrl, redactTokenPath } from "@/lib/analytics/redact";

const TOKEN = "Zq3vK9x_pL2mN8rT4wY6aB1cD5eF7gH0jS-uV2iO3kA";

describe("capability token redaction", () => {
  it.each([
    [`/porudzbina/${TOKEN}`, "/porudzbina/[token]"],
    [`/porudzbina/${TOKEN}/predracun`, "/porudzbina/[token]/predracun"],
    [`/porudzbina/hvala/${TOKEN}`, "/porudzbina/hvala/[token]"],
    [`/upit/${TOKEN}`, "/upit/[token]"],
    [`/upit/hvala/${TOKEN}`, "/upit/hvala/[token]"],
    [`/obavestenja/odjava/${TOKEN}`, "/obavestenja/odjava/[token]"],
    [`/admin/pozivnica/${TOKEN}`, "/admin/pozivnica/[token]"],
  ])("%s → %s", (path, redacted) => {
    expect(isTokenPath(path)).toBe(true);
    expect(redactTokenPath(path)).toBe(redacted);
  });

  it.each(["/porudzbina", "/upit", "/delovi/kocioni-sistem", "/nalog/porudzbine/SK-2026-00012"])(
    "leaves %s alone",
    (path) => {
      expect(isTokenPath(path)).toBe(false);
      expect(redactTokenPath(path)).toBe(path);
    },
  );

  it("builds the absolute URL for analytics without the token or fragment", () => {
    expect(redactedPageUrl(`https://primer.rs/porudzbina/hvala/${TOKEN}?utm_source=x#vrh`)).toBe(
      "https://primer.rs/porudzbina/hvala/[token]?utm_source=x",
    );
    expect(redactedPageUrl("https://www.google.com/")).toBe("https://www.google.com/");
  });
});
