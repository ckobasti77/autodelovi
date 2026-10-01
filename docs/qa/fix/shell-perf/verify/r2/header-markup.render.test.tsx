import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";

// Client islands with Convex/router hooks: replaced by markers; the contact links are real.
vi.mock("@/components/shell/AccountLink", () => ({
  AccountLink: () => <i data-r2="account" />,
}));
vi.mock("@/components/shell/CartButtonLive", () => ({ CartButtonLive: () => null }));
vi.mock("@/components/shell/HeaderSearch", () => ({ HeaderSearch: () => null }));
vi.mock("@/components/shell/MobileNav", () => ({ MobileNav: () => null }));
vi.mock("@/components/shell/NavLinks", () => ({ NavLinks: () => null }));

import { Header } from "@/components/shell/Header";

it("extracts the contact anchors Header.tsx renders with phone + Viber", () => {
  const html = renderToStaticMarkup(
    <Header cartCount={0} contact={{ phone: "+381641234567", viber: "+381641234567" }} />,
  );
  const anchors = [...html.matchAll(/<a\b[^>]*href="(?:tel|viber)[^"]*"[^>]*>[\s\S]*?<\/a>/g)].map((m) => m[0]);
  expect(anchors).toHaveLength(4);
  writeFileSync(
    "docs/qa/fix/shell-perf/verify/r2/header-contact-markup.json",
    JSON.stringify({ anchors }, null, 2),
  );
});
