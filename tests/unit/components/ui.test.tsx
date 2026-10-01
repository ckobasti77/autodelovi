// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { useForm, useWatch, type Control } from "react-hook-form";
import { afterEach, describe, expect, it } from "vitest";

import { Price } from "@/components/ui/Price";
import { StockBadge, stockLabel } from "@/components/ui/StockBadge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import {
  Field,
  RequiredUnlessOptional,
  useKeepTypedBeforeHydration,
} from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Stepper } from "@/components/ui/Stepper";
import { Textarea } from "@/components/ui/Textarea";
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

type DraftValues = { message: string; name: string };

/** Simulates keys pressed after the form rendered but before React committed the hydration. */
function LateKeys() {
  if (typeof document !== "undefined") {
    const el = document.getElementById("t-msg");
    if (el instanceof HTMLTextAreaElement && el.value === "Golf") el.value = "Golf 7";
  }
  return null;
}

function WatchedValues({ control }: { control: Control<DraftValues> }) {
  const values = useWatch({ control });
  return <output data-testid="values">{JSON.stringify(values)}</output>;
}

function DraftForm({ message = "", watched = true }: { message?: string; watched?: boolean }) {
  const { register, control, setValue } = useForm<DraftValues>({
    defaultValues: { message, name: "" },
  });
  const keep = useKeepTypedBeforeHydration<keyof DraftValues>((name, value) =>
    setValue(name, value, { shouldDirty: true }),
  );
  return (
    <form>
      <Textarea id="t-msg" maxLength={2000} {...keep(register("message"))} />
      <input id="t-name" {...keep(register("name"))} />
      <LateKeys />
      {watched ? <WatchedValues control={control} /> : null}
    </form>
  );
}

describe("text typed before hydration (XB-01)", () => {
  it("keeps keys pressed up to the hydration commit and syncs form state and counter", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<DraftForm />);
    document.body.append(container);
    const message = container.querySelector<HTMLTextAreaElement>("#t-msg")!;
    const name = container.querySelector<HTMLInputElement>("#t-name")!;
    message.value = "Golf";
    name.value = "Petar";

    await act(async () => {
      hydrateRoot(container, <DraftForm />);
    });

    expect(message.value).toBe("Golf 7");
    expect(name.value).toBe("Petar");
    expect(container.querySelector("#t-msg-count")?.textContent).toBe("6 / 2.000");
    expect(JSON.parse(screen.getByTestId("values").textContent ?? "{}")).toEqual({
      message: "Golf 7",
      name: "Petar",
    });
    container.remove();
  });

  it("updates the counter even when nothing in the form watches the restored field", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(<DraftForm watched={false} />);
    document.body.append(container);
    container.querySelector<HTMLTextAreaElement>("#t-msg")!.value = "Golf";

    await act(async () => {
      hydrateRoot(container, <DraftForm watched={false} />);
    });

    expect(container.querySelector<HTMLTextAreaElement>("#t-msg")?.value).toBe("Golf 7");
    expect(container.querySelector("#t-msg-count")?.textContent).toBe("6 / 2.000");
    container.remove();
  });

  it("counts an uncontrolled value written by register() without an input event", () => {
    const { container } = render(<DraftForm message="turbina golf 7" />);
    expect(container.querySelector<HTMLTextAreaElement>("#t-msg")?.value).toBe("turbina golf 7");
    expect(container.querySelector("#t-msg-count")?.textContent).toBe("14 / 2.000");
  });
});
