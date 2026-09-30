import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { RevealText } from "@/components/text-reveal/RevealText";
import { CartPageView } from "@/components/cart/CartPageView";

export const metadata: Metadata = privateMetadata("Korpa");

/** Cart page `/korpa` (§10.5): lines table + sticky summary; the drawer's full-page twin. */
export default async function CartPage() {
  const settings = await getSettingsPublic();
  const courier = settings.deliveryMethods.find((d) => d.code === "courier");
  return (
    <div className="px-page pb-(--space-section) pt-8">
      <RevealText as="h1" className="type-h1 text-ink-1">
        Korpa
      </RevealText>
      <div className="mt-8">
        <CartPageView
          delivery={{
            courierPricePara: courier?.pricePara ?? null,
            freeOverPara: courier?.freeOverPara ?? settings.commerce.freeShippingOverPara ?? null,
            pickup: settings.deliveryMethods.some((d) => d.code === "pickup"),
            vatRateBp: settings.commerce.vatRateBp,
          }}
        />
      </div>
    </div>
  );
}
