import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "@/convex/_generated/api";
import { site } from "@/config/site";
import { formatDate } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { formatPhone } from "@/lib/format/phone";
import { privateMetadata } from "@/lib/seo/metadata";
import { companyFromSettings, contactFromSettings } from "@/lib/settings/public";
import { fetchPublic } from "@/lib/server/convex";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { PrintButton } from "@/components/order/PrintButton";

export const metadata: Metadata = privateMetadata("Predračun");

/**
 * Printable predračun (pro-forma, ROUTES §B1): print theme, black on white; the seller block
 * comes from settings and hides empty lines. Legal form reviewed with the accountant
 * (docs/HUMAN-TODO.md).
 */
export default async function ProformaPage({ params }: PageProps<"/porudzbina/[token]/predracun">) {
  const { token } = await params;
  const [o, settings] = await Promise.all([
    fetchPublic(api.orders.getByToken, { token }),
    getSettingsPublic(),
  ]);
  if (!o) notFound();
  const company = companyFromSettings(settings);
  const contact = contactFromSettings(settings);
  const account = settings.company.bankAccounts[0];
  const seller = [
    company.legalName || settings.brand.name || site.brand.name,
    company.seat,
    company.pib ? `PIB ${company.pib}` : "",
    company.mb ? `MB ${company.mb}` : "",
    contact.phone,
    contact.email,
  ].filter(Boolean);
  const vatRate = settings.commerce.vatRateBp / 100;
  const net = o.totals.totalPara - o.totals.vatPara;

  return (
    <div
      data-theme="paper"
      data-reveal="off"
      className="bg-bg px-page py-10 text-ink-1 print:bg-white print:p-0"
    >
      <div className="mx-auto flex max-w-[52rem] flex-col gap-8 rounded-md bg-surface-1 p-8 print:rounded-none print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-1 type-body-s text-ink-2">
            {seller.map((line, i) => (
              <span key={i} className={i === 0 ? "type-h4 text-ink-1" : ""}>
                {line}
              </span>
            ))}
          </div>
          <div className="text-right">
            <h1 className="type-h2 text-ink-1">Predračun</h1>
            <p className="type-code-l">{o.number}</p>
            <p className="type-body-s text-ink-2">Datum: {formatDate(o.createdAt)}</p>
          </div>
        </div>
        <div className="grid gap-4 border-y border-line py-4 type-body-s sm:grid-cols-2">
          <div>
            <p className="type-label uppercase text-ink-3">Kupac</p>
            <p className="mt-1">
              {o.company ? o.company.name : `${o.contact.firstName} ${o.contact.lastName}`}
              {o.company ? (
                <span className="block text-ink-2">
                  PIB {o.company.pib}
                  {o.company.mb ? ` · MB ${o.company.mb}` : ""}
                </span>
              ) : null}
              <span className="block text-ink-2">
                {formatPhone(o.contact.phone)} · {o.contact.email}
              </span>
            </p>
          </div>
          <div>
            <p className="type-label uppercase text-ink-3">Uplata</p>
            <p className="mt-1">
              {account ? (
                <>
                  Račun: <span className="type-code">{account.account}</span> ({account.bank})
                  <span className="block text-ink-2">
                    Poziv na broj: <span className="type-code">{o.payment.reference}</span>
                  </span>
                </>
              ) : (
                <span className="text-ink-2">
                  Podatke za uplatu šaljemo uz potvrdu porudžbine. Poziv na broj:{" "}
                  <span className="type-code">{o.payment.reference}</span>
                </span>
              )}
            </p>
          </div>
        </div>
        <table className="w-full border-collapse type-body-s">
          <thead>
            <tr className="border-b border-line-strong text-left type-label uppercase text-ink-3">
              <th scope="col" className="py-2 pr-3">
                Artikal
              </th>
              <th scope="col" className="py-2 pr-3 text-right">
                Kol.
              </th>
              <th scope="col" className="py-2 pr-3 text-right">
                Cena sa PDV
              </th>
              <th scope="col" className="py-2 text-right">
                Iznos
              </th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((i, idx) => (
              <tr key={idx} className="border-b border-line">
                <td className="py-2 pr-3">
                  {i.name}
                  <span className="block type-caption text-ink-3">
                    {i.sku}
                    {i.oem ? ` · OEM ${i.oem}` : ""}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">{i.quantity}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatRSD(i.unitPricePara)}</td>
                <td className="py-2 text-right tabular-nums">{formatRSD(i.lineTotalPara)}</td>
              </tr>
            ))}
            <tr className="border-b border-line">
              <td className="py-2 pr-3" colSpan={3}>
                Dostava
              </td>
              <td className="py-2 text-right tabular-nums">{formatRSD(o.totals.deliveryPara)}</td>
            </tr>
          </tbody>
        </table>
        <dl className="ml-auto flex w-full max-w-xs flex-col gap-1 type-body-s">
          <div className="flex justify-between">
            <dt className="text-ink-2">Osnovica</dt>
            <dd className="tabular-nums">{formatRSD(net)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">PDV {vatRate} %</dt>
            <dd className="tabular-nums">{formatRSD(o.totals.vatPara)}</dd>
          </div>
          <div className="flex justify-between border-t border-line-strong pt-2 font-semibold">
            <dt>Za uplatu</dt>
            <dd className="tabular-nums">{formatRSD(o.totals.totalPara)}</dd>
          </div>
        </dl>
        <p className="type-caption text-ink-3">
          Predračun nije fiskalni račun. Robu rezervišemo do uplate; račun izdajemo pri isporuci.
        </p>
        <div className="print:hidden">
          <PrintButton />
        </div>
      </div>
    </div>
  );
}
