// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Price } from "@/components/ui/Price";
import { StockBadge, stockLabel } from "@/components/ui/StockBadge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field, RequiredUnlessOptional } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Stepper } from "@/components/ui/Stepper";
import { contrast, contrastRows } from "@/app/styleguide/_lib/tokens";

afterEach(cleanup);

describe("Price", () => {
  it("renders retail price with the VAT note and opts out of the reveal", () => {
    const { container } = render(<Price para={1299000} />);
    expect(container.textContent).toContain("12.990");
    expect(container.textContent).toContain("RSD");
    expect(container.textContent).toContain("sa PDV-om");
    expect(container.firstElementChild?.getAttribute("data-reveal")).toBe("off");
  });

  it("renders the mechanic price with the struck retail price and rabat", () => {
    const { container } = render(
      <Price para={364650} variant="mechanic" retailPara={429000} discount={0.15} />,
    );
    expect(container.querySelector("s")?.textContent).toBe("4.290 RSD");
    expect(container.textContent).toContain("Vaša cena");
    expect(container.textContent).toContain("rabat 15 %");
    expect(container.textContent).toContain("3.646,50");
    expect(screen.getByText("Maloprodajna cena:")).toBeTruthy();
  });
});

describe("StockBadge", () => {
  it.each([
    [{ status: "in_stock" as const, quantity: 4 }, "Na stanju · 4 kom."],
    [{ status: "in_stock" as const, quantity: 24 }, "Na stanju"],
    [{ status: "low" as const, quantity: 2 }, "Malo na stanju · 2 kom."],
    [{ status: "on_order" as const, leadTime: "3–5 dana" }, "Po porudžbini · 3–5 dana"],
    [{ status: "out" as const }, "Nema na stanju"],
  ])("label %o", (props, expected) => {
    expect(stockLabel(props)).toBe(expected);
  });

  it("always pairs an icon with the word (never colour alone)", () => {
    const { container } = render(<StockBadge status="low" quantity={2} />);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(container.textContent).toContain("Malo na stanju");
  });
});

describe("Button", () => {
  it("keeps its label, sets aria-busy and blocks clicks while loading", () => {
    let clicks = 0;
    render(
      <Button loading onClick={() => (clicks += 1)}>
        Pošalji porudžbinu
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Pošalji porudžbinu" });
    expect(button.getAttribute("aria-busy")).toBe("true");
    button.click();
    expect(clicks).toBe(0);
  });

  it("defaults to type=button", () => {
    render(<Button>U korpu</Button>);
    expect(screen.getByRole("button").getAttribute("type")).toBe("button");
  });
});

describe("design tokens", () => {
  it("every contrast pair in tokens.json meets its threshold", () => {
    const failing = contrastRows().filter((row) => row.ratio < row.min);
    expect(failing).toEqual([]);
  });

  it("contrast() matches WCAG for black on white", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });
});

describe("form controls (step 22)", () => {
  it("announces required fields inside RequiredUnlessOptional, never the optional ones (A11Y-18)", () => {
    render(
      <RequiredUnlessOptional>
        <Field id="t-name" label="Ime">
          <Input />
        </Field>
        <Field id="t-note" label="Napomena" optional>
          <Input />
        </Field>
      </RequiredUnlessOptional>,
    );
    const name = document.getElementById("t-name");
    expect(name?.getAttribute("aria-required")).toBe("true");
    // aria only: no native attribute, so the browser never shows its own bubble.
    expect(name?.hasAttribute("required")).toBe(false);
    expect(document.getElementById("t-note")?.hasAttribute("aria-required")).toBe(false);
  });

  it("does not mark fields required outside the provider (admin forms mark required instead)", () => {
    render(
      <Field id="t-filter" label="Pretraga">
        <Input />
      </Field>,
    );
    expect(document.getElementById("t-filter")?.hasAttribute("aria-required")).toBe(false);
  });

  it("links the checkbox error to the box and keeps the same box when it goes away (A11Y-07)", () => {
    const { rerender } = render(<Checkbox id="t-terms" label="Prihvatam uslove" required error="Potrebna je saglasnost." />);
    const box = document.getElementById("t-terms");
    expect(box?.getAttribute("aria-invalid")).toBe("true");
    expect(box?.getAttribute("aria-required")).toBe("true");
    const described = (box?.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent);
    expect(described).toContain("Potrebna je saglasnost.");
    rerender(<Checkbox id="t-terms" label="Prihvatam uslove" required />);
    expect(document.getElementById("t-terms")).toBe(box);
    expect(box?.hasAttribute("aria-invalid")).toBe(false);
  });

  it("renders the compact select with 16 px text below md (VIS-12)", () => {
    render(<Select aria-label="Sortiranje" size="sm" options={[{ value: "a", label: "A" }]} />);
    expect(screen.getByLabelText("Sortiranje").className).toContain("max-md:text-[1rem]");
  });
});

describe("Stepper", () => {
  it("names the edit button as one phrase, without a stray colon (A11Y-19)", () => {
    render(
      <Stepper
        steps={[
          { id: "contact", label: "Kontakt" },
          { id: "delivery", label: "Dostava" },
        ]}
        current={1}
        onSelect={() => {}}
      />,
    );
    const button = screen.getByRole("button");
    expect(button.textContent?.replace(/\s+/g, " ").trim()).toBe("Izmeni korak Kontakt");
  });
});
