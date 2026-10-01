import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { api } from "@/convex/_generated/api";
import { contactLinkList } from "@/config/site";
import { tokenPageMetadata } from "@/lib/seo/metadata";
import { contactFromSettings } from "@/lib/settings/public";
import { fetchPublic } from "@/lib/server/convex";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { RevealText } from "@/components/text-reveal/RevealText";
import { ContactActions } from "@/components/shell/ContactActions";
import { OrderStatusView } from "@/components/order/OrderStatusView";

/** One `orders.getByToken` per request, shared by the metadata and the page. */
const loadOrder = cache((token: string) => fetchPublic(api.orders.getByToken, { token }));

/** Resolves the token before anything streams (FLOW-05). */
export async function generateMetadata({
  params,
}: PageProps<"/porudzbina/[token]">): Promise<Metadata> {
  const { token } = await params;
  if (!(await loadOrder(token))) notFound();
  return tokenPageMetadata("Status porudžbine");
}

/** Tokenized order status with a live timeline (§10.6). The token is the capability. */
export default async function OrderStatusPage({ params }: PageProps<"/porudzbina/[token]">) {
  const { token } = await params;
  const [order, settings] = await Promise.all([loadOrder(token), getSettingsPublic()]);
  if (!order) notFound();
  // Only the channels the shop has filled in; no prompt at all when there are none (COPY-03).
  const contacts = contactLinkList(contactFromSettings(settings), `Porudžbina ${order.number}`);
  return (
    <div className="px-page pb-(--space-section) pt-8">
      <RevealText as="h1" className="type-h1 text-ink-1">
        Porudžbina
      </RevealText>
      <div className="mt-6">
        <OrderStatusView token={token} initial={order}>
          {contacts.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="type-body-s text-ink-2">
                Pitanje o porudžbini? Javite nam se i navedite njen broj, {order.number}.
              </p>
              <ContactActions links={contacts} location="order_status" />
            </div>
          ) : null}
        </OrderStatusView>
      </div>
    </div>
  );
}
