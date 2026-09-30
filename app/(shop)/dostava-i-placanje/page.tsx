import type { Metadata } from "next";

import { formatRSD } from "@/lib/format/money";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { ContentPageView, contentMetadata } from "@/components/content/ContentPageView";
import { ROUTES } from "@/constants/routes";

export function generateMetadata(): Promise<Metadata> {
  return contentMetadata("dostava-i-placanje", ROUTES.delivery);
}

/** `/dostava-i-placanje`: the live delivery/payment table from settings above the text. */
export default async function DeliveryPage() {
  const settings = await getSettingsPublic();
  const table = (
    <div className="overflow-x-auto rounded-sm border border-line" data-reveal="off">
      <table className="w-full min-w-[30rem] border-collapse type-body-s">
        <caption className="sr-only">Načini dostave i cene</caption>
        <thead className="bg-surface-2">
          <tr>
            {["Dostava", "Cena", "Rok", "Plaćanje"].map((h) => (
              <th key={h} scope="col" className="border-b border-line-strong px-3 py-2.5 text-left type-label uppercase text-ink-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {settings.deliveryMethods.map((d) => (
            <tr key={d.code} className="border-b border-line last:border-b-0 align-top">
              <th scope="row" className="px-3 py-3 text-left font-semibold text-ink-1">
                {d.label}
              </th>
              <td className="px-3 py-3 tabular-nums text-ink-2">
                {d.pricePara === 0 ? "bez troška" : formatRSD(d.pricePara)}
                {d.freeOverPara ? (
                  <span className="block type-caption text-ink-3">besplatno iznad {formatRSD(d.freeOverPara)}</span>
                ) : null}
              </td>
              <td className="px-3 py-3 text-ink-2">{d.etaText}</td>
              <td className="px-3 py-3 text-ink-2">
                {settings.paymentMethods
                  .filter((p) => p.deliveryCodes.includes(d.code))
                  .map((p) => p.label)
                  .join(", ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return <ContentPageView slug="dostava-i-placanje" path={ROUTES.delivery} before={table} />;
}
