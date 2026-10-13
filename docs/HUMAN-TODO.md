# Euromotors Plus · OEM Parts — Šta mora da obezbedi vlasnik / klijent

> **Spojeno u [`GO-LIVE.md`](GO-LIVE.md) (korak 23, 01.10.2026.).** Tamo je ista lista bez duplikata, poređana po redosledu rada, sa oznakom ko šta radi. Ovaj fajl ostaje kao istorija po koracima (npr. §9 sa punim spiskom podataka o vozilima za proveru); nove stavke upisujte u GO-LIVE. Izuzetak je [§0](#0-tri-stvari-bez-kojih-sajt-ne-može-da-se-objavi-stanje-12102026) na vrhu: tri stvari koje drže objavu, ažurirane 12.10.2026.

> Deo dokumentacije sajta Euromotors Plus — indeks: [README](README.md). Ova lista se dopunjuje u svakom koraku; na kraju (korak 23) spaja se u `docs/GO-LIVE.md`. Ništa odavde se ne prikazuje na sajtu kao „TODO" — sajt sakriva prazna polja dok se ne popune u podešavanjima.

Oznake: **[P0]** potrebno pre puštanja uživo · **[P1]** potrebno u prvim nedeljama · **[P2]** kada bude vremena.

## 0. Tri stvari bez kojih sajt ne može da se objavi (stanje 12.10.2026.)

Sve ostalo u ovom spisku može da sačeka ili može da se uradi bez vas. Ove tri stvari ne mogu. Iste stavke su u [`GO-LIVE.md`](GO-LIVE.md) §A.

### 0.1 Odobrenje znaka od klijenta

- [ ] **[P0]** Klijent treba da odobri znak „Euromotors Plus by OEM Parts“.
  - **Šta pogledati:** tablu [`brand/BRAND-BOARD.html`](brand/BRAND-BOARD.html) (dvoklik, radi bez interneta; ista stvar kao slika: [`brand/BRAND-BOARD.png`](brand/BRAND-BOARD.png)) i znak na samom sajtu: [`showcase/index.html`](showcase/index.html), odeljak „Znak“, i slike u [`brand/site/`](brand/site/) (zaglavlje, podnožje, admin, mejl, slika za deljenje, ikonica).
  - **Šta javiti:** „odobreno“, ili šta treba drugačije.
  - **Posebno potvrditi reč „by“** u potpisu. Ako ne opisuje dobro odnos firme i radnje, osnovni može da postane dvojni znak, u kojem oba imena stoje ravnopravno i bez „by“.
  - **Dok odobrenje ne stigne, sajt se ne objavljuje pod ovim znakom.** Izmena znaka se radi u `scripts/brand/logo/` i ugrađuje u sajt jednom naredbom ([`PREDAJA.md` §11.4](PREDAJA.md#114-ako-znak-treba-izmeniti-programer)).
- [ ] **[P1]** Pre registracije žiga, izrade table i oslikavanja vozila: provera sličnih znakova (Zavod za intelektualnu svojinu RS, baza TMview), najbolje preko zastupnika. Ova provera nije urađena.

### 0.2 Pravi domen i adresa pošiljaoca e-pošte

- [ ] **[P0] Domen.** Javite adresu sajta (npr. `www.vas-domen.rs`) i da li je glavna adresa sa `www` ili bez. Dajte pristup nalogu kod registrara domena, jer se tamo upisuju DNS zapisi za sajt (Vercel) i za e-poštu (Resend).
  - Na sajtu i u kodu nema privremenog domena. Dok adresa nije upisana, linkovi u mejlovima vode na adresu razvojnog računara, a na slici za deljenje nema domena.
- [ ] **[P0] Adresa pošiljaoca.** Javite:
  - adresu sa koje sajt šalje poruke kupcima, na tom domenu (npr. `prodaja@vas-domen.rs`);
  - adresu na koju stižu odgovori kupaca;
  - da li ime pošiljaoca ostaje „Euromotors Plus“.
  - Dok adresa nije upisana i domen proveren kod Resend-a, poruke se samo beleže u Admin → E-pošta i ne odlaze. Provera domena ume da traje, pa ovo treba pokrenuti prvo (GO-LIVE §1 i §5).

### 0.3 Pravi podaci firme

- [ ] **[P0]** Pošaljite ili sami upišite u Admin → Podešavanja:
  - **Firma:** pun pravni naziv, sedište, PIB, matični broj, registar (APR). Obavezno po Zakonu o elektronskoj trgovini. PIB i matični broj se proveravaju kontrolnom cifrom.
  - **Radnja:** adresa za lično preuzimanje i link ka mapi.
  - **Kontakt za kupce:** telefoni, Viber broj, WhatsApp broj, e-pošta.
  - **Tekući račun i banka** za predračun (18 cifara sa kontrolnim brojem, npr. `160-0000000123456-78`).
  - **Radno vreme i neradni dani** (Podešavanja → Radno vreme). **Pažnja:** sajt već prikazuje radno vreme „Pon–pet 8–17, sub 8–14“ u podnožju i na strani Kontakt. To je početna vrednost iz podešavanja (po njoj se računaju podsetnici), a ne podatak vaše radnje. Ispravite je pre objave.
  - **Kurirske službe** sa kojima radite i linkovi za praćenje pošiljke (Podešavanja → Dostava i plaćanje).
  - Potvrdite i da su nazivi tačno napisani: „Euromotors Plus“ i „OEM Parts“ (Podešavanja → Firma → „Brend i brojevi dokumenata“).
- Dok ovi podaci nisu upisani: sajt ne prikazuje kontakt, u donjoj traci na telefonu umesto „Kontakt“ stoji „Upit“, a pregled u adminu, predračun i otpremnica prikazuju žuto upozorenje sa spiskom onoga što nedostaje. Ništa na sajtu nije izmišljeno umesto ovih podataka.

## 1. Podaci firme (Admin → Podešavanja → Firma)
- [x] **[P0]** Naziv prodavnice: od koraka 25 sajt nosi naziv „Euromotors Plus“ (poznati naziv radnje „OEM Parts“); radni naziv „SKLOP“ je uklonjen. Slogan „Rasklopi auto. Nađi deo.“ ostaje dok ga ne potvrdite ili zamenite (Podešavanja → Firma).
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
- [ ] **[P1]** Tekst odricanja o korišćenju naziva VW/Audi/Škoda/SEAT/Cupra (nominativna upotreba) — nacrt je od koraka 04 u podnožju sajta: „Volkswagen, Audi, Škoda, SEAT i Cupra su registrovani žigovi svojih vlasnika. Nazive marki koristimo samo da bismo označili vozila kojima su delovi namenjeni; Euromotors Plus nije povezan sa proizvođačima vozila niti je njihov ovlašćeni zastupnik.“ Pravnik da potvrdi ili izmeni.

- [ ] **[P0] Pregled tekstova na sajtu (korak 12)** — stranice `/uslovi-koriscenja`, `/politika-privatnosti`, `/kolacici`, `/dostava-i-placanje`, `/reklamacije-i-povrat` su objavljene kao šabloni (u bazi označene „potreban pravni pregled“). Pravnik da proveri naročito: rokove iz novog Zakona o zaštiti potrošača (odustanak 14 dana, odgovor na reklamaciju, rok rešavanja 15/30 dana), izuzetke od prava na odustanak (deo naručen po broju šasije), prenos podataka van Srbije (hosting Convex/Vercel, slanje mejlova), rokove čuvanja podataka i pomen tela za vansudsko rešavanje sporova. Izmene se unose u Admin → Sadržaj (korak 15).
- [ ] **[P1] Sesijski kolačić izvora posete `sk_attr_s`** (oznake kampanje i izvor dolaska, bez ličnih podataka, briše se zatvaranjem pregledača) — pravnik da potvrdi da sme bez pristanka kao deo evidencije porudžbine; ako ne sme, isključuje se do izbora u baneru za kolačiće (korak 19).
- [ ] **[P1] Predračun** (`/porudzbina/<token>/predracun`) — računovođa da potvrdi obavezne elemente predračuna (tekući račun, poziv na broj, napomena „nije fiskalni račun“); tekući račun se unosi u Admin → Podešavanja → Firma.
- [ ] **[P1] Nivoi rabata su javno prikazani** na `/za-majstore` i na početnoj (Majstor 10 %, Majstor Plus 15 %, Partner 20 %) — potvrdite da procenti smeju da budu javni i da su tačni.
- [ ] **[P2] Česta pitanja na početnoj** — odgovori su napisani prema pravilima prodavnice iz ovog plana (plaćanje, dostava, povrat, VIN); proverite ih i po potrebi izmenite (Admin → Sadržaj, korak 15).
- [ ] **[P2] „O nama“ i „Kontakt“** — tekstovi su opšti i bez izmišljenih podataka; dopunite ih pravim podacima o radnji (adresa, radno vreme, telefon, Viber; kanali bez podataka se na sajtu ne prikazuju).

## 4. E-mail (Resend)
Do kraja ovih koraka sajt radi u režimu **„Samo zapis“**: svaka poruka (i kod za novu lozinku) napravi se i vidi u Admin → E-pošta, ali ništa ne odlazi. Tako je bezbedno.

- [ ] **[P0]** Otvoriti nalog na [resend.com](https://resend.com) (proveriti plan i ograničenja slanja za vaš obim).
- [ ] **[P0]** U Resend-u dodati domen sajta (Domains → Add domain) i kod registrara domena upisati DNS zapise koje Resend prikaže (SPF, DKIM, a preporučeno i DMARC). Sačekati da domen dobije status „Verified“.
- [ ] **[P0]** Napraviti API ključ (API Keys → Create, dozvola „Sending access“) i upisati ga u Convex **produkcioni** deployment: `npx convex env set RESEND_API_KEY re_…` (ključ se nikad ne upisuje u kod ni u git).
- [ ] **[P0]** Adresa pošiljaoca na verifikovanom domenu, npr. `prodaja@vasdomen.rs`: `npx convex env set EMAIL_FROM prodaja@vasdomen.rs`. Ime pošiljaoca i adresu za odgovore menjate u Admin → Podešavanja → Obaveštenja → Slanje e-pošte.
- [ ] **[P0]** Webhook za status isporuke: u Resend-u Webhooks → Add endpoint, URL `https://<vaš-deployment>.convex.site/resend-webhook` (tačna adresa piše u Admin → Podešavanja → Obaveštenja), događaji `email.*`. Kopirati „Signing secret“ i upisati: `npx convex env set RESEND_WEBHOOK_SECRET whsec_…`. Bez ovoga poruke se šalju, ali status ostaje „U redu“ i odbijene adrese se ne prijavljuju.
- [ ] **[P0]** Tajni ključ za linkove ka statusu porudžbine i upita na **produkciji** (nasumična vrednost od bar 32 znaka): `npx convex env set LINK_TOKEN_SECRET <vrednost>`. Postaviti **pre prve prave porudžbine** i posle toga ga ne menjati — promena poništava linkove iz već poslatih mejlova. (Na razvojnom deploymentu je već postavljen.)
- [ ] **[P0]** Probno slanje: Podešavanja → Obaveštenja → Slanje e-pošte → **Test** → sačuvati; zatim E-pošta → Šabloni → „Pošalji probnu poruku“ za nekoliko šablona i proveriti ih u Resend-u (Emails). Zatim prebaciti na **Uživo**.
- [ ] **[P0]** Pre „Uživo“ popuniti Podešavanja → Firma (pun naziv, adresa, PIB, MB, telefon, Viber, WhatsApp, e-pošta, tekući račun): ti podaci idu u podnožje svakog mejla i u predračun u mejlu „Porudžbina je potvrđena“.
- [ ] **[P0]** Obrisati demo podatke pre „Uživo“ (Podešavanja → Opasna zona). Demo porudžbine i upiti se nikad ne šalju, ali ne treba da budu u dnevnom pregledu.
- [ ] **[P1]** Adrese osoblja (zajednička adresa, npr. prodaja@…) i sat dnevnog pregleda (podrazumevano 08:00) u Podešavanja → Obaveštenja; svaki zaposleni bira šta dobija (ili vlasnik u Korisnici → Obaveštenja).
- [ ] **[P1]** Proveriti radno vreme i neradne dane (Podešavanja → Radno vreme): podsetnici za neodgovorene porudžbine i upite računaju samo radno vreme (prvi posle 120 min, drugi 2 sata kasnije — podesivo).
- [ ] **[P1]** Pravni pregled rečenice u mejlu „Porudžbina je isporučena“ o pravu potrošača da odustane u roku od 14 dana i o reklamacijama (šablon: E-pošta → Šabloni → „Isporučena / preuzeta“).
- [ ] **[P2]** SMS i Telegram nisu deo prve verzije; ako zatrebaju, dodaju se kao novi kanal obaveštenja (plaćeni SMS servis).

## 5. Oglasi i analitika (korak 19 — ceo postupak: `docs/ADS-PLAYBOOK.md`)
- [ ] **[P1]** GA4 Measurement ID, Google Ads Conversion ID i oznake konverzija (porudžbina, upit, registracija majstora) → Admin → Podešavanja → Praćenje. Dok su polja prazna, sajt ne učitava nijedan kod.
- [ ] **[P1]** Meta Pixel ID (Praćenje) i **Conversions API token** na serveru: `npx convex env set META_CAPI_TOKEN <token>` (produkcija: `--prod`), pa uključiti „Meta Conversions API“. Test event kod upisati samo za proveru i obrisati posle testa.
- [ ] **[P1]** Naziv offline konverzije (Praćenje → „Naziv konverzije za offline uvoz“) — tačno kao akcija u Google Ads; nedeljni uvoz CSV-a iz Admin → Izvori.
- [ ] **[P1]** `REVALIDATE_SECRET` — ista tajna vrednost u Vercel promenljivim i `npx convex env set REVALIDATE_SECRET <vrednost>` (trenutno osvežavanje sajta posle izmena kataloga; bez nje strane se osvežavaju same za 5–60 min).
- [ ] **[P1]** Google Merchant Center: **Srbija trenutno nije podržana** za Shopping oglase i besplatne oglase (najava od 14.07.2026. povučena 18.08.2026; proveravano 30.09.2026) — feed `/feeds/google-merchant.xml` je spreman, uključiti kada Srbija bude podržana.
- [ ] **[P1]** Meta katalog: pri pravljenju kataloga proveriti da li Commerce Manager nudi RSD za Srbiju; ako ne, katalog ne koristiti (ne prevoditi cene u evre).
- [ ] **[P2]** Google Ads offline konverzije: ako ekran za uvoz traži novi šablon ili Data Manager, preuzmite aktuelni šablon; porudžbine sa GBRAID/WBRAID uvoze se kroz Data Manager.
- [ ] **[P1]** Google Business Profile (kategorija „Prodavnica auto-delova“, isti naziv/adresa/telefon kao na sajtu) i Search Console (svojstvo za domen, prijava `/sitemap.xml`).
- [ ] **[P1]** Pravnik: politika privatnosti i stranica „Kolačići“ pominju Google Analytics, Google Ads, Metu, heširane podatke za merenje oglasa i kolačiće `_ga`, `_gcl_*`, `_fbp`, `_fbc`, `sk_consent`, `sk_attr` — potvrditi tekst i trajanja.
- [ ] **[P2]** Oglasna strana `/ponuda/kocione-plocice-golf` je primer (demo) — izmenite ili obrišite u Podešavanja → Oglasne strane pre prvih oglasa.
- [ ] **[P2]** Ograničenje broja strana „kategorija × vozilo“ u indeksu (Podešavanja → SEO, sada 300): povećati tek kada Search Console pokaže da su postojeće indeksirane.

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
- [ ] **[P1]** Raspored backupa baze (Convex export) — postupak u `docs/BACKUPS.md`, vidi §12.

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

## 12. Bezbednost, privatnost i rezervne kopije (korak 20)
- [ ] **[P0] Promenljive okruženja za produkciju** — sve iz `docs/GO-LIVE-ENV.md`. Bez `LINK_TOKEN_SECRET` produkcija namerno **ne prima porudžbine ni upite** (inače bi linkovi ka statusu mogli da se izračunaju). Produkcijsku Convex bazu napraviti u EU regionu (kao razvojnu).
- [ ] **[P0] Nalog vlasnika na produkciji**: `npx convex run --prod seed:createOwner` pokrenuti **pre** nego što sajt bude javno dostupan; zatim se prijaviti, promeniti lozinku i obrisati `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (`npx convex env remove --prod …`). Ako komanda javi `password_mismatch`, neko je već registrovao tu adresu — javiti se programeru.
- [ ] **[P1] Potvrda e-pošte pri registraciji**: kad Resend proradi (§4), uključiti slanje koda za potvrdu adrese pri otvaranju naloga (sada svako može da otvori nalog na bilo koju adresu; podaci se nikad ne povezuju sa nalogom po adresi, pa to nije curenje, ali pozivnice za zaposlene su sigurnije uz potvrdu).
- [ ] **[P1] Rezervne kopije baze** po `docs/BACKUPS.md`: dnevno + nedeljno + mesečno, čuvanje van računara u radnji, i **jednom mesečno vežba vraćanja** (§3). Zamenjuje stavku „Raspored backupa“ iz §7.
- [ ] **[P1] Pravnik**: popis podataka, rokovi čuvanja i postupak po zahtevima kupaca u `docs/PRIVACY-PROCESS.md` (uvid u podatke, brisanje — Admin → Privatnost, samo vlasnik); isti rokovi moraju biti u politici privatnosti.
- [ ] **[P1] Evidencija zahteva kupaca** (tabela: datum, ko, šta, kada odgovoreno) i godišnji pregled starih naloga/upita (PRIVACY-PROCESS §4).
- [ ] **[P2] Praćenje grešaka na produkciji** (Convex → Settings → Integrations → log stream ili Sentry) — da greške vidite pre kupaca.
- [ ] **[P2] Skrivene cene**: ako u podešavanjima isključite javne cene, isključite i kupovinu bez naloga — inače gost koji doda artikal u korpu vidi njegovu cenu.
- [ ] **[P2] Zaposleni koji je i majstor**: svoj majstorski profil ne može sam da odobri niti da sebi menja rabat i odloženo plaćanje — to radi vlasnik.

## 13. QA audit (korak 21)
Ceo izveštaj je u `docs/qa/AUDIT.md`: 180 potvrđenih nalaza (bez P0, 18 P1). Korak 22 ih ispravlja; ovde su samo stvari koje traže vašu odluku.
- [ ] **[P1] Pravo na odustanak u čestim pitanjima (nalaz COPY-02)**: odgovor na „Mogu li da vratim deo?“ na početnoj strani sužava zakonsko pravo kupca da odustane od kupovine na daljinu u roku od 14 dana i ne slaže se sa stranom „Reklamacije i povrat“. Korak 22 usklađuje tekst sa pravnom stranom; konačnu formulaciju neka potvrdi pravnik.
- [ ] **[P2] Obećanje o slanju istog dana (nalaz COPY-04)**: u sadržaju piše „porudžbine potvrđene do 14 časova šaljemo istog dana“. To nije vaš potvrđen podatak — potvrdite satnicu ili će rečenica biti uklonjena.
- [ ] **[P2] Kontakt podaci (nalazi COPY-03 i VIS-03)**: tekstovi na sajtu upućuju na telefon, Viber, e-poštu, adresu i obrazac za odustanak, ali dok ih ne upišete u Podešavanja → Firma, ništa od toga se ne prikazuje. Kada ih upišete, proverite zaglavlje na telefonu (korak 22 popravlja da meni ne ispadne sa ekrana).
- [ ] **[P2] Slike kategorija (nalaz VIS-01)**: dok ne stignu vaše fotografije artikala, jedine slike su naši renderi kategorija; korak 22 ih ujednačava. Prave fotografije (po uputstvu iz `docs/design/DESIGN-SYSTEM.md` §6.3) najviše podižu utisak prodavnice.
- [ ] **[P3] Posle puštanja uživo**: proverite brzinu na PageSpeed Insights (telefon) za početnu, jednu kategoriju i jedan artikal — laboratorijska merenja na lokalnom računaru nisu isto što i pravi saobraćaj.
- [ ] **[P1] Korak 22 — nova formulacija u čestim pitanjima (COPY-02)**: odgovor na „Mogu li da vratim deo?“ sada glasi: „Da. Kao potrošač možete da odustanete od kupovine u roku od 14 dana od prijema, bez navođenja razloga. Trošak vraćanja snosite vi; ako je deo ugrađivan ili oštećen, odgovarate za umanjenje vrednosti.“ uz vezu na stranu „Reklamacije i povrat“. Neka pravnik potvrdi ovu formulaciju (Admin → Sadržaj → Česta pitanja).
- [ ] **[P2] Korak 22 — rok za slanje istog dana (COPY-04)**: rečenica „porudžbine potvrđene do … šaljemo istog dana“ na strani „Dostava i plaćanje“ i u čestim pitanjima sada čita satnicu iz Podešavanja → Prodaja → „Rok za slanje istog dana“. Tamo je za sada upisana početna vrednost 14:00 — potvrdite satnicu ili obrišite polje, pa rečenica nestaje sa sajta.
- [ ] **[P1] Korak 22 — potvrda e-pošte pre puštanja uživo (nalaz BE-07)**: registracija sada više ne može da se zatvori za sve kupce posle 30 lažnih naloga; preko 60 novih naloga za sat vremena dobijate upozorenje u zvonu (Admin), a registracija se privremeno zatvara tek preko 300. Lažni nalozi se i dalje mogu otvarati na tuđe adrese dok ne uključimo potvrdu e-pošte (stavka „Potvrda e-pošte pri registraciji“ iznad) — to ostaje uslov za puštanje uživo.
- [ ] **[P2] Korak 22 — upozorenja u zvonu**: ako dobijete „Neuobičajeno mnogo porudžbina“ ili „Neuobičajeno mnogo novih naloga“, pregledajte poslednje porudžbine ili kupce; prijem porudžbina se ne zaustavlja. Javite nam ako se upozorenje javlja pri normalnom radu, da pomerimo prag (sada 300 porudžbina i 60 naloga na sat).
- [ ] **[P2] Korak 22 — podaci o firmi se proveravaju (nalaz FLOW-15)**: Podešavanja → Firma sada odbija PIB sa pogrešnom kontrolnom cifrom, matični broj koji nije ispravan i račun koji nema 18 cifara sa ispravnim kontrolnim brojem (npr. 160-0000000123456-78). Upišite tačne podatke sa rešenja i ugovora sa bankom; oni idu na predračun i otpremnicu.
- [ ] **[P3] Korak 22 — kupci bez e-pošte (nalaz FLOW-13)**: kad kupac pita telefonom, Viberom ili WhatsApp-om bez e-pošte, posle slanja ponude na upitu se pojavljuje „Link za kupca“ sa dugmićima za Viber, WhatsApp i SMS — link mu pošaljite vi. Porudžbinu možete napraviti i bez e-pošte; takav kupac ne dobija obaveštenja e-poštom, pa ga o promenama obaveštavate telefonom.
- [ ] **[P3] Korak 22 — rok isporuke za artikle po porudžbini (nalaz SEO-10)**: Google Merchant traži datum dostupnosti za artikle koji se poručuju kod dobavljača. Feed ga sada šalje samo kad artikal ima upisan „Rok isporuke“ (u danima); za artikle bez tog podatka datum ne izmišljamo. Upišite rok isporuke za artikle „po porudžbini“ (Admin → Artikli) pre uključivanja Merchant feeda.
- [ ] **[P3] Korak 22 — rokovi dostave i troškovi povrata za Google (nalaz SEO-09)**: za podatke o isporuci i povratu u Google rezultatima potrebni su brojevi: koliko radnih dana pripremate pošiljku, koliko traje kurirska dostava i ko plaća troškove vraćanja robe kada kupac odustane. U Podešavanjima sada postoji samo tekst roka („1–2 radna dana“); javite nam brojeve i pravilo za troškove povrata da ih dodamo u podatke artikla.
- [ ] **[P3] Korak 22 — nazivi u SEO naslovima kategorija (nalaz SEO-03)**: naslovi kategorija se sada prave automatski („{Kategorija} za VW, Audi, Škoda, SEAT“ i „— strana n“) i nikad se ne seku sa „…“. Ako u Adminu upišete svoj SEO naslov kategorije, koristi se on — držite ga do 45 znakova da broj strane i naziv sajta stanu.
- [ ] **[P3] Korak 22 — praćenje rada sajta (nalaz SEO-12)**: adresa `/api/zdravlje` sada javlja da li sajt i baza (Convex) rade: odgovor 200 znači da je sve u redu, 503 da baza ne odgovara. Posle objave prijavi tu adresu u neki servis za praćenje (npr. UptimeRobot ili Better Stack, besplatan plan je dovoljan), proveru na 5 minuta i obaveštenje na tvoju e-poštu ili telefon.
- [ ] **[P3] Korak 22 — uputstva za agente (nalazi PERF-05 i PERF-10, odluke D235 i D288)**: `.claude/rules/architecture.md` i `.claude/skills/text-reveal/SKILL.md` još opisuju staro otkrivanje teksta preko GSAP-a i kažu da `@/lib/gsap/client` registruje ScrollTrigger. Otkrivanje teksta sada radi preko CSS animacija (`tr-word`, `tr-word-lite`, `tr-block`), a ScrollTrigger se učitava samo uz 3D prikaz na početnoj strani (`@/lib/gsap/scroll`). Agenti ne smeju da menjaju `.claude/**`, pa te dve datoteke treba da ispravite vi (ili da to izričito dozvolite).
- [ ] **[P3] Korak 22 — opis strane „Kontakt“ za Google**: dok su kontakt podaci u Podešavanja → Firma prazni, strana `/kontakt` nema opis (meta description), jer jedina rečenica počinje podatkom o najbržem kontaktu. Kada upišete telefon ili Viber, opis se pojavljuje sam.

## 14. Znak i ime (korak 24)

Stavke su upisane u [`GO-LIVE.md`](GO-LIVE.md) §A „Znak i ime“:

- [ ] **[P0]** Klijent potvrđuje znak „Euromotors Plus by OEM Parts“ (`docs/brand/BRAND-BOARD.html`) i reč „by“ u potpisu.
- [ ] **[P1]** Provera žiga (Zavod za intelektualnu svojinu RS, TMview) pre registracije, table i vozila.
- [ ] **[P1]** Boje za štampu (Pantone / CMYK) sa štamparom.
- [ ] **[P2]** Vektorske datoteke starih znakova, ako postoje, u `docs/brand/source/`.

## 15. Novi naziv i znak na sajtu (korak 25)

Sajt je preimenovan u „Euromotors Plus“, sa potpisom „by OEM Parts“ u znaku. Stavke su upisane i u [`GO-LIVE.md`](GO-LIVE.md) §A.

- [ ] **[P0] Odobrenje znaka.** Klijent treba da odobri znak onako kako sada stoji na sajtu: u zaglavlju i podnožju, u adminu, u mejlovima, na predračunu i otpremnici, kao ikonica u kartici pregledača i na slici koja se vidi kad se link podeli. Slike za pregled su u `docs/brand/site/` (zaglavlje, podnožje, admin, mejl, slika za deljenje, ikonica). Ako znak ili reč „by“ ne odgovaraju, javite pre objave; izmena se radi u `scripts/brand/logo/` i ponovo ugrađuje jednom naredbom.
- [ ] **[P0] Pravi domen.** Javite adresu sajta (npr. `www.vas-domen.rs`) i dajte pristup nalogu kod registrara. Na sajtu i u kodu nema privremenog domena; dok adresa nije upisana, linkovi u mejlovima i adresa na slici za deljenje nisu ispravni.
- [ ] **[P0] Adresa pošiljaoca e-pošte.** Javite adresu sa koje sajt šalje poruke kupcima (npr. `prodaja@vas-domen.rs`) i adresu na koju stižu odgovori. Ime pošiljaoca je „Euromotors Plus“. Dok adresa nije upisana i domen proveren, poruke se samo beleže i ne šalju.
- [ ] **[P1] Dva naziva u naslovima.** Naslovi strana se završavaju sa „ | Euromotors Plus · OEM Parts“; kada je naslov dugačak ostaje samo „ | Euromotors Plus“, a kod najdužih naziva artikala nijedan. Ako želite drugačiji nastavak, menja se u Podešavanja → SEO → „Dodatak naslovu“.
- [ ] **[P2] Početak brojeva porudžbina.** Brojevi i dalje počinju sa „SK“ (npr. `SK-2026-000187`). Ako želite drugi početak (npr. „EM“), promenite ga u Podešavanja → Firma → „Prefiks porudžbine“ pre prve prave porudžbine.
- [ ] **[P2] Ime na početnom ekranu telefona.** Kada kupac doda sajt na početni ekran, ispod ikonice piše „Euromotors“, jer telefoni prikazuju najviše 12 znakova. Ako želite „OEM Parts“, javite.

## 16. Novi izgled: uglovi, pojavljivanje sadržaja, zaglavlje i donja traka (korak 26)

U koraku 26 urađen je sistem: zaobljeni uglovi na svim kutijama, pojavljivanje sadržaja pri skrolovanju, novo zaglavlje i donja traka na telefonu. Korak 27 to primenjuje na svaku stranu. Plan i slike „pre“ i „posle“: [`design/UI-BOOST.md`](design/UI-BOOST.md), `docs/qa/screens/step-26/`.

- [ ] **[P1] Pogledajte pojavljivanje sadržaja.** Otvorite stranu `/styleguide/otkrivanje` na računaru i na telefonu i skrolujte. Blok se pojavljuje kad njegova sredina pređe liniju na 18 % visine ekrana od donje ivice. Tražili ste 15 %, uz dozvolu da linija ide više: na telefonu donja traka pokriva donjih 60 piksela, pa je na 15 % sadržaj kretao tik uz traku. Ako želite drugu vrednost, to je jedan broj (`REVEAL_LINE` u `constants/revealConfig.ts`).
- [ ] **[P1] Pogledajte uglove.** Čipovi 4, dugmad i polja 6, kartice 8, slike 10, dijalozi 12, donji paneli 14 piksela. Ako želite mekše ili oštrije, menja se šest brojeva na jednom mestu (`app/globals.css`).
- [ ] **[P2] Donja traka na telefonu.** Pretraga, Vozilo, Korpa, Kontakt. „Kontakt“ otvara spisak kanala iz Podešavanja → Firma (telefon, Viber, WhatsApp, e-pošta); dok ti podaci nisu upisani, na tom mestu stoji „Upit“. Upišite kontakt podatke da bi traka nudila poziv i Viber.
- [ ] **[P2] Prelaz između strana i zaglavlje koje se skuplja** rade u pregledačima Chrome, Edge i Safari. U Firefoxu se strana menja bez prelaza, a zaglavlje je odmah u skupljenom obliku. To je predviđeno ponašanje, ne greška.

## 17. Novi izgled na svim stranama (korak 27)

U koraku 27 novi sistem je primenjen na svaku stranu: početnu, katalog, stranu artikla, pretragu, korpu i porudžbinu, upit, portal za majstore, nalog, prijavu, tekstualne strane, administraciju, e-poruke i 3D prikaz. Slike „pre“ i „posle“ su u `docs/qa/screens/step-27/`, pregled po stranama u `docs/design/UI-BOOST.md` §11.

- [ ] **[P1] Pogledajte početnu na telefonu.** Auto se sada vidi na prvom ekranu, a polje za pretragu i dugme su u jednom redu. Nova sekcija „Izdvojeno sa stanja“ prikazuje po jedan najtraženiji deo na stanju iz kategorija kočione pločice, kočioni diskovi, amortizeri i filteri. Ako želite druge kategorije, menja se jedan spisak (`FEATURED_PART_CATEGORIES` u `app/(shop)/page.tsx`).
- [ ] **[P1] Pogledajte stranu artikla.** Cena, stanje i „Dodaj u korpu“ su u jednoj kutiji koja na računaru prati skrolovanje; na telefonu traka sa cenom i dugmetom stoji na dnu dok se glavno dugme ne vidi.
- [ ] **[P1] Pošaljite sebi probne e-poruke.** Administracija → E-pošta → Šabloni → probno slanje. Pogledajte potvrdu porudžbine i ponudu u Gmailu i Outlooku, na telefonu i u tamnom režimu. Izgled poruka je nov (obaveštenja, dugme, stavke u dva reda, podaci za uplatu u kutiji).
- [ ] **[P2] Pročitajte nove tekstove.** Pretraga bez rezultata („Šta još možete“), prijava i registracija (tekst pored obrasca), portal (objašnjenje oznaka kod brze porudžbine, „Odjava“), završni poziv na strani `/za-majstore`, koraci „Šta dalje“ kod upita. Sve je pisano u istom tonu; ispravite šta vam ne odgovara.
- [ ] **[P2] Upišite kontakt podatke.** Dok u Podešavanja → Firma nema telefona, Vibera i adrese, strana `/kontakt` prikazuje samo upit i radno vreme, a u donjoj traci na telefonu umesto „Kontakt“ stoji „Upit“.
- [ ] **[P2] Administracija, spisak porudžbina.** Status se sada menja iz reda: klik na oznaku statusa otvara dozvoljene sledeće korake (svaki se potvrđuje). Vreme čekanja ima četiri stepena: u roku, rok ističe, kasni, dugo kasni. Recite ako želite druge granice.
- [ ] **[P3] Portal za majstore.** U traci su četiri kartice (Pregled, Brza porudžbina, Porudžbine, Cenovnik), ostalo je pod „Još“. Ako majstori najčešće traže nešto drugo, redosled se menja na jednom mestu.
- [ ] **[P3] Probni podaci u razvojnoj bazi.** Testovi su ostavili kampanje sa veoma dugim nazivima; na strani Administracija → Izvori link ka takvoj kampanji ne radi (adresa je preduga). U pravoj bazi takvih naziva nema; razvojnu bazu očistite pre pokazivanja.

## 18. Predaja posle novog imena i izgleda (korak 29)

Dokumenti za predaju su dopunjeni: [`PREDAJA.md`](PREDAJA.md) §11 (ime i znak, komplet znaka), §12 (šta je novo), §13 (linija pojavljivanja sadržaja); [`showcase/index.html`](showcase/index.html) ima nove snimke na 390 i 1440 px i tablu znaka.

- [ ] **[P0] Tri stvari iz [§0](#0-tri-stvari-bez-kojih-sajt-ne-može-da-se-objavi-stanje-12102026)**: odobrenje znaka, pravi domen sa adresom pošiljaoca e-pošte, pravi podaci firme.
- [ ] **[P1] Pokažite klijentu prikaz.** Otvorite `docs/showcase/index.html` (dvoklik, radi bez interneta) i prođite redom: znak, 3D auto, šta je novo, kupac, majstor, radnja, pre objave. Redosled za živi demo je u `PREDAJA.md` §10.
- [ ] **[P2] Komplet znaka za štampu i saradnike** je u `docs/brand/export/` (SVG, PDF, PNG, ikonice). Štamparu i firmi koja pravi tablu šaljite PDF ili SVG, nikad PNG; boje za štampu izaberite sa štamparom (`PREDAJA.md` §11.3).

## 19. Novi 3D prikaz na početnoj strani — plan (korak 30)

Urađen je plan, ništa na sajtu još nije promenjeno. Ceo plan je u [`3d/HERO-V2.md`](3d/HERO-V2.md) (na engleskom, za programera). Slike probnog prikaza: [`3d/hero-v2/lab/sizes-desktop.webp`](3d/hero-v2/lab/sizes-desktop.webp) (računar) i [`3d/hero-v2/lab/sizes-mobile.webp`](3d/hero-v2/lab/sizes-mobile.webp) (telefon).

Ukratko: dok skrolujete, delovi izlaze iz auta i ređaju se u mrežu, svaki iznad svog naziva, bez okvira. Mreža prikazuje jednu grupu sistema odjednom (najviše devet delova). Kad naiđe sledeća grupa, prethodna se sklanja u traku na dnu, a brojač pokazuje koliko je delova pronađeno.

- [ ] **[P1] Potvrdite šest stvari pre izrade:**
  1. **Položaj mreže.** Na računaru je mreža iznad auta, na telefonu ispod. Tako auto ostaje na svom mestu i samo se smanji.
  2. **Traka na dnu.** Umesto osam brojeva faza, deset sistema po nazivu (Karoserija, Elektrika, Točkovi, Kočnice, Vešanje, Hlađenje, Motor, Transmisija, Izduv, Servis), sa brojem delova.
  3. **Klik na deo u mreži** otvara stranu te kategorije. Klik na deo koji je još na autu i dalje otvara panel sa artiklima.
  4. **Limarija u mreži** (hauba, vrata, branici, blatobrani) prikazana je u sivoj osnovnoj boji, a ne kao staklo. Kao staklo se u mreži ne vidi.
  5. **Dužina skrola.** Na računaru malo kraća nego sada, na telefonu nešto duža: jedan potez prstom je jedna grupa delova.
  6. **Tekstovi:** „Pronađeno 23/44“ i, na kraju, „Ceo auto rastavljen“ sa dugmadima „Izaberite vozilo“, „Svi delovi“ i „Sklopi auto“.
- [ ] **[P1] Greška nađena usput, nije ispravljena:** kad posetilac na prvom dolasku odbije kolačiće („Odbij sve“), strana skoči na dno. Provereno na razvojnoj verziji, na računaru i telefonu. Treba je ispraviti pre objave, nezavisno od novog 3D prikaza.
- [ ] **[P2] Provera na pravom telefonu.** Brzina novog prikaza izmerena je samo na računaru. Pre objave treba je proveriti na jednom telefonu srednje klase.

## 20. Novi 3D prikaz na početnoj strani — urađeno (korak 31)

Plan iz tačke 19 je sproveden. Dok skrolujete, delovi izlaze iz auta i ređaju se u mrežu po sistemima; traka na dnu pokazuje sisteme i brojač „Pronađeno“. Slike svake grupe, na računaru i na telefonu: [`qa/screens/hero-v2/`](qa/screens/hero-v2/) (`desktop-…` i `mobile-…`; `reduced-…` je prikaz za posetioce koji su isključili animacije, `low-…` za uređaje bez 3D prikaza).

Šest stvari iz tačke 19 urađeno je onako kako je predloženo. Ako nešto od toga želite drugačije, javite.

- [ ] **[P1] Pogledajte početnu stranu na svom računaru i telefonu** i javite da li vam odgovaraju veličina delova u mreži, brzina kojom izlaze iz auta i završni tekst „Ceo auto rastavljen“.
- [ ] **[P1] Provera na telefonu srednje klase.** Brzina je izmerena samo na računaru. Ako telefon ne može da prati lagano lebdenje delova, sajt ga sam isključi i delovi miruju; sve ostalo radi isto. Pre objave vredi proveriti na jednom stvarnom telefonu.
- [ ] **[P2] Dugme na kraju.** „Izaberite vozilo“ je namerno mirnije dugme, jer je glavno dugme u tom delu strane „Pretraži“. Ako želite da bude narandžasto, javite.
- [ ] **[P2] Skraćeni nazivi.** Na ekranima užim od 1440 px jedanaest dugih naziva je skraćeno (na primer „Poluosovine“ umesto „Poluosovine i homokinetički zglobovi“). Pun naziv ostaje na strani kategorije i čita ga čitač ekrana. Spisak je u `lib/i18n/sr/hero.ts`.
- Greška sa kolačićima iz tačke 19 („Odbij sve“ pomeri stranu na dno) i dalje nije ispravljena; nije deo 3D prikaza.
