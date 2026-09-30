"use client";

/**
 * Event × channel matrix of staff notification preferences (in-app bell, e-mail), used for
 * one's own preferences (Podešavanja → Obaveštenja) and by the owner for any staff member
 * (Korisnici → Obaveštenja).
 */
import { Checkbox } from "@/components/ui/Checkbox";

export type StaffPrefs = {
  email: {
    orderNew: boolean;
    inquiryNew: boolean;
    mechanicNew: boolean;
    lowStock: boolean;
    reminders: boolean;
    digest: boolean;
  };
  inApp: {
    orderNew: boolean;
    inquiryNew: boolean;
    mechanicNew: boolean;
    lowStock: boolean;
    reminders: boolean;
  };
};

const ROWS = [
  ["orderNew", "Nova porudžbina (i prihvaćena ponuda)"],
  ["inquiryNew", "Novi upit, zahtev za novu ponudu"],
  ["mechanicNew", "Nova registracija majstora"],
  ["lowStock", "Malo na stanju (e-pošta najviše jednom na sat)"],
  ["reminders", "Podsetnici za neodgovorene"],
] as const;

export function NotificationPrefsMatrix({
  prefs,
  onChange,
  who = "",
}: {
  prefs: StaffPrefs;
  onChange: (next: StaffPrefs) => void;
  /** Appended to checkbox labels for screen readers („, Marko“). */
  who?: string;
}) {
  return (
    <table className="w-full max-w-xl border-collapse type-body-s">
      <caption className="sr-only">Obaveštenja po događaju i kanalu{who}</caption>
      <thead>
        <tr className="border-b border-line text-left type-label uppercase text-ink-3">
          <th scope="col" className="py-2">
            Događaj
          </th>
          <th scope="col" className="w-28 py-2 text-center">
            U aplikaciji
          </th>
          <th scope="col" className="w-24 py-2 text-center">
            E-pošta
          </th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map(([key, label]) => (
          <tr key={key} className="border-b border-line-faint">
            <th scope="row" className="py-1 pr-3 text-left font-normal">
              {label}
            </th>
            {(["inApp", "email"] as const).map((ch) => (
              <td key={ch} className="py-1 text-center">
                <span className="inline-flex">
                  <Checkbox
                    label={
                      <span className="sr-only">{`${label}, ${ch === "inApp" ? "u aplikaciji" : "e-pošta"}${who}`}</span>
                    }
                    checked={prefs[ch][key]}
                    onCheckedChange={(v) =>
                      onChange({ ...prefs, [ch]: { ...prefs[ch], [key]: v === true } })
                    }
                  />
                </span>
              </td>
            ))}
          </tr>
        ))}
        <tr>
          <th scope="row" className="py-1 pr-3 text-left font-normal">
            Dnevni pregled
          </th>
          <td className="py-1 text-center text-ink-4" aria-label="Ne postoji u aplikaciji">
            —
          </td>
          <td className="py-1 text-center">
            <span className="inline-flex">
              <Checkbox
                label={<span className="sr-only">{`Dnevni pregled, e-pošta${who}`}</span>}
                checked={prefs.email.digest}
                onCheckedChange={(v) =>
                  onChange({ ...prefs, email: { ...prefs.email, digest: v === true } })
                }
              />
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
