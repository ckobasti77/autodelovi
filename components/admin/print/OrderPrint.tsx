/**
 * Printable staff documents (Server Component): predračun (pro-forma with prices, VAT and
 * payment details) and otpremnica (delivery note with quantities and signatures, no
 * prices). Black on white, A4 margins from print CSS; seller data from settings, empty
 * lines hidden. Legal wording is reviewed with the accountant (docs/HUMAN-TODO.md).
 */
import type { FunctionReturnType } from "convex/server";

import type { api } from "@/convex/_generated/api";
import { missingCompanyFields } from "@/lib/domain/company";
import { formatDate } from "@/lib/format/date";
import { formatRSD } from "@/lib/format/money";
import { formatPhone } from "@/lib/format/phone";
import { DELIVERY_LABEL, PAYMENT_LABEL } from "@/lib/i18n/sr/shop";
import { CompanySetupNotice } from "@/components/admin/ui";

type Detail = NonNullable<FunctionReturnType<typeof api.ordersAdmin.get>>;
type Settings = FunctionReturnType<typeof api.settings.getAdmin>;

function sellerLines(s: Settings): string[] {
  const c = s.company;
  const seat = [c.address.street, [c.address.postalCode, c.address.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  return [
    c.legalName || c.displayName || s.brand.name,
    seat,
    c.pib ? `PIB ${c.pib}` : "",
    c.mb ? `MB ${c.mb}` : "",
    c.phones[0] ? `Tel. ${formatPhone(c.phones[0].e164)}` : "",
    c.email ?? "",
  ].filter(Boolean);
}

function buyerLines(o: Detail["order"]): string[] {
  const person = `${o.contact.firstName} ${o.contact.lastName}`;
  const c = o.company;
  return [
    c ? c.name : person,
    c?.address ? `${c.address.street}, ${c.address.postalCode} ${c.address.city}` : "",
    c ? `PIB ${c.pib}${c.mb ? ` · MB ${c.mb}` : ""}` : "",
    c ? `Kontakt: ${person}` : "",
    // A customer without e-mail (phone order) gets the phone alone, not a dangling „ · “.
    [formatPhone(o.contact.phone), o.contact.email].filter(Boolean).join(" · "),
  ].filter(Boolean);
}

function Header({ title, o, s }: { title: string; o: Detail["order"]; s: Settings }) {
  const seller = sellerLines(s);
  return (
    <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-ink-1 pb-4">
      <div className="flex flex-col gap-0.5 type-body-s text-ink-2">
        {seller.map((line, i) => (
          <span key={i} className={i === 0 ? "text-[1.0625rem] font-bold text-ink-1" : ""}>
            {line}
          </span>
        ))}
      </div>
      <div className="text-right">
        <h1 className="text-[1.5rem] font-bold uppercase tracking-[0.04em] text-ink-1">{title}</h1>
        <p className="type-code-l text-ink-1">{o.number}</p>
        {/* eslint-disable-next-line react-hooks/purity -- server-rendered print document: the issue date is the request time */}
        <p className="type-body-s text-ink-2">Datum: {formatDate(Date.now())}</p>
        <p className="type-body-s text-ink-2">Porudžbina od {formatDate(o.createdAt)}</p>
      </div>
    </div>
  );
}

export function ProformaDocument({ data, settings }: { data: Detail; settings: Settings }) {
  const o = data.order;
  const vatRate = settings.commerce.vatRateBp / 100;
  const net = o.totalPara - o.vatPara;
  const account = settings.company.bankAccounts[0];
  return (
    <article className="print-sheet flex flex-col gap-6">
      <CompanySetupNotice
        missing={missingCompanyFields(settings.company)}
        className="print:hidden"
      />
      <Header title="Predračun" o={o} s={settings} />
      <div className="grid gap-4 type-body-s sm:grid-cols-2">
        <div>
          <p className="type-label uppercase text-ink-3">Kupac</p>
          {buyerLines(o).map((l, i) => (
            <p key={i} className={i === 0 ? "font-semibold text-ink-1" : "text-ink-2"}>
              {l}
            </p>
          ))}
        </div>
        <div>
          <p className="type-label uppercase text-ink-3">Uplata</p>
          {account ? (
            <>
              <p>
                Račun: <span className="type-code">{account.account}</span> ({account.bank})
              </p>
              <p>
                Poziv na broj: <span className="type-code">{o.paymentReference}</span>
              </p>
              <p>Svrha: Plaćanje po predračunu {o.number}</p>
            </>
          ) : (
            <p className="text-ink-2">
              Poziv na broj: <span className="type-code">{o.paymentReference}</span>
            </p>
          )}
          <p className="text-ink-2">Način plaćanja: {PAYMENT_LABEL[o.paymentMethod]}</p>
        </div>
      </div>
      <table className="w-full border-collapse type-body-s">
        <thead>
          <tr className="border-b border-ink-1 text-left type-label uppercase text-ink-2">
            <th scope="col" className="py-2 pr-2">
              R. br.
            </th>
            <th scope="col" className="py-2 pr-2">
              Šifra
            </th>
            <th scope="col" className="py-2 pr-2">
              Naziv
            </th>
            <th scope="col" className="py-2 pr-2 text-right">
              Kol.
            </th>
            <th scope="col" className="py-2 pr-2 text-right">
              Cena sa PDV-om
            </th>
            <th scope="col" className="py-2 text-right">
              Iznos
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((i, idx) => (
            <tr key={i._id} className="border-b border-line">
              <td className="py-1.5 pr-2 tabular-nums">{idx + 1}.</td>
              <td className="py-1.5 pr-2 type-code-s">{i.sku}</td>
              <td className="py-1.5 pr-2">
                {i.name}
                <span className="block type-caption text-ink-3">
                  {i.manufacturerName}
                  {i.oem ? ` · OEM ${i.oem}` : ""}
                </span>
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{i.quantity}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{formatRSD(i.unitPricePara)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatRSD(i.lineTotalPara)}</td>
            </tr>
          ))}
          <tr className="border-b border-line">
            <td className="py-1.5 pr-2" colSpan={5}>
              Dostava — {DELIVERY_LABEL[o.deliveryMethod]}
            </td>
            <td className="py-1.5 text-right tabular-nums">{formatRSD(o.deliveryPara)}</td>
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
          <dd className="tabular-nums">{formatRSD(o.vatPara)}</dd>
        </div>
        <div className="flex justify-between border-t-2 border-ink-1 pt-2 text-[1rem] font-bold">
          <dt>Za uplatu</dt>
          <dd className="tabular-nums">{formatRSD(o.totalPara)}</dd>
        </div>
      </dl>
      <p className="type-caption text-ink-3">
        Predračun nije fiskalni račun. Robu rezervišemo do uplate; račun izdajemo pri isporuci.
        {settings.company.registryNote ? ` ${settings.company.registryNote}` : ""}
      </p>
    </article>
  );
}

export function DeliveryNoteDocument({
  data,
  settings,
  notice = true,
}: {
  data: Detail;
  settings: Settings;
  /** Batch printing shows the missing-data notice once, above the first sheet. */
  notice?: boolean;
}) {
  const o = data.order;
  const address = o.deliveryAddress;
  return (
    <article className="print-sheet flex flex-col gap-6">
      <CompanySetupNotice
        missing={
          notice ? missingCompanyFields(settings.company).filter((f) => f !== "bankAccount") : []
        }
        className="print:hidden"
      />
      <Header title="Otpremnica" o={o} s={settings} />
      <div className="grid gap-4 type-body-s sm:grid-cols-2">
        <div>
          <p className="type-label uppercase text-ink-3">Primalac</p>
          {buyerLines(o).map((l, i) => (
            <p key={i} className={i === 0 ? "font-semibold text-ink-1" : "text-ink-2"}>
              {l}
            </p>
          ))}
        </div>
        <div>
          <p className="type-label uppercase text-ink-3">Isporuka</p>
          <p>{DELIVERY_LABEL[o.deliveryMethod]}</p>
          {address ? (
            <p className="text-ink-2">
              {address.street}, {address.postalCode} {address.city}
              {address.note ? ` (${address.note})` : ""}
            </p>
          ) : null}
          {o.trackingNumber ? (
            <p className="text-ink-2">
              Broj pošiljke: <span className="type-code">{o.trackingNumber}</span>
            </p>
          ) : null}
          <p className="text-ink-2">Plaćanje: {PAYMENT_LABEL[o.paymentMethod]}</p>
        </div>
      </div>
      <table className="w-full border-collapse type-body-s">
        <thead>
          <tr className="border-b border-ink-1 text-left type-label uppercase text-ink-2">
            <th scope="col" className="py-2 pr-2">
              R. br.
            </th>
            <th scope="col" className="py-2 pr-2">
              Šifra
            </th>
            <th scope="col" className="py-2 pr-2">
              OEM
            </th>
            <th scope="col" className="py-2 pr-2">
              Naziv
            </th>
            <th scope="col" className="py-2 pr-2 text-right">
              Kol.
            </th>
            <th scope="col" className="w-16 py-2 text-center">
              Izdato
            </th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((i, idx) => (
            <tr key={i._id} className="border-b border-line">
              <td className="py-2 pr-2 tabular-nums">{idx + 1}.</td>
              <td className="py-2 pr-2 type-code-s">{i.sku}</td>
              <td className="py-2 pr-2 type-code-s">{i.oem ?? "—"}</td>
              <td className="py-2 pr-2">
                {i.name}
                <span className="block type-caption text-ink-3">{i.manufacturerName}</span>
              </td>
              <td className="py-2 pr-2 text-right font-semibold tabular-nums">{i.quantity}</td>
              <td className="py-2 text-center">
                <span aria-hidden="true" className="inline-block size-4 border border-ink-2" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="type-body-s">
        Ukupno komada:{" "}
        <span className="font-semibold tabular-nums">
          {data.items.reduce((s, i) => s + i.quantity, 0)}
        </span>
      </p>
      {o.customerNote ? (
        <p className="type-body-s text-ink-2">Napomena kupca: {o.customerNote}</p>
      ) : null}
      <div className="mt-10 grid grid-cols-2 gap-12 type-body-s">
        <div className="border-t border-ink-2 pt-1 text-center text-ink-2">Robu izdao</div>
        <div className="border-t border-ink-2 pt-1 text-center text-ink-2">Robu primio</div>
      </div>
    </article>
  );
}
