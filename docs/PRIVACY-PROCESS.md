# SKLOP — Lični podaci: popis, rokovi čuvanja i zahtevi kupaca

> Deo SKLOP dokumentacije — indeks: [README](README.md). Tehnička pravila: [SECURITY §L5](SECURITY.md), pregled: [SECURITY-AUDIT](SECURITY-AUDIT.md). Zakon o zaštiti podataka o ličnosti („Sl. glasnik RS“ 87/2018, ZZPL). **Tekst nije pravni savet — pravnik treba da potvrdi rokove i osnove (HUMAN-TODO §3).**

## 1. Koje podatke sajt čuva

| Podaci | Gde (tabela) | Svrha i osnov | Rok čuvanja | Kako se briše |
|---|---|---|---|---|
| Porudžbine: ime, telefon, e-pošta, adresa, firma, stavke, iznosi, napomena | `orders`, `orderItems`, `orderEvents` | ugovor, knjigovodstvena obaveza | 10 godina (potvrditi sa knjigovođom) | anonimizacija na zahtev (ostaju iznosi, stavke, firma) |
| Upiti: ime, kontakt, poruka, broj šasije, fotografije | `inquiries`, `quotes`, `inquiryEvents`, fajlovi | predugovorni odnos | upit bez porudžbine 2 godine, fotografije 1 godina (**ručno**, vidi §4) | na zahtev: brisanje (sa fotografijama) |
| Nalog kupca: e-pošta, ime, telefon, pristanak na ponude | `users`, `authAccounts`, sesije | ugovor | dok kupac ne zatraži brisanje ili 3 godine neaktivnosti (**ručno**) | na zahtev: brisanje naloga i prijave |
| Sačuvana vozila (VIN, tablice), omiljeni artikli, korpa | `savedVehicles`, `favorites`, `carts` | ugovor | dok nalog postoji; korpa gosta 30 dana neaktivnosti (**automatski**) | na zahtev |
| Profil majstora: firma, PIB, MB, kontakt osoba, telefon, e-pošta, adresa | `mechanicProfiles` | ugovor (B2B) | dok je aktivan + 3 godine (**ručno**) | na zahtev: kontakt osoba i kontakti se anonimizuju, firma ostaje |
| „Javi mi kad stigne“: e-pošta | `backInStockSubscriptions` | pristanak | 30 dana posle obaveštenja, najviše 12 meseci (**automatski**) | odjava iz mejla ili na zahtev |
| Pretrage | `searchLogs` | legitimni interes (asortiman) | 180 dana (**automatski**), bez IP adrese | — |
| Zapisi o kolačićima (izbor, vreme, heš pregledača) | `consentRecords` | dokaz pristanka | 2 godine (**automatski**) | pri brisanju naloga zapis ostaje bez veze sa osobom |
| Poslati mejlovi | `emailLog` | evidencija, podrška | sadržaj 90 dana, zaglavlja 2 godine (**automatski**) | pri anonimizaciji se brišu kopije vezane za porudžbine, upite i nalog |
| Oglasi: oznake klika (gclid, fbclid…), `fbp`/`fbc` | na porudžbini/upitu/profilu | pristanak na oglase | 180 dana, zatim se brišu (**automatski**) | pri anonimizaciji odmah |
| IP adresa i pregledač za Meta Conversions API | uz događaj | pristanak na oglase | do slanja, najviše 7 dana (**automatski**) | — |
| Revizija (ko je šta promenio) | `auditLog` | bezbednost, evidencija | 5 godina (**automatski**) | ne briše se na zahtev (bezbednosni zapis) |

**Automatski** = noćni posao u Convexu (`automations.nightly`, 02:30/03:30 po beogradskom vremenu). **Ručno** = pregled jednom godišnje (§4).

Obrađivači (podaci van Srbije — pravnik da proveri iznošenje): Convex (baza; razvojna je u EU regionu — produkciju napraviti takođe u EU), Vercel (hosting), Resend (slanje mejlova), a samo uz pristanak na kolačiće Google (Analytics, Ads) i Meta (Pixel, Conversions API).

## 2. Zahtev kupca: uvid u podatke ili kopija („šta sve imate o meni“)

Rok za odgovor: **30 dana** od prijema (može se produžiti za još 60 uz obaveštenje kupcu).

1. Proverite identitet: odgovarate samo na adresu e-pošte ili broj telefona koji već postoje u porudžbini/nalogu. Ne šaljite podatke na novu adresu.
2. Admin → **Privatnost** (samo vlasnik). Za kupca sa nalogom najlakše: Admin → Kupci → kupac → „Lični podaci“ → „Izvoz ili anonimizacija“. Za kupca bez naloga upišite e-poštu iz porudžbine.
3. „Preuzmi sve podatke (JSON)“ — fajl sadrži nalog, profil majstora, porudžbine (i gostujuće sa istom e-poštom), upite, vozila, omiljene artikle, pretplate i zapise o kolačićima. Izvoz se beleži u reviziji.
4. Pošaljite fajl kupcu (lozinkom zaštićena arhiva ili lično); zabeležite datum odgovora.

## 3. Zahtev kupca: brisanje („zaboravite me“)

1. Isti koraci 1–2 kao gore; pre brisanja preporučljivo je napraviti izvoz (§2) i sačuvati ga uz zahtev.
2. „Anonimizuj kupca“ → upišite **ANONIMIZUJ** → potvrdite. Rezultat se prikazuje na strani.
3. Šta se dešava:
   - **porudžbine ostaju** (knjigovodstvo), ali bez imena, telefona, e-pošte, ulice, napomene i broja šasije; grad, poštanski broj, stavke, iznosi i podaci firme (PIB) ostaju;
   - **upiti bez porudžbine se brišu** zajedno sa ponudama i fotografijama; upiti koji su postali porudžbina ostaju bez ličnih podataka;
   - brišu se sačuvana vozila, omiljeni artikli, korpe, pretplate „javi mi“, obaveštenja u nalogu, beleške osoblja o kupcu i kopije mejlova;
   - profil majstora: kontakt osoba, telefon, e-pošta i adresa se brišu, firma ostaje, profil se suspenduje;
   - **nalog za prijavu se briše** (kupac više ne može da se prijavi; može da napravi novi);
   - u reviziji ostaje samo ko je i kada pokrenuo anonimizaciju, bez podataka kupca.
4. Nalog zaposlenog se ovde ne može anonimizovati — prvo mu vlasnik oduzme ulogu (Admin → Korisnici).
5. Ako je kupac podatke dao i telefonom/mejlom van sajta (npr. u vašem knjigovodstvenom programu), obrišite ih i tamo.

Ograničenja: kopije u rezervnim kopijama baze (backup) nestaju kad istekne njihov rok čuvanja (BACKUPS §2); posle vraćanja baze iz backupa anonimizaciju treba ponoviti za zahteve primljene posle tog backupa (zato vodite spisak zahteva).

## 4. Godišnji pregled (ručni rokovi)

Jednom godišnje (predlog: januar) vlasnik:
- anonimizuje naloge starije od 3 godine bez ijedne porudžbine u tom periodu (Admin → Kupci: datum naloga i broj porudžbina);
- anonimizuje upite bez porudžbine starije od 2 godine i profile majstora neaktivne duže od 3 godine;
- proveri da li se lista obrađivača (§1) promenila.

## 5. Pristanak na kolačiće

- Baner pita pre bilo kakvog merenja; bez pristanka ne ide nijedan zahtev ka Googleu ni Meti (Consent Mode v2).
- Svaki izbor se beleži (`consentRecords`: nasumični id iz kolačića `sk_consent`, izbor, verzija politike, vreme, heš pregledača — bez IP adrese); izbor važi 180 dana i može se promeniti preko linka „Kolačići“ u podnožju.
- Stranice sa tajnim linkom (status porudžbine, upita, odjava, pozivnica) nikad ne šalju tajni deo adrese Googleu ni Meti.

## 6. Evidencija zahteva

Vodite jednostavnu tabelu: datum prijema, ko (e-pošta/telefon), vrsta (uvid/brisanje/ispravka/prigovor), datum odgovora, šta je urađeno. U reviziji sajta (Admin → Revizija, radnje „Privatnost: …“) vidi se da je izvoz ili anonimizacija urađena.

Ispravka podataka: kupac sam menja profil u „Moj nalog“; porudžbinu ispravlja osoblje u adminu (beleži se u reviziji).
