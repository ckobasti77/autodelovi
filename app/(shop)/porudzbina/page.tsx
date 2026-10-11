import type { Metadata } from "next";

import { formatPhone } from "@/lib/format/phone";
import { privateMetadata } from "@/lib/seo/metadata";
import { contactFromSettings } from "@/lib/settings/public";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { getViewer, viewerNames } from "@/lib/server/auth";
import { fetchAsUser } from "@/lib/server/convex";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { RevealText } from "@/components/text-reveal/RevealText";
import { CheckoutForm, type CheckoutConfig } from "@/components/checkout/CheckoutForm";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Porudžbina");

/** Checkout `/porudzbina` (§10.5): SSR shell, client form; noindex. */
export default async function CheckoutPage() {
  const [settings, viewer] = await Promise.all([getSettingsPublic(), getViewer()]);
  const mechanic =
    viewer?.mechanicStatus === "approved"
      ? await fetchAsUser(api.mechanicPortal.overview, {})
      : null;
  const contact = contactFromSettings(settings);
  const address = [
    contact.address.street,
    [contact.address.postalCode, contact.address.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const guestBlocked = !viewer && !settings.flags.guestCheckout;

  const config: CheckoutConfig = {
    deliveryMethods: settings.deliveryMethods.map((d) => ({
      code: d.code,
      label: d.label,
      description: d.description,
      pricePara: d.pricePara,
      ...(d.freeOverPara !== undefined ? { freeOverPara: d.freeOverPara } : {}),
      etaText: d.etaText,
    })),
    paymentMethods: settings.paymentMethods.map((p) => ({
      code: p.code,
      label: p.label,
      instructions: p.instructions,
      requires: p.requires,
      deliveryCodes: p.deliveryCodes,
    })),
    legal: { terms: settings.legalVersions.terms, privacy: settings.legalVersions.privacy },
    store: address ? { address, hours: contact.hours } : null,
    viewer: viewer
      ? {
          ...viewerNames(viewer),
          email: viewer.email ?? "",
          phone: viewer.phone ? formatPhone(viewer.phone) : "",
          creditEnabled: viewer.creditEnabled,
          ...(mechanic && mechanic.status === "approved"
            ? {
                mechanic: {
                  companyName: mechanic.companyName,
                  pib: mechanic.pib,
                  mb: mechanic.mb,
                  address: mechanic.address,
                  city: mechanic.city,
                  paymentTermsDays: mechanic.credit.paymentTermsDays,
                  availablePara: mechanic.credit.availablePara,
                },
              }
            : {}),
        }
      : null,
    vatRateBp: settings.commerce.vatRateBp,
  };

  return (
    <div className="px-page pb-(--space-section) pt-8">
      <RevealText as="h1" className="type-h1 text-ink-1">
        Porudžbina
      </RevealText>
      <p className="mt-2 max-w-[60ch] type-body-s text-ink-3" data-reveal="off">
        Bez plaćanja na sajtu. Potvrdu šaljemo e-poštom, a pre slanja vas zovemo ako nešto treba
        proveriti.
      </p>
      <div className="mt-8">
        {guestBlocked ? (
          <div className="flex flex-col items-start gap-4 panel p-6">
            <p className="type-body text-ink-2">
              Prijavite se da biste poručili. Korpa ostaje sačuvana.
            </p>
            <Button asChild variant="primary">
              <Link
                href={`${ROUTES.signIn}?next=${encodeURIComponent(ROUTES.checkout)}`}
                variant="unstyled"
              >
                Prijava
              </Link>
            </Button>
          </div>
        ) : (
          <CheckoutForm config={config} />
        )}
      </div>
    </div>
  );
}
