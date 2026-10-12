import type { Metadata } from "next";

import { formatRSD } from "@/lib/format/money";
import { getSettingsPublic, type PublicSettings } from "@/lib/server/catalog-cache";
import { ContentPageView, contentMetadata } from "@/components/content/ContentPageView";
import { StackedTable } from "@/components/content/StackedTable";
import { ROUTES } from "@/constants/routes";

export function generateMetadata(): Promise<Metadata> {
  return contentMetadata("dostava-i-placanje", ROUTES.delivery);
}

/** „Ab“ → „ab“, but abbreviations („SMS“) stay as they are. */
const lowerFirst = (s: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s);

/**
 * The payment methods of one delivery method as one sentence-case list („Pouzećem, virmanom
 * uz predračun ili odloženo plaćanje (odobreni majstori)“; COPY-17) — deferred payment is
 * only for approved mechanics, so the table says so.
 */
function paymentsFor(
  settings: PublicSettings,
  deliveryCode: PublicSettings["deliveryMethods"][number]["code"],
): string {
  const labels = settings.paymentMethods
    .filter((p) => p.deliveryCodes.includes(deliveryCode))
    .map((p, i) => {
      const label = p.code === "deferred" ? `${p.label} (odobreni majstori)` : p.label;
      return i === 0 ? label : lowerFirst(label);
    });
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} ili ${labels[labels.length - 1]}`;
}

/**
 * `/dostava-i-placanje`: the live delivery/payment table from settings between the intro and
 * the sections; the inquiry and the other documents beside the text.
 */
export default async function DeliveryPage() {
  const settings = await getSettingsPublic();
  const table = (
    <StackedTable
      caption="Načini dostave i cene"
      eager
      head={["Dostava", "Cena", "Rok", "Plaćanje"]}
      rows={settings.deliveryMethods.map((d) => ({
        key: d.code,
        cells: [
          d.label,
          <span key="price" className="tabular-nums">
            {d.pricePara === 0 ? "bez troška" : formatRSD(d.pricePara)}
            {d.freeOverPara ? (
              <span className="block type-caption text-ink-3">
                besplatno iznad {formatRSD(d.freeOverPara)}
              </span>
            ) : null}
          </span>,
          d.etaText,
          paymentsFor(settings, d.code),
        ],
      }))}
    />
  );
  return (
    <ContentPageView
      slug="dostava-i-placanje"
      path={ROUTES.delivery}
      kind="place"
      before={table}
    />
  );
}
