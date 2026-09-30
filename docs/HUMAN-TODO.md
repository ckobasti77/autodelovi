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
- [ ] **[P1]** Odloženo plaćanje: rok 15 dana, limit po majstoru — potvrditi. Limit i rok se podešavaju po majstoru (Admin → Majstori → majstor → Uslovi); prazan limit znači „bez limita“.
- [ ] **[P1]** Majstorski nalog: na sajtu piše da registraciju proveravate „u toku radnog dana“ i da upiti servisa „idu prvi na red“ — potvrditi da tako i radite (tekst je na stranama `/za-majstore`, `/za-majstore/hvala` i u čestim pitanjima „Za majstore“, koja menjate u Admin → Sadržaj).
- [ ] **[P2]** Ko sme da dobije majstorski nalog (samo registrovane firme i radnje sa PIB-om, ili i fizička lica koja popravljaju vozila?) — forma trenutno traži PIB i matični broj.
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
- [ ] **[P1]** Tekst odricanja o korišćenju naziva VW/Audi/Škoda/SEAT/Cupra (nominativna upotreba) — nacrt je od koraka 04 u podnožju sajta: „Volkswagen, Audi, Škoda, SEAT i Cupra su registrovani žigovi svojih vlasnika. Nazive marki koristimo samo da bismo označili vozila kojima su delovi namenjeni; SKLOP nije povezan sa proizvođačima vozila niti je njihov ovlašćeni zastupnik.“ Pravnik da potvrdi ili izmeni.

- [ ] **[P0] Pregled tekstova na sajtu (korak 12)** — stranice `/uslovi-koriscenja`, `/politika-privatnosti`, `/kolacici`, `/dostava-i-placanje`, `/reklamacije-i-povrat` su objavljene kao šabloni (u bazi označene „potreban pravni pregled“). Pravnik da proveri naročito: rokove iz novog Zakona o zaštiti potrošača (odustanak 14 dana, odgovor na reklamaciju, rok rešavanja 15/30 dana), izuzetke od prava na odustanak (deo naručen po broju šasije), prenos podataka van Srbije (hosting Convex/Vercel, slanje mejlova), rokove čuvanja podataka i pomen tela za vansudsko rešavanje sporova. Izmene se unose u Admin → Sadržaj (korak 15).
- [ ] **[P1] Sesijski kolačić izvora posete `sk_attr_s`** (oznake kampanje i izvor dolaska, bez ličnih podataka, briše se zatvaranjem pregledača) — pravnik da potvrdi da sme bez pristanka kao deo evidencije porudžbine; ako ne sme, isključuje se do izbora u baneru za kolačiće (korak 19).
- [ ] **[P1] Predračun** (`/porudzbina/<token>/predracun`) — računovođa da potvrdi obavezne elemente predračuna (tekući račun, poziv na broj, napomena „nije fiskalni račun“); tekući račun se unosi u Admin → Podešavanja → Firma.
- [ ] **[P1] Nivoi rabata su javno prikazani** na `/za-majstore` i na početnoj (Majstor 10 %, Majstor Plus 15 %, Partner 20 %) — potvrdite da procenti smeju da budu javni i da su tačni.
- [ ] **[P2] Česta pitanja na početnoj** — odgovori su napisani prema pravilima prodavnice iz ovog plana (plaćanje, dostava, povrat, VIN); proverite ih i po potrebi izmenite (Admin → Sadržaj, korak 15).
- [ ] **[P2] „O nama“ i „Kontakt“** — tekstovi su opšti i bez izmišljenih podataka; dopunite ih pravim podacima o radnji (adresa, radno vreme, telefon, Viber; kanali bez podataka se na sajtu ne prikazuju).

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
- [ ] **[P0]** Upisati adresu sajta u `NEXT_PUBLIC_SITE_URL` (npr. `https://www.domen.rs`) — koristi se za kanonske adrese i slike za deljenje; do tada sajt koristi `http://localhost:3000`.
- [ ] **[P1]** Dok podešavanja u adminu ne postoje, kontakt se može privremeno upisati kao promenljive okruženja: `NEXT_PUBLIC_CONTACT_PHONE`, `NEXT_PUBLIC_CONTACT_VIBER`, `NEXT_PUBLIC_CONTACT_WHATSAPP`, `NEXT_PUBLIC_CONTACT_EMAIL`. Prazno polje = kanal se ne prikazuje (Viber se prikazuje samo ako je upisan poseban Viber broj).
- [ ] **[P0]** Nalog vlasnika (lozinka iz `pipeline/env/ADMIN-CREDENTIALS.txt` se menja pri prvoj prijavi).
- [ ] **[P1]** Raspored backupa baze (Convex export).

## 8. Dizajn i brend (korak 03)
- [ ] **[P1]** Pogledati vizuelni pravac „Rendgen“ na `/styleguide` (stara adresa `/lab/koncept` preusmerava tamo) i potvrditi: tamna prodavnica, jedna narandžasta boja (#FF6B1A) za akcije i izbor, svetla radna površina u adminu. Obrazloženje je u `docs/design/DESIGN-SYSTEM.md`.
- [ ] **[P1]** Konačan naziv prodavnice: tipografski logo se menja iz podešavanja; znak „izvučen deo“ (osnova sa ležištem i narandžasti deo izvučen iz nje) ne zavisi od naziva — javiti ako želite drugačiji znak.
- [ ] **[P2]** Kratki saveti u oblačićima 3D prikaza, po kategoriji (primer: „Pre zamene proverite broj na kućištu turbine.“) — pregledati i dopuniti iskustvom iz radnje.
- [ ] **[P2]** Rok slanja za poruku „Šaljemo danas ako poručite do …“ — prikazuje se samo ako se unese u podešavanjima; potvrditi da li to želite i do kog sata.
- [ ] **[P2]** Fotografije proizvoda (kad ih bude): tamnosiva ili srednje siva pozadina, ugao 3/4, deo zauzima oko 70 % kadra, bez ruku, rekvizita i znakova proizvođača vozila, najmanje 2000 px po dužoj strani.

## 9. Seed podaci — proveriti (korak 05)
Oznaka: **seed – proveriti**. Podaci su uneti po opšte poznatim podacima o vozilima prodavanim u Srbiji, ali ih pre puštanja uživo treba proveriti (Admin → Vozila, od koraka 15).

- [ ] **[P1] seed – proveriti: modeli, generacije, godine i VIN kodovi modela** (pozicije 7–8 VIN-a):
  - Volkswagen Golf: Golf IV (1997–2006, VIN kod 1J); Golf V (2003–2009, VIN kod 1K); Golf VI (2008–2013, VIN kod 1K,5K); Golf VII (2012–2020, VIN kod 5G,AU); Golf VIII (2019–danas, VIN kod CD)
  - Volkswagen Passat: Passat B5 (1996–2005, VIN kod 3B); Passat B6 (2005–2010, VIN kod 3C); Passat B7 (2010–2014, VIN kod 3C,36); Passat B8 (2014–2023, VIN kod 3G)
  - Volkswagen Polo: Polo IV (2001–2009, VIN kod 9N); Polo V (2009–2017, VIN kod 6R,6C); Polo VI (2017–danas, VIN kod AW)
  - Volkswagen Caddy: Caddy III (2003–2020, VIN kod 2K); Caddy V (2020–danas, VIN kod SB)
  - Volkswagen Touran: Touran I (2003–2015, VIN kod 1T); Touran II (2015–danas, VIN kod 5T)
  - Volkswagen Tiguan: Tiguan I (2007–2016, VIN kod 5N); Tiguan II (2016–2024, VIN kod AD,BW)
  - Audi A3: A3 (8L) (1996–2003, VIN kod 8L); A3 (8P) (2003–2013, VIN kod 8P); A3 (8V) (2012–2020, VIN kod 8V); A3 (8Y) (2020–danas, VIN kod 8Y,GY)
  - Audi A4: A4 B5 (1994–2001, VIN kod 8D); A4 B6 (2000–2004, VIN kod 8E); A4 B7 (2004–2008, VIN kod 8E,8H); A4 B8 (2007–2015, VIN kod 8K); A4 B9 (2015–danas, VIN kod 8W)
  - Audi A6: A6 C5 (1997–2004, VIN kod 4B); A6 C6 (2004–2011, VIN kod 4F); A6 C7 (2011–2018, VIN kod 4G); A6 C8 (2018–danas, VIN kod 4A)
  - Škoda Octavia: Octavia I (1996–2010, VIN kod 1U); Octavia II (2004–2013, VIN kod 1Z); Octavia III (2012–2020, VIN kod 5E,NE); Octavia IV (2019–danas, VIN kod NX)
  - Škoda Fabia: Fabia I (1999–2007, VIN kod 6Y); Fabia II (2007–2014, VIN kod 5J); Fabia III (2014–2021, VIN kod NJ); Fabia IV (2021–danas, VIN kod PJ)
  - Škoda Superb: Superb I (2001–2008, VIN kod 3U); Superb II (2008–2015, VIN kod 3T); Superb III (2015–2024, VIN kod 3V)
  - Škoda Rapid: Rapid (2012–2019, VIN kod NH)
  - Škoda Kodiaq: Kodiaq I (2016–2024, VIN kod NS)
  - Škoda Karoq: Karoq (2017–danas, VIN kod NU)
  - SEAT Leon: Leon I (1999–2005, VIN kod 1M); Leon II (2005–2012, VIN kod 1P); Leon III (2012–2020, VIN kod 5F); Leon IV (2020–danas, VIN kod KL)
  - SEAT Ibiza: Ibiza III (2002–2008, VIN kod 6L); Ibiza IV (2008–2017, VIN kod 6J,6P); Ibiza V (2017–danas, VIN kod KJ)
  - SEAT Ateca: Ateca (2016–danas, VIN kod KH)
  - Cupra Formentor: Formentor (2020–danas, VIN kod KM)
  - Cupra Leon: Leon (KL) (2020–danas, VIN kod KL)
  - Cupra Ateca: Ateca (2018–danas, VIN kod KH)
- [ ] **[P1] seed – proveriti: kodovi motora, snaga i gorivo** — 1.4 16V 55 kW (AXP,BCA; benzin; 55 kW / 75 KS) · 1.6 8V 75 kW (AKL,AVU,BFQ,BSE; benzin; 75 kW / 102 KS) · 1.8 T 110 kW (AGU,ARZ,AUM; benzin; 110 kW / 150 KS) · 1.2 HTP 44 kW (AWY,BMD; benzin; 44 kW / 60 KS) · 1.2 TSI 77 kW (CBZB; benzin; 77 kW / 105 KS) · 1.4 TSI 90 kW (CAXA; benzin; 90 kW / 122 KS) · 1.4 TSI 110 kW (CZDA; benzin; 110 kW / 150 KS) · 1.0 TSI 81 kW (CHZD,DKLA; benzin; 81 kW / 110 KS) · 1.5 TSI 110 kW (DADA,DPCA; benzin; 110 kW / 150 KS) · 2.0 TFSI 147 kW (BWA,AXX; benzin; 147 kW / 200 KS) · 2.0 TSI 162 kW (CHHB; benzin; 162 kW / 220 KS) · 1.4 TDI 55 kW (AMF,BNM; dizel; 55 kW / 75 KS) · 1.9 TDI 66 kW (ALH; dizel; 66 kW / 90 KS) · 1.9 TDI 74 kW (ATD,AXR; dizel; 74 kW / 100 KS) · 1.9 TDI 77 kW (BKC,BXE,BLS; dizel; 77 kW / 105 KS) · 1.9 TDI 96 kW (ASZ,AVF; dizel; 96 kW / 130 KS) · 2.0 TDI 103 kW (PD) (BKD,AZV,BMM; dizel; 103 kW / 140 KS) · 1.2 TDI 55 kW (CFWA; dizel; 55 kW / 75 KS) · 1.6 TDI 77 kW (CAYC,CLHA; dizel; 77 kW / 105 KS) · 2.0 TDI 103 kW (CR) (CBAB,CFFB; dizel; 103 kW / 140 KS) · 2.0 TDI 110 kW (CRLB,DFGA; dizel; 110 kW / 150 KS) · 2.0 TDI 140 kW (CUAA,DFHA; dizel; 140 kW / 190 KS) · 2.5 TDI V6 132 kW (AKE,BDH; dizel; 132 kW / 180 KS) · 2.7 TDI 132 kW (BPP,CANK; dizel; 132 kW / 180 KS) · 3.0 TDI 171 kW (ASB,BMK; dizel; 171 kW / 233 KS).
- [ ] **[P1] seed – proveriti: koji motor ide u koju generaciju** (tabela `generationEngines`, 345 veza) — trenutno po platformi (PQ34, PQ35, MQB, MQB Evo, PQ46, B5, PQ25, MQB A0, B6/B7, MLB, C6).
- [ ] **[P1] seed – proveriti: spisak proizvođača delova i nivo kvaliteta** (Original VAG = original; Bosch, Valeo, LuK, Sachs, TRW, ATE, Brembo, Lemförder, Mann-Filter, Mahle, Garrett, NGK, Gates, ContiTech, INA, SKF, Hella, Pierburg, KYB, Bilstein, Varta, Continental, BorgWarner, Denso = OEM; Febi Bilstein, Meyle, Nissens, Castrol, Walker = aftermarket).
- [ ] **[P0] Demo artikli (šifre `DEMO-0001` … `DEMO-0150` i zamene `DEMO-E001` … `DEMO-E007`), demo majstor, 8 demo porudžbina i 4 demo upita** — kataloški (OEM) i zamenski brojevi su izmišljeni i označeni „VAG (demo)“; obrisati pre puštanja uživo (Admin → Podešavanja → Obriši demo podatke, potvrda „OBRIŠI DEMO“).
- [ ] **[P0] Linkovi za praćenje pošiljke** za D Express, BEX, AKS i Post Express — polja su prazna dok ih ne potvrdite (Admin → Podešavanja → Kuriri); broj pošiljke se do tada prikazuje bez linka.
- [ ] **[P1] Prijava vlasnika**: nalog `SEED_ADMIN_EMAIL` je napravljen; lozinku iz `pipeline/env/ADMIN-CREDENTIALS.txt` promenite posle prve prijave (stranica `/zaboravljena-lozinka`; dok Resend nije povezan, kod se čita u Admin → Mejlovi).
- [ ] **[P1] Kod za novu lozinku** se do povezivanja Resend-a (korak 18) ne šalje mejlom — vidi se samo u Admin → Mejlovi (tabela `emailLog`).

- [ ] **[P2] 3D automobil – pregled izgleda**: pogledajte slike `public/images/hero/car-assembled.webp` i `car-exploded.webp` (sklopljen i rasklopljen automobil) i sličice delova u `public/images/parts/` i javite ako neki deo treba da izgleda drugačije. Automobil je namerno generički (bez oznaka bilo koje marke). Ako kasnije kupite 3D model nekog dela, može da zameni generisani deo (uputstvo za programera: `docs/3d/BUILD-NOTES.md`, odeljak 3; proverite licencu za komercijalnu upotrebu na sajtu).
- [ ] **[P2] Brzina početne strane posle objavljivanja** — kada sajt bude na pravoj adresi, otvorite https://pagespeed.web.dev, unesite adresu početne strane i pogledajte ocenu za mobilni telefon (cilj: 85 ili više, LCP ispod 2,5 s). Lokalna merenja iz koraka 10 su u `docs/3d/WEB-QA.md`; programer tamo ima objašnjenje zašto se lokalni „simulirani“ broj razlikuje.


## 10. Administracija (korak 15)
- [ ] **[P0] Zaposleni**: Admin → Korisnici → „Pozovi zaposlenog“ → pošaljite prikazani link zaposlenom (Viber, SMS). Link važi 7 dana i radi samo za e-mail adresu na koju je napravljen; zaposleni se registruje ili prijavi tom adresom i klikne „Prihvati pozivnicu“. Dok e-pošta nije povezana (korak 18), link se ne šalje sam.
- [ ] **[P0] Podaci o firmi**: dok pun naziv, PIB, adresa sedišta, telefon i tekući račun nisu uneti (Admin → Podešavanja → Firma), pregled i predračun/otpremnica prikazuju žuto upozorenje sa spiskom onoga što nedostaje; upozorenje se ne štampa.
- [ ] **[P0] Rok za odgovor na upite (SLA)**: podrazumevano 120 minuta radnog vremena (Admin → Podešavanja → Obaveštenja → „Podsetnik posle“). Potvrdite ili promenite; tajmeri na pregledu i u listi upita računaju samo radno vreme iz podešavanja.
- [ ] **[P1] Moja obaveštenja**: svaki zaposleni u Admin → Podešavanja → Obaveštenja bira šta dobija u aplikaciji i e-poštom.
- [ ] **[P1] Pravni tekstovi**: posle pregleda pravnika uključite „Pravnik je pregledao ovu verziju“ za svaku stranicu (Admin → Podešavanja → Pravni tekstovi) i ažurirajte datume verzija.
- [ ] **[P1] Predračun i otpremnica**: pogledajte izgled (Porudžbina → „Predračun“ / „Otpremnica“) sa knjigovođom — naziv dokumenta, obavezni podaci i napomena „Predračun nije fiskalni račun“.
- [ ] **[P2] Majstor sa odloženim plaćanjem i porudžbina telefonom**: ponudu koju kupac prihvati telefonom pretvarate u porudžbinu dugmetom „Pretvori u porudžbinu“ na upitu; odloženo plaćanje je tada dostupno samo ako je upit poslao odobreni majstor sa tom opcijom.

## 11. Uvoz iz Excela (korak 16)
- [ ] **[P1] Pravi izvoz iz vašeg programa**: pošaljite jedan stvaran cenovnik ili lager izvezen iz knjigovodstvenog programa (može sa izmišljenim cenama). Proverićemo da se kolone same prepoznaju; ako ne, u koraku „Kolone“ ih povežite jednom i kliknite „Sačuvaj mapiranje“ — sledeći put se prepoznaju same.
- [ ] **[P1] Cena u fajlu**: da li program izvozi maloprodajnu cenu sa PDV-om (MP) ili veleprodajnu bez PDV-a (VP)? Ako je samo VP, uvoz računa MP = VP × 1,2 i to prikazuje kao upozorenje.
- [ ] **[P2] Kategorije iz programa**: nazivi grupa artikala iz programa se jednom povežu sa kategorijama sajta u koraku „Provera“. Ako su grupe u programu drugačije od kategorija na sajtu, pošaljite spisak da napravimo stalno mapiranje.
- [ ] **[P2] Deaktiviranje artikala kojih nema u fajlu**: koristite samo sa punim cenovnikom (ne sa delom lagera). Traži upis reči DEAKTIVIRAJ i može se poništiti.
- [ ] **[P3] Slike sa adresa**: slike se preuzimaju samo za artikle koji još nemaju slike, do 12 po artiklu, do 10 MB, JPEG/PNG/WebP.
