import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// Client islands with Convex/router hooks are irrelevant to the header's own link classes.
vi.mock("@/components/shell/AccountLink", () => ({
  AccountLink: ({ className }: { className: string }) => (
    <a href="/prijava" data-testid="account-button" className={className}>
      Nalog
    </a>
  ),
}));
vi.mock("@/components/shell/CartButtonLive", () => ({ CartButtonLive: () => null }));
vi.mock("@/components/shell/HeaderSearch", () => ({ HeaderSearch: () => null }));
vi.mock("@/components/shell/MobileNav", () => ({ MobileNav: () => null }));
vi.mock("@/components/shell/NavLinks", () => ({ NavLinks: () => null }));

import { Header } from "@/components/shell/Header";

/** Unprefixed display utilities: next to `hidden` their CSS order, not class order, decides. */
const DISPLAY = new Set(["block", "inline-block", "inline", "flex", "inline-flex", "grid", "contents"]);

function anchors(html: string) {
  return [...html.matchAll(/<a\b[^>]*>/g)].map((m) => {
    const tag = m[0];
    return {
      href: /href="([^"]*)"/.exec(tag)?.[1] ?? "",
      label: /aria-label="([^"]*)"/.exec(tag)?.[1] ?? null,
      classes: (/class="([^"]*)"/.exec(tag)?.[1] ?? "").split(/\s+/).filter(Boolean),
    };
  });
}

describe("Header contact and account links (VIS-03)", () => {
  const html = renderToStaticMarkup(
    <Header cartCount={0} contact={{ phone: "+381641234567", viber: "+381641234567" }} />,
  );
  const links = anchors(html);
  const contactLinks = links.filter((a) => a.href.startsWith("tel:") || a.href.startsWith("viber:"));

  it("renders text and icon variants for phone and Viber", () => {
    expect(contactLinks).toHaveLength(4);
  });

  it("never pairs `hidden` with an unprefixed display utility", () => {
    for (const a of links.filter((l) => l.classes.includes("hidden"))) {
      expect(a.classes.filter((c) => DISPLAY.has(c))).toEqual([]);
    }
  });

  it("shows contact text links only from 1440 px and icon links from 480 px to 1439 px", () => {
    for (const a of contactLinks) {
      expect(a.classes).toContain("hidden");
      if (a.label === null) {
        expect(a.classes).toContain("min-[90rem]:inline-flex");
      } else {
        expect(a.classes).toEqual(expect.arrayContaining(["sm:inline-flex", "min-[90rem]:hidden"]));
      }
    }
  });

  it("hides the account link below 480 px (it lives in the mobile menu)", () => {
    const account = links.find((a) => a.href === "/prijava");
    expect(account?.classes).toEqual(expect.arrayContaining(["hidden", "sm:inline-flex"]));
  });
});
