// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Price } from "@/components/ui/Price";
import { StockBadge, stockLabel } from "@/components/ui/StockBadge";
import { Button } from "@/components/ui/Button";
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
