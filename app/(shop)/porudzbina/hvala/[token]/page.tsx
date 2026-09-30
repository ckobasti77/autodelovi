import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { contactLinkList } from "@/config/site";
import { tokenPageMetadata } from "@/lib/seo/metadata";
import { contactFromSettings } from "@/lib/settings/public";
import { fetchPublic } from "@/lib/server/convex";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { PAYMENT_REMINDER } from "@/lib/i18n/sr/shop";
import { Link } from "@/components/ui/Link";
import { RevealText } from "@/components/text-reveal/RevealText";
import { ContactActions } from "@/components/shell/ContactActions";
import { OrderStatusView } from "@/components/order/OrderStatusView";
import { PurchaseTracker } from "@/components/order/PurchaseTracker";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = tokenPageMetadata("Porudžbina je primljena");

/** Confirmation (§11.5): order number, what happens next, the live status below. */
export default async function OrderThanksPage({ params }: PageProps<"/porudzbina/hvala/[token]">) {
  const { token } = await params;
  const [order, settings] = await Promise.all([
    fetchPublic(api.orders.getByToken, { token }),
    getSettingsPublic(),
  ]);
  if (!order) notFound();
  const contacts = contactLinkList(contactFromSettings(settings), `Porudžbina ${order.number}`);
  return (
    <div className="px-page pb-(--space-section) pt-8">
      <PurchaseTracker
        orderNumber={order.number}
        valuePara={order.totals.totalPara}
        shippingPara={order.totals.deliveryPara}
        taxPara={order.totals.vatPara}
        items={order.items.map((i) => ({
          sku: i.sku,
          name: i.name,
          manufacturerName: i.manufacturerName,
          unitPricePara: i.unitPricePara,
          quantity: i.quantity,
        }))}
        userData={{
          email: order.contact.email,
          phone: order.contact.phone,
          firstName: order.contact.firstName,
          lastName: order.contact.lastName,
          city: order.delivery.address?.city ?? null,
        }}
      />
      <div className="flex max-w-[48rem] flex-col gap-4">
        <CheckCircleIcon size={40} weight="fill" aria-hidden="true" className="text-success" />
        <RevealText as="h1" className="type-display-l uppercase text-ink-1">
          Porudžbina je primljena.
        </RevealText>
        <p className="type-lead text-ink-2" data-reveal="off">
          Broj porudžbine je <span className="type-code-l text-ink-1">{order.number}</span>. Poslali
          smo potvrdu na {order.contact.email}; javićemo se kad je potvrdimo.
        </p>
        <p className="type-body text-ink-2">{PAYMENT_REMINDER[order.payment.method]}</p>
        <p className="type-body-s text-ink-3">
          Status pratite na{" "}
          <Link href={ROUTES.orderStatus(token)} variant="inline" reloadDocument>
            stranici porudžbine
          </Link>{" "}
          — sačuvajte link.
        </p>
        <ContactActions links={contacts} location="order_thanks" />
      </div>
      <div className="mt-12 border-t border-line pt-10">
        <OrderStatusView token={token} initial={order} />
      </div>
    </div>
  );
}
