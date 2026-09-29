# SKLOP — Šta mora da obezbedi vlasnik / klijent

> Deo SKLOP dokumentacije — indeks: [README](README.md). Ova lista se dopunjuje u svakom koraku; na kraju (korak 23) spaja se u `docs/GO-LIVE.md`. Ništa odavde se ne prikazuje na sajtu kao „TODO" — sajt sakriva prazna polja dok se ne popune u podešavanjima.

Oznake: **[P0]** potrebno pre puštanja uživo · **[P1]** potrebno u prvim nedeljama · **[P2]** kada bude vremena.

## 1. Podaci firme (Admin → Podešavanja → Firma)
- [ ] **[P0]** Konačan naziv prodavnice (radni naziv je „SKLOP") i slogan; menja se u `config/site.ts` i podešavanjima.
- [ ] **[P0]** Pravni naziv, sedište, PIB, matični broj, registar (APR) — obavezno po Zakonu o elektronskoj trgovini.
- [ ] **[P0]** Adresa radnje za lično preuzimanje, link ka mapi.
- [ ] **[P0]** Telefoni, Viber i WhatsApp broj, e-mail za kupce.
- [ ] **[P0]** Radno vreme i praznici (placeholder: pon–pet 08–17, sub 08–14 — prikazuje se tek kad se unese).
- [ ] **[P0]** Tekući račun(i) i banka za predračun (plaćanje virmanom).
- [ ] **[P1]** Činjenice za početnu stranu („godine iskustva" i sl.) — samo istinite, bez izmišljenih podataka.

## 2. Poslovna pravila — potvrditi sa klijentom (BRIEF §6)
- [ ] **[P0]** Cene se čuvaju u parama, prikazuju u dinarima sa PDV 20 % — potvrditi.
- [ ] **[P0]** Format broja porudžbine `SK-GGGG-000123` i upita `UP-GGGG-000045` (prefiks se menja u podešavanjima) — potvrditi.
- [ ] **[P0]** Statusi porudžbine: nova → potvrđena → (spremna za preuzimanje | poslata) → (preuzeta | isporučena) → završena; otkazana; čeka deo — potvrditi nazive i tok.
- [ ] **[P0]** Statusi upita: nov → u obradi → ponuda poslata → prihvaćena / odbijena / istekla — potvrditi.
- [ ] **[P0]** Stanje se umanjuje kada se porudžbina **potvrdi** i vraća se pri otkazivanju — potvrditi.
- [ ] **[P0]** Prag „malo na stanju" (podrazumevano 3 kom.) i rok „po porudžbini".
- [ ] **[P0]** Dostava: lično preuzimanje 0 RSD; kurir pouzećem 450 RSD, besplatno iznad 10.000 RSD — potvrditi iznose.
- [ ] **[P0]** Kurirske službe (D Express, BEX, AKS, Post Express?) i linkovi za praćenje pošiljke.
- [ ] **[P0]** Rabat majstorima: Majstor 10 %, Majstor Plus 15 %, Partner 20 % — potvrditi i dopuniti izuzecima po kategoriji/proizvođaču.
- [ ] **[P0]** Minimalna marža 8 % iznad nabavne cene (bez PDV) — potvrditi.
- [ ] **[P1]** Odloženo plaćanje: rok 15 dana, limit po majstoru — potvrditi.
- [ ] **[P1]** Važenje ponude 7 dana; automatsko zatvaranje porudžbine 15 dana posle isporuke — potvrditi.
- [ ] **[P1]** Da li gost može da poruči bez naloga (podrazumevano: da) i da li su cene javne (podrazumevano: da).
- [ ] **[P1]** Da li je e-mail obavezan pri porudžbini (podrazumevano: telefon + e-mail).
- [ ] **[P1]** Ko plaća troškove povraćaja robe (podrazumevano: kupac).
- [ ] **[P2]** Demo podaci (šifre `DEMO-…`) brišu se jednim klikom — obrisati pre puštanja uživo (Admin → Podešavanja → Obriši demo podatke).

## 3. Pravni tekstovi — pregled pravnika
- [ ] **[P0]** Uslovi korišćenja, politika privatnosti, kolačići, dostava i plaćanje, reklamacije i povrat — šabloni su pisani po ZZPL (87/2018), Zakonu o elektronskoj trgovini, ZEK 35/2023 čl. 160 i **novom Zakonu o zaštiti potrošača („Sl. glasnik RS" 35/2026, primena od 2.8.2026)**; pravnik mora da ih pregleda.
- [ ] **[P0]** Da li se auto delovi smatraju „tehničkom robom" (rok za rešavanje reklamacije 15 ili 30 dana).
- [ ] **[P0]** Obrazac za odustanak od ugovora (14 dana od prijema robe).
- [ ] **[P1]** Rokovi čuvanja podataka (porudžbine 10 godina, upiti 2 godine, logovi pretrage 180 dana…) — potvrditi sa računovođom i pravnikom.
- [ ] **[P1]** Da li je potrebna evidencija radnji obrade (izuzetak za < 250 zaposlenih ima izuzetke).
- [ ] **[P2]** Tekst odricanja o korišćenju naziva VW/Audi/Škoda/SEAT/Cupra (nominativna upotreba).

## 4. E-mail (Resend)
- [ ] **[P0]** Nalog na Resend-u, verifikovan domen (SPF, DKIM, DMARC), `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, adresa pošiljaoca (`EMAIL_FROM`).
- [ ] **[P0]** Do tada sajt radi u režimu `log`: mejlovi (i kodovi za reset lozinke) vide se samo u Admin → Mejlovi.
- [ ] **[P1]** Adrese zaposlenih za obaveštenja i dnevni izveštaj u 08:00.

## 5. Oglasi i analitika
- [ ] **[P1]** GA4 ID, Google Ads ID i oznake konverzija (porudžbina, upit, registracija majstora).
- [ ] **[P1]** Meta Pixel ID i Conversions API token (`META_CAPI_TOKEN`), test event kod za proveru.
- [ ] **[P1]** Google Merchant Center: **Srbija trenutno nije podržana** za Shopping oglase/besplatne listinge (Google je 18.8.2026. povukao najavljeno proširenje) — feed je spreman, uključiti kada Srbija bude podržana.
- [ ] **[P1]** Meta katalog: proveriti u Commerce Manager-u podršku za RSD i Srbiju.
- [ ] **[P2]** Google Ads offline konverzije: preuzeti aktuelni CSV šablon iz naloga (GBRAID/WBRAID kolone nisu potvrđene) ili koristiti Data Manager.
- [ ] **[P1]** Google Business Profile i Search Console (prijava sitemape).

## 6. Katalog i podaci
- [ ] **[P0]** Primer izvoza iz knjigovodstvenog programa (xlsx/csv) da se proveri mapiranje kolona.
- [ ] **[P1]** Proveriti seed podatke vozila: modeli, generacije, godine, kodovi motora, VIN kodovi modela — označeni „seed – proveriti".
- [ ] **[P1]** Fotografije proizvoda (do tada se koriste Blender renderi kategorija).
- [ ] **[P2]** Spisak proizvođača delova koje prodaje i nivo kvaliteta (Original VAG / OEM / aftermarket).

## 7. Puštanje uživo (detalji u `docs/GO-LIVE.md`, korak 23)
- [ ] **[P0]** Domen i DNS; Vercel projekat; Convex produkcija i promenljive okruženja.
- [ ] **[P0]** Nalog vlasnika (lozinka iz `pipeline/env/ADMIN-CREDENTIALS.txt` se menja pri prvoj prijavi).
- [ ] **[P1]** Raspored backupa baze (Convex export).

## 8. Dizajn i brend (korak 03)
- [ ] **[P1]** Pogledati vizuelni pravac „Rendgen“ na `/lab/koncept` (od koraka 04 na `/styleguide`) i potvrditi: tamna prodavnica, jedna narandžasta boja (#FF6B1A) za akcije i izbor, svetla radna površina u adminu. Obrazloženje je u `docs/design/DESIGN-SYSTEM.md`.
- [ ] **[P1]** Konačan naziv prodavnice: tipografski logo se menja iz podešavanja; znak „izvučen deo“ (osnova sa ležištem i narandžasti deo izvučen iz nje) ne zavisi od naziva — javiti ako želite drugačiji znak.
- [ ] **[P2]** Kratki saveti u oblačićima 3D prikaza, po kategoriji (primer: „Pre zamene proverite broj na kućištu turbine.“) — pregledati i dopuniti iskustvom iz radnje.
- [ ] **[P2]** Rok slanja za poruku „Šaljemo danas ako poručite do …“ — prikazuje se samo ako se unese u podešavanjima; potvrditi da li to želite i do kog sata.
- [ ] **[P2]** Fotografije proizvoda (kad ih bude): tamnosiva ili srednje siva pozadina, ugao 3/4, deo zauzima oko 70 % kadra, bez ruku, rekvizita i znakova proizvođača vozila, najmanje 2000 px po dužoj strani.
