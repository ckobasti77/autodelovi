# SKLOP — Spisak za puštanje uživo

> Za programera i klijenta. Ovaj spisak zamenjuje `HUMAN-TODO.md` (sve stavke odatle su ovde, bez duplikata, poređane po redosledu rada). Promenljive okruženja sa objašnjenjem svake: [`GO-LIVE-ENV.md`](GO-LIVE-ENV.md). Rezervne kopije: [`BACKUPS.md`](BACKUPS.md). Privatnost: [`PRIVACY-PROCESS.md`](PRIVACY-PROCESS.md). Oglasi: [`ADS-PLAYBOOK.md`](ADS-PLAYBOOK.md).

**Oznake:** **[P0]** mora pre objave · **[P1]** u prve dve nedelje posle objave · **[P2]** kad bude vremena.
**Ko radi:** (K) klijent · (P) programer · (K+P) zajedno.

Redosled je bitan: domen i Resend traže vreme (DNS, provera domena), pa njih treba pokrenuti prvo; produkciona baza i sajt dolaze posle; mejlovi „Uživo“ i oglasi tek na kraju.

---

## A. Šta treba od klijenta (skupiti odmah)

- [ ] **[P0] (K)** Konačan naziv prodavnice i slogan (radni naziv je „SKLOP“). Menja se u `config/site.ts` i Podešavanja → Firma; znak „izvučen deo“ ne zavisi od naziva. Ako želite drugi znak, javite.
- [ ] **[P0] (K)** Domen (npr. `www.domen.rs`) i pristup nalogu kod registrara.
- [ ] **[P0] (K)** Pravni podaci firme: pun naziv, sedište, PIB, matični broj, registar (APR). Obavezno po Zakonu o elektronskoj trgovini.
- [ ] **[P0] (K)** Adresa radnje za lično preuzimanje i link ka mapi; telefoni, Viber i WhatsApp broj, e-pošta za kupce; radno vreme i neradni dani.
- [ ] **[P0] (K)** Tekući račun i banka za predračun (18 cifara sa kontrolnim brojem, npr. `160-0000000123456-78`).
- [ ] **[P0] (K)** Kurirske službe sa kojima radite (D Express, BEX, AKS, Post Express…) i linkovi za praćenje pošiljke. Do tada se broj pošiljke prikazuje bez linka.
- [ ] **[P0] (K)** Pravnik za pregled tekstova (§7).
- [ ] **[P1] (K)** Primer pravog izvoza iz knjigovodstvenog programa (xlsx ili csv, može sa izmišljenim cenama) da proverimo prepoznavanje kolona; i odgovor da li program izvozi maloprodajnu cenu sa PDV-om (MP) ili veleprodajnu bez PDV-a (VP). Ako samo VP, uvoz računa MP = VP × 1,2.
- [ ] **[P1] (K)** Nazivi grupa artikala iz programa, ako se razlikuju od kategorija sajta (da napravimo stalno mapiranje).
- [ ] **[P1] (K)** Fotografije artikala. Uputstvo: tamnosiva ili srednje siva pozadina, ugao 3/4, deo zauzima oko 70 % kadra, bez ruku, rekvizita i znakova proizvođača vozila, najmanje 2000 px po dužoj strani. Do tada se koriste renderi kategorija.
- [ ] **[P1] (K)** Činjenice za početnu stranu (npr. godine rada), samo istinite. Prazno polje se ne prikazuje.
- [ ] **[P2] (K)** Spisak proizvođača delova koje prodajete i nivo kvaliteta (Original VAG / OEM / aftermarket).
- [ ] **[P2] (K)** Pogledati 3D auto (početna, `public/images/hero/`) i sličice delova (`public/images/parts/`) i kratke savete u oblačićima 3D prikaza (npr. „Pre zamene proverite broj na kućištu turbine.“); javiti šta treba drugačije. Kupljen 3D model nekog dela može da zameni generisani (README → 3D pipeline; proveriti licencu za komercijalnu upotrebu).
- [ ] **[P2] (K)** Potvrditi vizuelni pravac „Rendgen“ (`/styleguide`): tamna prodavnica, jedna narandžasta boja za akcije, svetao admin.

## B. Poslovna pravila — potvrditi sa klijentom

Sve je već podešeno na ove vrednosti i menja se u adminu bez programera. Treba samo potvrditi ili promeniti.

- [ ] **[P0] (K)** Cene se čuvaju u parama i prikazuju u dinarima sa PDV 20 %.
- [ ] **[P0] (K)** Broj porudžbine `SK-2026-000123`, broj upita `UP-2026-000045` (prefiks u podešavanjima).
- [ ] **[P0] (K)** Statusi porudžbine: nova → potvrđena → spremna za preuzimanje / poslata → preuzeta / isporučena → završena; otkazana; čeka deo. Statusi upita: nov → u obradi → ponuda poslata → prihvaćena / odbijena / istekla.
- [ ] **[P0] (K)** Stanje se umanjuje kad se porudžbina **potvrdi** i vraća pri otkazivanju. Prag „malo na stanju“ 3 kom.; rok „po porudžbini“.
- [ ] **[P0] (K)** Dostava: lično preuzimanje 0 RSD; kurir pouzećem 450 RSD, besplatno preko 10.000 RSD.
- [ ] **[P0] (K)** Rabat: Majstor 10 %, Majstor Plus 15 %, Partner 20 %, plus izuzeci po kategoriji i proizvođaču. Procenti su javno prikazani na `/za-majstore` i početnoj — potvrditi da smeju.
- [ ] **[P0] (K)** Minimalna marža 8 % iznad nabavne cene (bez PDV-a).
- [ ] **[P0] (K)** Rok za odgovor na upit (SLA) 120 minuta radnog vremena; drugi podsetnik 2 sata kasnije.
- [ ] **[P1] (K)** Odloženo plaćanje: rok 15 dana, limit po majstoru (prazno = bez limita).
- [ ] **[P1] (K)** Važenje ponude 7 dana; automatsko zatvaranje porudžbine 15 dana posle isporuke.
- [ ] **[P1] (K)** Gost može da poruči bez naloga i cene su javne (podrazumevano: da). Ako isključite javne cene, isključite i kupovinu bez naloga.
- [ ] **[P1] (K)** E-pošta obavezna pri porudžbini (podrazumevano: telefon + e-pošta). Ko plaća povraćaj robe (podrazumevano: kupac).
- [ ] **[P1] (K)** Obećanja na sajtu: registraciju majstora proveravate „u toku radnog dana“, upiti servisa „idu prvi na red“. Potvrditi da tako radite.
- [ ] **[P1] (K)** Rok za slanje istog dana: Podešavanja → Prodaja → „Rok za slanje istog dana“ je prazan, pa se rečenica „porudžbine potvrđene do … šaljemo istog dana“ ne prikazuje. Upišite sat ako to obećavate.
- [ ] **[P2] (K)** Ko sme da dobije majstorski nalog: samo firme i radnje sa PIB-om (tako je sada), ili i fizička lica.
- [ ] **[P2] (K)** Za Google rezultate: koliko radnih dana pripremate pošiljku, koliko traje kurirska dostava i ko plaća vraćanje robe kod odustanka. Javite brojeve da ih dodamo u podatke artikla.

---

## 1. Domen i DNS

- [ ] **[P0] (K)** Registrovati ili preuzeti domen (`.rs` kod registrara sa liste RNIDS-a).
- [ ] **[P0] (K+P)** Odlučiti glavnu adresu: `https://www.domen.rs` (preporuka) ili bez `www`. Druga varijanta se preusmerava na glavnu.
- [ ] **[P0] (P)** Kod registrara upisati DNS zapise koje prikaže Vercel (§2) za `www` i za koren domena.
- [ ] **[P0] (P)** Kod registrara upisati DNS zapise za Resend (§5). Proveru domena pokrenuti odmah jer može da traje.
- [ ] **[P1] (P)** TXT zapis za Google Search Console (§11).

## 2. Vercel projekat

Repozitorijum mora biti na GitHub-u (ili GitLab/Bitbucket) pod nalogom klijenta ili programera. Vercel nalog je potreban (Hobby je za lične projekte; za prodavnicu je potreban Pro plan).

- [ ] **[P0] (P)** Vercel → Add New → Project → izabrati repozitorijum. Framework: Next.js. Node.js: 22.x.
- [ ] **[P0] (P)** Build Command: `npx convex deploy --cmd "npm run build"`. Tako svaki build prvo objavi Convex funkcije na produkciju, pa napravi sajt sa `npm run build` (koji uključuje i korak `compile-hints`; ne koristiti goli `next build`).
- [ ] **[P0] (P)** Settings → Functions → Region: **Frankfurt (fra1)**, najbliže Srbiji i Convex EU bazi.
- [ ] **[P0] (P)** Settings → Environment Variables (Production):

  | Promenljiva | Vrednost |
  |---|---|
  | `CONVEX_DEPLOY_KEY` | Convex → produkcioni deployment → Settings → Deploy keys → „Generate production deploy key“ (tajna) |
  | `NEXT_PUBLIC_SITE_URL` | `https://www.domen.rs` |
  | `REVALIDATE_SECRET` | nasumična vrednost, ista kao na Convexu (tajna) |
  | `NEXT_PUBLIC_CONTACT_*` | samo ako kontakt još nije u Podešavanja → Firma |

  `NEXT_PUBLIC_CONVEX_URL` postavlja `convex deploy` sam tokom builda. **Nikad** ne postavljati `NEXT_PUBLIC_TEST_HOOKS` ni `E2E_TEST_HELPERS` na produkciji.
- [ ] **[P0] (P)** Settings → Domains: dodati `www.domen.rs` i `domen.rs`, upisati prikazane DNS zapise kod registrara, sačekati „Valid Configuration“ i HTTPS sertifikat.
- [ ] **[P0] (P)** Za preview build-ove (grane) ili isključiti Convex deploy, ili koristiti Convex preview deploy key; inače preview build objavljuje na produkciju.

## 3. Convex produkcija

- [ ] **[P0] (P)** U Convex dashboard-u otvoriti produkcioni deployment projekta i proveriti da je u **EU** regionu, kao razvojni.
- [ ] **[P0] (P)** Prvo objavljivanje funkcija i šeme: `npx convex deploy` (lokalno, uz potvrdu) ili prvi Vercel build. Nikad ne raditi `convex deploy` ka pogrešnom projektu: proveriti ime deploymenta u izlazu.
- [ ] **[P0] (P)** Promenljive okruženja na produkciji (`npx convex env set --prod …`):

  ```bash
  node scripts/setup/auth-keys.mjs --prod                  # JWT_PRIVATE_KEY + JWKS (novi ključevi, ne sa razvoja)
  npx convex env set --prod SITE_URL https://www.domen.rs
  npx convex env set --prod NEXT_SITE_URL https://www.domen.rs
  npx convex env set --prod LINK_TOKEN_SECRET <48 nasumičnih znakova>
  npx convex env set --prod IP_HASH_SALT <48 nasumičnih znakova>
  npx convex env set --prod REVALIDATE_SECRET <isto kao na Vercelu>
  npx convex env set --prod EMAIL_MODE log
  npx convex env set --prod SEED_ADMIN_EMAIL vlasnik@domen.rs
  npx convex env set --prod SEED_ADMIN_PASSWORD <privremena lozinka>
  ```

  Nasumična vrednost: `node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"`.
  **`LINK_TOKEN_SECRET` se postavlja pre prve porudžbine i posle se ne menja.** Bez njega produkcija namerno odbija porudžbine i upite; promena poništava linkove iz već poslatih mejlova.
- [ ] **[P0] (P)** Napuniti bazu: `npx convex run --prod seed:run` (vozila, kategorije sa SEO tekstovima, proizvođači, nivoi rabata, sadržaj strana, česta pitanja i demo artikli za proveru).
- [ ] **[P0] (P)** Proveriti sajt sa demo artiklima (§12), zatim obrisati demo podatke: Admin → Podešavanja → Opasna zona → „Obriši demo podatke“, potvrda `OBRIŠI DEMO`. Obrisati ili izmeniti demo oglasnu stranu `/ponuda/kocione-plocice-golf` (Podešavanja → Oglasne strane).
- [ ] **[P0] (P)** Provera: `npx convex env list --prod` sadrži `LINK_TOKEN_SECRET`, `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL`, a **ne** sadrži `E2E_TEST_HELPERS`.
- [ ] **[P1] (K+P)** Podaci o vozilima su uneti po opšte poznatim podacima i označeni „seed – proveriti“: modeli, generacije, godine, VIN kodovi modela, kodovi motora, snaga i gorivo, i koji motor ide u koju generaciju (345 veza). Proveriti u Admin → Vozila. Spisak je u istoriji `docs/HUMAN-TODO.md` §9.
- [ ] **[P1] (K)** Proveriti spisak proizvođača i nivo kvaliteta (Admin → Proizvođači).

## 4. Nalog vlasnika i osoblje

- [ ] **[P0] (P)** **Pre nego što sajt bude javno dostupan:** `npx convex run --prod seed:createOwner`. Ako javi `password_mismatch`, neko je već registrovao tu adresu: ne nastavljati, proveriti ko.
- [ ] **[P0] (K)** Prijaviti se na `/prijava`, promeniti lozinku (`/zaboravljena-lozinka`; dok je e-pošta u režimu „Samo zapis“, kod je u Admin → E-pošta).
- [ ] **[P0] (P)** Obrisati seed podatke za prijavu: `npx convex env remove --prod SEED_ADMIN_PASSWORD` i `npx convex env remove --prod SEED_ADMIN_EMAIL`.
- [ ] **[P0] (K)** Zaposleni: Admin → Korisnici → „Pozovi zaposlenog“ → poslati link (važi 7 dana, samo za tu adresu). Zaposleni se registruje tom adresom i klikne „Prihvati pozivnicu“.
- [ ] **[P1] (K)** Svaki zaposleni bira svoja obaveštenja: Podešavanja → Obaveštenja (ili vlasnik u Korisnici).
- [ ] **[P2] (K)** Zaposleni koji je i majstor ne može sam sebi da odobri profil niti da menja svoj rabat i odloženo plaćanje; to radi vlasnik.

## 5. E-pošta (Resend)

Do kraja ovog odeljka sajt radi u režimu „Samo zapis“: svaka poruka se napravi i vidi u Admin → E-pošta, ali ništa ne odlazi.

- [ ] **[P0] (K)** Otvoriti nalog na [resend.com](https://resend.com) i izabrati plan po obimu slanja.
- [ ] **[P0] (P)** Resend → Domains → Add domain (preporuka: poddomen, npr. `mail.domen.rs`, ili sam domen). Kod registrara upisati zapise koje Resend prikaže:
  - **SPF** (TXT, `v=spf1 include:… ~all` na poddomenu za slanje) i **MX** za povratne poruke,
  - **DKIM** (TXT `resend._domainkey…`),
  - **DMARC** (TXT `_dmarc.domen.rs`), za početak `v=DMARC1; p=none; rua=mailto:dmarc@domen.rs`; posle nekoliko nedelja bez problema pooštriti na `p=quarantine`.

  Sačekati status „Verified“.
- [ ] **[P0] (P)** API ključ (API Keys → Create, dozvola „Sending access“): `npx convex env set --prod RESEND_API_KEY re_…`. Ključ nikad u kod ni u git.
- [ ] **[P0] (P)** Pošiljalac sa proverenog domena: `npx convex env set --prod EMAIL_FROM "SKLOP <prodaja@domen.rs>"`. Ime pošiljaoca i adresa za odgovore se menjaju u Podešavanja → Obaveštenja → Slanje e-pošte.
- [ ] **[P0] (P)** Webhook za status isporuke: Resend → Webhooks → Add endpoint, URL `https://<produkcioni-deployment>.convex.site/resend-webhook` (tačna adresa piše u Podešavanja → Obaveštenja), događaji `email.*`. „Signing secret“: `npx convex env set --prod RESEND_WEBHOOK_SECRET whsec_…`. Bez toga mejlovi odlaze, ali se odbijene adrese ne prijavljuju.
- [ ] **[P0] (K)** Pre slanja popuniti Podešavanja → Firma (§6): ti podaci idu u podnožje svakog mejla i u predračun.
- [ ] **[P0] (K+P)** Probno slanje: Podešavanja → Obaveštenja → Slanje e-pošte → **Test** → Sačuvaj; zatim E-pošta → Šabloni → „Pošalji probnu poruku“ za nekoliko šablona i proveriti ih u Resend → Emails. Pa prebaciti na **Uživo**.
- [ ] **[P0] (P)** **Potvrda e-pošte pri registraciji.** Sada svako može da otvori nalog na bilo koju adresu (rizik R01 u `SECURITY-AUDIT.md`). Kad Resend radi, uključiti Convex Auth `verify` u `convex/auth.ts` (kod za potvrdu se šalje već postojećim mejlom) i dodati korak sa kodom na registraciji. Do tada registraciju štite ograničenja (upozorenje preko 60 novih naloga na sat, zatvaranje registracije preko 300).
- [ ] **[P1] (K)** Adrese osoblja (npr. zajednička `prodaja@…`) i sat dnevnog pregleda (08:00) u Podešavanja → Obaveštenja.
- [ ] **[P1] (K)** Radno vreme i neradni dani (Podešavanja → Radno vreme): podsetnici računaju samo radno vreme.
- [ ] **[P2]** SMS i Telegram nisu deo prve verzije; dodaju se kao novi kanal ako zatrebaju (plaćeni SMS servis).

## 6. Podaci firme u podešavanjima

- [ ] **[P0] (K)** Podešavanja → Firma: pun naziv, PIB, matični broj, adresa sedišta i radnje, link ka mapi, telefon, Viber, WhatsApp, e-pošta, tekući račun. PIB, matični broj i račun se proveravaju kontrolnom cifrom. Dok nisu uneti, pregled u adminu, predračun i otpremnica prikazuju žuto upozorenje, a sajt ne prikazuje kontakt (i strana `/kontakt` nema opis za Google).
- [ ] **[P0] (K)** Podešavanja → Radno vreme, Dostava i plaćanje (cene, uključeni načini plaćanja, linkovi kurira), Prodaja (pragovi, rok za slanje istog dana).
- [ ] **[P0] (K)** Kad se unese kontakt: proveriti zaglavlje sajta na telefonu (dugmad „Pozovite“ / „Viber“).
- [ ] **[P1] (K+računovođa)** Pregledati predračun i otpremnicu (porudžbina → „Predračun“ / „Otpremnica“): naziv dokumenta, obavezni podaci, poziv na broj, napomena „Predračun nije fiskalni račun“.

## 7. Pravna provera tekstova

Sve se menja u Podešavanja → Pravni tekstovi. Posle pregleda uključiti „Pravnik je pregledao ovu verziju“ za svaku stranu i ažurirati datume.

- [ ] **[P0] (K+pravnik)** Uslovi korišćenja, politika privatnosti, kolačići, dostava i plaćanje, reklamacije i povrat. Pisani po ZZPL (87/2018), Zakonu o elektronskoj trgovini, ZEK 35/2023 čl. 160 i novom Zakonu o zaštiti potrošača (Sl. glasnik RS 35/2026, primena od 2.8.2026). Posebno proveriti:
  - rokove (odustanak 14 dana od prijema, odgovor na reklamaciju, rešavanje 15 ili 30 dana) i da li su auto delovi „tehnička roba“;
  - obrazac za odustanak od ugovora;
  - izuzetke od prava na odustanak (deo naručen po broju šasije);
  - prenos podataka van Srbije (Convex, Vercel, Resend, Google, Meta);
  - rokove čuvanja podataka (porudžbine 10 godina, upiti 2 godine, pretrage 180 dana…, vidi `PRIVACY-PROCESS.md`) i telo za vansudsko rešavanje sporova.
- [ ] **[P0] (pravnik)** Odgovor u čestim pitanjima „Mogu li da vratim deo?“: „Da. Kao potrošač možete da odustanete od kupovine u roku od 14 dana od prijema, bez navođenja razloga. Trošak vraćanja snosite vi; ako je deo ugrađivan ili oštećen, odgovarate za umanjenje vrednosti.“
- [ ] **[P1] (pravnik)** Rečenica o pravu na odustanak i reklamacijama u mejlu „Porudžbina je isporučena“ (E-pošta → Šabloni → „Isporučena / preuzeta“).
- [ ] **[P1] (pravnik)** Tekst o kolačićima i merenju: Google Analytics, Google Ads, Meta, heširani podaci za merenje oglasa, kolačići `_ga`, `_gcl_*`, `_fbp`, `_fbc`, `sk_consent`, `sk_attr`, i sesijski `sk_attr_s` (izvor posete bez ličnih podataka) — sme li bez pristanka.
- [ ] **[P1] (pravnik)** Odricanje o korišćenju naziva marki u podnožju: „Volkswagen, Audi, Škoda, SEAT i Cupra su registrovani žigovi svojih vlasnika. Nazive marki koristimo samo da bismo označili vozila kojima su delovi namenjeni; SKLOP nije povezan sa proizvođačima vozila niti je njihov ovlašćeni zastupnik.“
- [ ] **[P1] (pravnik)** Evidencija radnji obrade (izuzetak za manje od 250 zaposlenih ima izuzetke), evidencija zahteva kupaca (datum, ko, šta, kada odgovoreno) i godišnji pregled starih naloga i upita (`PRIVACY-PROCESS.md` §4).
- [ ] **[P2] (K)** Česta pitanja i tekstovi „O nama“ i „Kontakt“: proveriti i dopuniti pravim podacima. O nama i Kontakt se menjaju u Pravni tekstovi; česta pitanja za sada menja programer (§D).

## 8. GA4, Google Ads, Meta

Dok su polja prazna, sajt ne učitava nijedan kod za praćenje. Ceo postupak: [`ADS-PLAYBOOK.md`](ADS-PLAYBOOK.md).

- [ ] **[P1] (K)** GA4 Measurement ID, Google Ads Conversion ID i oznake konverzija (porudžbina, upit, registracija majstora) → Podešavanja → Praćenje.
- [ ] **[P1] (K)** Meta Pixel ID → Podešavanja → Praćenje.
- [ ] **[P1] (P)** Meta Conversions API token: `npx convex env set --prod META_CAPI_TOKEN <token>`, pa uključiti „Meta Conversions API“ u Praćenje. Test event kod upisati samo za proveru i obrisati posle.
- [ ] **[P1] (K)** Naziv offline konverzije (Praćenje → „Naziv konverzije za offline uvoz“), tačno kao akcija u Google Ads; nedeljno preuzeti CSV iz Admin → Izvori i uvesti ga u Google Ads. Porudžbine sa GBRAID/WBRAID idu kroz Data Manager; ako Google traži novi šablon, preuzeti aktuelni.
- [ ] **[P1] (K+P)** Posle unosa: proveriti u Google Tag Assistant da se pre pristanka na kolačiće ništa ne šalje, a posle pristanka da strana statusa porudžbine izgleda kao `/porudzbina/[token]` (bez pravog tokena).

## 9. Merchant Center i Meta katalog

- [ ] **[P1] (K)** **Google Merchant Center:** Srbija trenutno nije podržana za Shopping i besplatne oglase (najava od 14.07.2026. povučena 18.08.2026; provereno 30.09.2026). Feed je spreman na `https://www.domen.rs/feeds/google-merchant.xml`; uključiti kad Srbija bude podržana. Pre toga upisati „Rok isporuke“ (dani) za artikle „po porudžbini“ (Admin → Proizvodi), jer feed bez njega ne šalje datum dostupnosti.
- [ ] **[P1] (K)** **Meta katalog:** Commerce Manager → katalog → izvor podataka „Planirani feed“ sa `https://www.domen.rs/feeds/meta-catalog.csv` (dnevno). Proveriti da Commerce Manager nudi RSD za Srbiju; ako ne nudi, katalog ne koristiti (cene se ne prevode u evre).
- [ ] **[P2] (K)** Strane „kategorija × vozilo“ u Google indeksu su ograničene na 300 (Podešavanja → SEO). Povećati tek kad Search Console pokaže da su postojeće indeksirane. Ručni SEO naslov kategorije držati do 45 znakova.

## 10. Google Business Profile

- [ ] **[P1] (K)** Napraviti ili preuzeti profil na [business.google.com](https://business.google.com): kategorija „Prodavnica auto-delova“, **isti** naziv, adresa i telefon kao na sajtu, radno vreme, link ka sajtu, fotografije radnje. Kontrolna lista je u `ADS-PLAYBOOK.md`.

## 11. Search Console i sitemap

- [ ] **[P1] (P)** [Search Console](https://search.google.com/search-console) → svojstvo „Domen“ za `domen.rs`, potvrda TXT zapisom kod registrara.
- [ ] **[P1] (P)** Sitemaps → prijaviti `https://www.domen.rs/sitemap.xml` (indeks sa podfajlovima za strane, kategorije, vozila, landing strane i artikle). Proveriti `https://www.domen.rs/robots.txt`.
- [ ] **[P1] (P)** Bing Webmaster Tools: uvoz svojstva iz Search Console.

## 12. Probne porudžbine (pre objave i ponovo posle „Uživo“)

Na produkciji, sa demo artiklima pre brisanja, pa jednom posle sa pravim artiklom:

- [ ] **[P0] (K+P)** Gost, kurir, pouzeće: porudžbina → mejl „primljena“ kupcu i „nova porudžbina“ osoblju, zvonce u adminu → Potvrdi (stanje se umanji, mejl „potvrđena“) → broj pošiljke → Označi kao poslato (mejl) → Označi kao isporučeno (mejl) → link iz mejla otvara status porudžbine.
- [ ] **[P0] (K+P)** Firma, virman: PIB i matični broj → predračun u mejlu „potvrđena“ sa tekućim računom i pozivom na broj → „Označi kao plaćeno“.
- [ ] **[P0] (K+P)** Lično preuzimanje → „Spremna za preuzimanje“ (mejl) → „Označi kao preuzeto“.
- [ ] **[P0] (K+P)** Otkazivanje sa razlogom: stanje se vraća, kupac dobija mejl.
- [ ] **[P0] (K+P)** Upit po broju šasije sa fotografijom → ponuda → mejl „ponuda je spremna“ → prihvatanje sa linka → nastaje porudžbina.
- [ ] **[P0] (K+P)** Registracija majstora → odobrenje sa nivoom rabata → mejl → prijava majstora → „Vaša cena“ na artiklu → brza porudžbina → odloženo plaćanje (ako je uključeno).
- [ ] **[P0] (P)** Zaglavlja: u pregledaču (Network → prvi zahtev) postoje `content-security-policy` sa `nonce-`, `strict-transport-security`, `x-frame-options: DENY`. Strana statusa ne šalje `Referer`.
- [ ] **[P0] (P)** `https://www.domen.rs/api/zdravlje` vraća 200.
- [ ] **[P0] (K)** Probne porudžbine posle provere otkazati sa razlogom „probna porudžbina“.

## 13. Rezervne kopije

Postupak: [`BACKUPS.md`](BACKUPS.md).

- [ ] **[P0] (P)** Prva kopija produkcije odmah posle punjenja baze i pre brisanja demo podataka: `npx convex export --prod --include-file-storage --path backups/sklop-<datum>.zip`.
- [ ] **[P1] (K+P)** Raspored: svaki dan (čuva se 14 dana), svake nedelje (8 nedelja), prvog u mesecu (12 meseci), i pre svakog većeg zahvata (veliki uvoz sa deaktiviranjem, brisanje demo podataka, promena šeme). Windows Task Scheduler na računaru u radnji ili GitHub Actions sa produkcijskim `CONVEX_DEPLOY_KEY` (čuvati kao najveću tajnu). Kopije čuvati van računara u radnji, šifrovano, nikad u gitu ni mejlom.
- [ ] **[P1] (P)** Jednom mesečno vežba vraćanja u privremenu bazu (`BACKUPS.md` §3); prvu uraditi u prvom mesecu.

## 14. Posle objave

- [ ] **[P1] (P)** Praćenje rada: prijaviti `https://www.domen.rs/api/zdravlje` u UptimeRobot ili Better Stack (besplatan plan), provera na 5 minuta, obaveštenje na mejl ili telefon. Odgovor 503 znači da baza ne odgovara.
- [ ] **[P2] (P)** Praćenje grešaka: Convex → Settings → Integrations (log stream) ili Sentry, i Vercel → Observability.
- [ ] **[P2] (K)** Brzina: [PageSpeed Insights](https://pagespeed.web.dev) za početnu, jednu kategoriju i jedan artikal, na telefonu. Cilj 85+ i LCP ispod 2,5 s. Lokalna laboratorijska merenja (97/98/97) nisu isto što i pravi saobraćaj.
- [ ] **[P2] (K)** Upozorenja u zvoncu „Neuobičajeno mnogo porudžbina“ (preko 300 na sat) ili „… novih naloga“ (preko 60 na sat): pregledati poslednje unose; prijem porudžbina se ne zaustavlja. Javiti ako se javlja pri normalnom radu, da pomerimo prag.
- [ ] **[P2] (K)** Kupci bez e-pošte (pitali telefonom, Viberom): posle slanja ponude koristiti „Link za kupca“ (Viber, WhatsApp, SMS). Takav kupac ne dobija mejlove; o promenama ga obaveštavate telefonom.

---

## D. Dorade za programera (nisu uslov za objavu, osim gde piše)

- [ ] **[P0] (P)** Potvrda e-pošte pri registraciji (§5).
- [ ] **[P1] (P)** Ekran za izmenu čestih pitanja u adminu. Sada se menjaju u `convex/seedData/content.ts` i puštaju na bazu.
- [ ] **[P2] (P)** Napomena „Cena je promenjena“ kad se cena artikla u korpi promeni pre slanja porudžbine (nalaz FLOW-10). Server već računa konačnu cenu pri slanju.
- [ ] **[P2] (P)** Strane 404/403 koje baci sama stranica dobijaju od Next 16.3.6 prazan HTML na serveru (status, naslov i noindex su tačni; sadržaj se prikaže kad se učita JavaScript). Nalaz FLOW-05, odluke D266/D289. Ponovo proveriti posle nadogradnje Next-a.
- [ ] **[P2] (P)** Lab budžet za JavaScript prvog učitavanja: 279–298 KB naspram cilja 160–180 KB (nije uslov; Lighthouse ocene su 97/98/97).
- [ ] **[P3] (P)** 28 manjih P3 nalaza iz `docs/qa/AUDIT.md` (spisak u odeljku „Step 22 — resolution“).
- [ ] **[P3] (P)** `.claude/rules/architecture.md` i `.claude/skills/text-reveal/SKILL.md` još opisuju staro otkrivanje teksta preko GSAP-a i kažu da `@/lib/gsap/client` registruje ScrollTrigger. Sada otkrivanje teksta radi preko CSS animacija (`tr-word`, `tr-word-lite`, `tr-block`), a ScrollTrigger se učitava samo uz 3D na početnoj (`@/lib/gsap/scroll`). Agenti nisu smeli da menjaju `.claude/**`, pa to treba ispraviti ručno.
- [ ] **[P3] (P)** Opis strane `/kontakt` za Google kad su kontakt podaci prazni (sada nema opisa dok se ne unese telefon ili Viber).
