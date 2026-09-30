import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "@/convex/_generated/api";
import { contactLinkList } from "@/config/site";
import { privateMetadata } from "@/lib/seo/metadata";
import { contactFromSettings } from "@/lib/settings/public";
import { fetchPublic } from "@/lib/server/convex";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { RevealText } from "@/components/text-reveal/RevealText";
import { ContactActions } from "@/components/shell/ContactActions";
import { OrderStatusView } from "@/components/order/OrderStatusView";

export const metadata: Metadata = privateMetadata("Status porudžbine");

/** Tokenized order status with a live timeline (§10.6). The token is the capability. */
export default async function OrderStatusPage({ params }: PageProps<"/porudzbina/[token]">) {
  const { token } = await params;
  const [order, settings] = await Promise.all([
    fetchPublic(api.orders.getByToken, { token }),
    getSettingsPublic(),
  ]);
  if (!order) notFound();
  return (
    <div className="px-page pb-(--space-section) pt-8">
      <RevealText as="h1" className="type-h1 text-ink-1">
        Porudžbina
      </RevealText>
      <div className="mt-6">
        <OrderStatusView token={token} initial={order}>
          <div className="flex flex-col gap-2">
            <p className="type-body-s text-ink-2">Pitanje o porudžbini? Navedite njen broj.</p>
            <ContactActions links={contactLinkList(contactFromSettings(settings))} location="order_status" />
          </div>
        </OrderStatusView>
      </div>
    </div>
  );
}
