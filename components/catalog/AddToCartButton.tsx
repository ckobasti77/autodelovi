"use client";

/**
 * Add to cart (§8.5, §9.7, §9.8): label → „Dodato“ + check for 1.6 s, a polite live-region
 * announcement, the header count updates from the cart subscription; phones also get a toast
 * with „Pogledaj korpu“. Out of stock without backorder → „Obavesti me“ (product page form).
 */
import { useState } from "react";
import { BellIcon, CheckIcon, ShoppingCartSimpleIcon } from "@phosphor-icons/react/dist/ssr";

import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/cn";
import { analyticsItem, track } from "@/lib/analytics/track";
import { useAddToCart, useCart, type AddSource } from "@/lib/cart/guestCart";
import { openCartDrawer } from "@/lib/cart/drawer";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import type { StockState } from "@/lib/i18n/sr/catalog";
import { isOrderable } from "@/lib/catalog/orderable";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { toast } from "@/components/ui/Toast";
import { useLiveProduct } from "@/components/catalog/LiveOverlay";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";

export type CartProduct = {
  _id: string;
  slug: string;
  sku: string;
  name: string;
  manufacturerName: string;
  systemSlug: string;
  categorySlug: string;
  retailPricePara: number | null;
  stockState: StockState;
  stockQty: number;
  allowBackorder: boolean;
  /** Supplier lead time: the server accepts quantities past stock when it is set (canOrderQuantity). */
  leadTimeDays?: number | null;
};

/**
 * „U korpu: <naziv>“. Set as `aria-label` rather than visible label + `sr-only` span: the
 * absolutely positioned span is block-level, so browsers joined the two with a space
 * („U korpu : …“, A11Y-19). The visible label still starts the name (WCAG 2.5.3).
 */
function accessibleName(label: string, productName: string): string {
  return `${label}: ${productName}`;
}

function announce(text: string) {
  const region = document.getElementById("cart-live");
  if (region) region.textContent = text;
}

export function AddToCartButton({
  product,
  source = "catalog",
  variant = "card",
  emphasis = false,
  className,
}: {
  product: CartProduct;
  source?: AddSource;
  /** `card`: quiet 44 px; `product`: quantity stepper + primary large button. */
  variant?: "card" | "product";
  /** Card variant as the primary action (sticky buy bar). */
  emphasis?: boolean;
  className?: string;
}) {
  const live = useLiveProduct(product._id);
  const stockState = live?.stockState ?? product.stockState;
  const stockQty = live?.stockQty ?? product.stockQty;
  const add = useAddToCart(source);
  const [state, setState] = useState<"idle" | "busy" | "added">("idle");
  const [quantity, setQuantity] = useState(1);
  const cart = useCart();
  const inCart = cart?.lines.find((line) => line.productId === product._id)?.quantity ?? 0;
  const orderable = isOrderable(stockState, product.allowBackorder);
  const backorder = stockState === "on_order" || stockState === "out_of_stock";

  if (!orderable) {
    return (
      <Button
        asChild
        variant={variant === "product" ? "secondary" : "quiet"}
        size={variant === "product" ? "lg" : "md"}
        icon={<BellIcon size={20} />}
        fullWidth={variant === "card"}
        className={cn("relative z-[1]", className)}
      >
        <Link
          href={`${ROUTES.product(product.slug)}#obavestenje`}
          variant="unstyled"
          aria-label={accessibleName("Obavesti me", product.name)}
        >
          Obavesti me
        </Link>
      </Button>
    );
  }

  // The server refuses more than the stock unless the part can be ordered past it (backorder or a
  // supplier lead time, canOrderQuantity): what the cart already holds counts (FLOW-25).
  const capped = !backorder && !product.allowBackorder && !((product.leadTimeDays ?? 0) > 0);
  const remaining = capped ? Math.max(0, Math.floor(stockQty) - inCart) : 99;
  const full = capped && remaining === 0 && state !== "added";
  const max = Math.max(1, Math.min(99, remaining));
  const chosen = Math.min(quantity, max);

  const onAdd = async () => {
    if (state === "busy") return;
    setState("busy");
    try {
      const qty = variant === "product" ? chosen : 1;
      await add(product._id as Id<"products">, qty);
      track({
        name: "add_to_cart",
        item: analyticsItem({
          sku: product.sku,
          name: product.name,
          manufacturerName: product.manufacturerName,
          systemSlug: product.systemSlug,
          categorySlug: product.categorySlug,
          pricePara: live?.yourPricePara ?? product.retailPricePara,
          quantity: qty,
        }),
      });
      setState("added");
      announce(`Dodato u korpu: ${product.name}.`);
      if (window.matchMedia("(max-width: 63.99rem)").matches) {
        toast.success(`Dodato u korpu: ${product.name}.`, {
          action: { label: "Pogledaj korpu", onClick: openCartDrawer },
        });
      }
      window.setTimeout(() => setState("idle"), 1600);
    } catch (error) {
      setState("idle");
      toast.error(
        convexErrorMessage(
          error,
          "Artikal trenutno ne može u korpu. Pokušajte ponovo ili nas pozovite.",
        ),
      );
    }
  };

  const label =
    state === "added"
      ? "Dodato"
      : full
        ? "Sve je u korpi"
        : backorder
          ? "Poruči"
          : variant === "product"
            ? "Dodaj u korpu"
            : "U korpu";
  const icon = state === "added" ? <CheckIcon size={20} /> : <ShoppingCartSimpleIcon size={20} />;

  if (variant === "product") {
    return (
      <div className={cn("flex flex-wrap items-stretch gap-3", className)}>
        <QuantityStepper
          value={chosen}
          onChange={setQuantity}
          min={1}
          max={max}
          label={`Količina: ${product.name}`}
        />
        <Button
          variant="primary"
          size="lg"
          icon={icon}
          loading={state === "busy"}
          disabled={full}
          onClick={onAdd}
          data-testid={TEST_IDS.productAddToCart}
          aria-label={accessibleName(label, product.name)}
          className="min-w-[12rem] flex-1"
        >
          {label}
        </Button>
        {capped && inCart > 0 ? (
          <p role="status" className="w-full type-body-s text-ink-2" data-reveal="off">
            {full
              ? `U korpi je sva količina sa stanja (${inCart} kom.).`
              : `U korpi: ${inCart} kom. Možete dodati još ${remaining} kom.`}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Button
      variant={emphasis ? "primary" : "quiet"}
      size="md"
      icon={icon}
      loading={state === "busy"}
      disabled={full}
      onClick={onAdd}
      fullWidth
      data-testid={TEST_IDS.productAddToCart}
      aria-label={accessibleName(label, product.name)}
      className={cn("relative z-[1]", className)}
    >
      {label}
    </Button>
  );
}
