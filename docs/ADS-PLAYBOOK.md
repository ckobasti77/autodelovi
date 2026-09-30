# Oglašavanje i merenje — priručnik za pokretanje (Google Ads, Meta, GA4, Search Console)

> Za vlasnika prodavnice. Sajt je pripremljen tako da se svaki dinar oglasa može izmeriti: kodovi se uključuju iz Admin → Podešavanja → **Praćenje**, a do tada se ništa ne učitava. Ovaj priručnik opisuje šta treba da uradite u Google i Meta nalozima i kojim redom.
>
> Stanje proveravano 30.09.2026. Pravila oglasnih platformi se menjaju — gde piše „proverite“, pogledajte aktuelni ekran u nalogu pre nego što nešto platite.

## 0. Šta sajt već radi (ne treba programiranje)

| Oblast | Šta je spremno | Gde se vidi / podešava |
|---|---|---|
| Kolačići i saglasnost | Traka „Kolačići“ pri prvoj poseti: Prihvati sve / Odbij sve / Podešavanja (Neophodni, Analitika, Oglašavanje). Pre izbora se **ne učitava nijedan Google ili Meta kod** (Google Consent Mode v2, sve „denied“). Izbor se pamti 180 dana i menja se preko „Podešavanja kolačića“ u podnožju. | Sajt; spisak kolačića na `/kolacici` |
| Google Analytics 4 | Posete, pretrage, pregled artikla, dodavanje u korpu, početak porudžbine, porudžbina (vrednost u RSD sa PDV-om, broj porudžbine), upiti, registracije majstora, klikovi na telefon/Viber/WhatsApp/e-poštu. | Praćenje → „Google Analytics 4 (Measurement ID)“ |
| Google Ads | Konverzije „porudžbina“, „upit“, „registracija majstora“ + poboljšane konverzije (heširana e-pošta i telefon, samo uz pristanak na oglašavanje). | Praćenje → „Google Ads (Conversion ID)“ i oznake |
| Meta Pixel + Conversions API | Pregled artikla, pretraga, korpa, početak porudžbine, kupovina, upit (Lead), registracija majstora, kontakt. Kupovina, upit i registracija idu i **sa servera** (Conversions API) sa istim ID-jem događaja, pa ih Meta broji jednom. | Praćenje → „Meta Pixel ID“, „Meta Conversions API“ + token na serveru |
| Izvor svakog upita i porudžbine | utm_*, gclid/gbraid/wbraid, fbclid, msclkid, sajt sa kog je došao posetilac i prva strana; čuva se 90 dana (uz pristanak). Kolona „Izvor“ u porudžbinama, upitima i majstorima. | Admin → **Izvori**, filteri u listama |
| Offline konverzije | CSV za Google Ads: završene porudžbine koje su došle preko Google oglasa (gclid), uz pristanak kupca. | Admin → Izvori → „Preuzmi CSV (gclid)“ |
| Feedovi proizvoda | Google Merchant (XML) i Meta katalog (CSV), svaki sat osveženi, samo aktivni artikli sa cenom, bez demo artikala. | `/feeds/google-merchant.xml`, `/feeds/meta-catalog.csv` |
| SEO | Naslovi i opisi po šablonu, kanonske adrese, mapa sajta, robots.txt, strukturirani podaci (prodavnica, proizvod sa cenom i stanjem, putanja, liste, pitanja), OG slike za deljenje, strane „kategorija × marka/model“ samo kad imaju dovoljno artikala. | Podešavanja → **SEO**; `/sitemap.xml` |
| Odredišne strane za oglase | `/ponuda/…`: poruka iz oglasa kao naslov, tri činjenice (stanje, dostava, pouzeće), do 24 artikla, telefon/Viber/WhatsApp, upit. Po pravilu van Google pretrage. | Podešavanja → **Oglasne strane** |

## 1. Pre prvog oglasa (redosled je bitan)

1. **Domen i adresa sajta** — produkcijska adresa mora biti upisana kao `NEXT_PUBLIC_SITE_URL` (vidi GO-LIVE). Od nje zavise kanonske adrese, mapa sajta i feedovi.
2. **Obrišite demo podatke** (Podešavanja → Opasna zona). Demo artikli imaju izmišljene brojeve i cene — ne smeju u oglase ni u feed.
3. **Podaci firme, telefon, Viber, WhatsApp, adresa, radno vreme** (Podešavanja → Firma, Radno vreme). Iz njih se prave podaci za Google (prodavnica sa adresom i radnim vremenom), dugmad za poziv i ekstenzije.
4. **Pravni tekstovi** — politika privatnosti i kolačići moraju da pominju Google Analytics, Google Ads i Metu (tekst je pripremljen; pravnik treba da ga potvrdi — HUMAN-TODO).
5. **Kodovi** u Podešavanja → Praćenje (poglavlja 3, 4 i 6). Posle čuvanja, otvorite sajt u privatnom prozoru, prihvatite kolačiće i proverite u Google Tag Assistant i Meta Pixel Helper da se događaji vide.
6. **Tajne na serveru** (radi ih onaj ko vodi server, jednom):
   - `npx convex env set META_CAPI_TOKEN <token>` — Meta Conversions API (poglavlje 6).
   - `REVALIDATE_SECRET` — ista vrednost u Vercel promenljivim i u `npx convex env set REVALIDATE_SECRET <vrednost>`; tada izmene kataloga odmah osvežavaju sajt.

## 2. Google Ads — struktura naloga

**Ciljevi naloga:** „Porudžbina“ (primarno), „Upit“ (primarno dok nema dovoljno porudžbina, kasnije sekundarno), „Registracija majstora“ (sekundarno), „Poziv sa sajta“ (sekundarno).

### 2.1 Kampanje

| Kampanja | Tip | Grupe oglasa | Odredišna strana |
|---|---|---|---|
| **Brend** | Search | naziv prodavnice (kad bude konačan), „naziv + delovi“ | početna |
| **VW — visoka namera** | Search | po kategoriji: kočione pločice, kočioni diskovi, amortizeri, kvačilo i zamajac, turbina, zupčasti kaiš, filteri, farovi… | strana kategorija × marka/model (`/delovi/kocione-plocice/volkswagen/golf`) ili `/ponuda/…` |
| **Škoda — visoka namera** | Search | isto | isto |
| **Audi — visoka namera** | Search | isto | isto |
| **SEAT / Cupra — visoka namera** | Search | isto | isto |
| **OEM brojevi** | Search | ljudi koji kucaju kataloški broj („1K0 615 301“, „5Q0 698 151“) | pretraga na sajtu ili strana artikla |
| **Majstori (B2B)** | Search | „delovi za auto servis“, „veleprodaja auto delova vag“, „rabat za servise“ | `/za-majstore` |
| *(kasnije)* **DSA** | Dinamički oglasi | kategorije `/delovi/…` | automatski |
| *(kad Google omogući)* **Shopping / Performance Max** | — | iz Merchant Center feeda | — |

- Počnite sa 2–3 kampanje (VW + Škoda + Brend) i proširujte posle 2 nedelje, kad vidite pretrage.
- Budžet delite po kampanji, ne po grupi. Dok nema bar ~30 konverzija mesečno, koristite **Maksimizuj klikove sa gornjom granicom cene klika** ili **Maksimizuj konverzije** bez ciljnog CPA; posle toga pređite na **Ciljni CPA / ROAS**.
- Lokacija: Srbija, opcija „Prisutni ili redovno prisutni“ (ne „interesovanje za“). Jezik: srpski i engleski (deo ljudi ima telefon na engleskom).
- Raspored poziva: ekstenzija za poziv samo u radno vreme.

### 2.2 Ključne reči (sa i bez kvačica — ljudi kucaju oba)

Tip podudaranja na startu: **fraza** („…“) i **tačno** ([…]). Široko podudaranje tek kad kampanja ima konverzije i pametno licitiranje.

| Tema | Primeri (upišite obe varijante) |
|---|---|
| Kočnice | kočione pločice golf 7 / kocione plocice golf 7 · kočioni diskovi octavia 3 / kocioni diskovi octavia 3 · pločice passat b8 / plocice passat b8 · diskovi i pločice audi a4 |
| Vešanje | amortizeri golf 6 / amortizeri golf 6 · rame golf 7 · selen blok passat b6 / selen blok passat b6 · spona volana octavia |
| Motor | turbina golf 7 2.0 tdi · turbina 1.9 tdi · set zupčastog kaiša golf 5 / set zupcastog kaisa golf 5 · vodena pumpa 2.0 tdi · egr ventil 1.6 tdi |
| Transmisija | dvomaseni zamajac passat b6 / dvomaseni zamajac passat b6 · zamajac passat b6 · kvačilo sa zamajcem škoda / kvacilo sa zamajcem skoda · dsg ulje |
| Servis | filter ulja 1.9 tdi · filter kabine golf 7 · set filtera octavia 2.0 tdi |
| Elektrika i svetla | far golf 7 / far golf 7 · stop svetlo octavia · alternator 2.0 tdi · anlaser golf |
| Opšte | delovi za golf 7 · delovi za škoda octavia / delovi za skoda octavia · auto delovi vw · rezervni delovi audi |

Modeli koje ljudi najviše traže u Srbiji (proverite u „Planeru ključnih reči“): Golf IV–VIII, Passat B5–B8, Octavia I–IV, Superb, Fabia, Polo, Touran, Caddy, Audi A3/A4/A6, Leon, Ibiza.

### 2.3 Negativne ključne reči (na nivou naloga)

polovni, polovan, polovna, korišćeni / korisceni, otpad, auto otpad, demontaža / demontaza, rastavljanje, besplatno, šema / sema, uputstvo, kako zameniti, kako se menja, video, youtube, pdf, servis cena, cena zamene, cena ugradnje, majstor u blizini, posao, oglasi, kupujemprodajem, polovniautomobili, otkup, tuning, igračka / igracka, maketa, model autića, simulator, forum.

Dodavajte nove svake nedelje iz izveštaja „Pretrage“ (poglavlje 10).

### 2.4 Oglasi (Responsive Search Ads) — primeri u glasu prodavnice

Naslovi (do 30 znakova), bar 10 po grupi, uključujući model i deo:

- Kočione pločice za Golf 7
- Pločice i diskovi za VW
- Tražite po OEM broju
- Cene sa PDV-om, bez skrivenog
- Plaćanje pouzećem
- Preuzimanje u radnji
- Original, OEM i aftermarket
- Pošaljite broj šasije
- Stanje vidite odmah
- Delovi za VW, Audi, Škoda

Opisi (do 90 znakova):

- „Kucajte OEM broj ili izaberite vozilo. Cena sa PDV-om i stanje su odmah na strani.“
- „Poručite bez plaćanja na sajtu: pouzećem ili pri preuzimanju u radnji.“
- „Niste sigurni koji deo? Pošaljite broj šasije — proveravamo pre slanja.“
- „Original VAG, OEM i povoljniji zamenski delovi, jasno označeni.“

Ne obećavajte rok isporuke, popust ni „najnižu cenu“ ako to nije upisano u podešavanjima i tačno za svaki artikal.

### 2.5 Ekstenzije (assets)

- **Linkovi (sitelinks):** Kočnice → `/delovi/kocnice`; Vešanje → `/delovi/vesanje-i-upravljanje`; Upit po broju šasije → `/upit`; Za majstore → `/za-majstore`; Dostava i plaćanje → `/dostava-i-placanje`.
- **Poziv:** broj iz podešavanja, raspored = radno vreme.
- **Lokacija:** povežite Google Business Profile (poglavlje 8).
- **Dodatni tekst (callouts):** „Plaćanje pouzećem“, „Preuzimanje u radnji“, „Cene sa PDV-om“, „Pretraga po OEM broju“, „Delovi za majstore uz rabat“.
- **Strukturisani isečci:** Marke: Volkswagen, Audi, Škoda, SEAT, Cupra.

## 3. Google Ads — konverzije i poboljšane konverzije

1. Google Ads → Ciljevi → Konverzije → **Nova konverzija → Veb-sajt → ručno pomoću koda**.
2. Napravite tri akcije: **Porudžbina** (kategorija „Kupovina“, vrednost „različita za svaku konverziju“, brojanje „Jedna“), **Upit** („Potencijalni klijent“, vrednost bez, brojanje „Jedna“), **Registracija majstora** („Registracija“, sekundarna).
3. Iz „Google tag“ uputstva prepišite:
   - **Conversion ID** (`AW-123456789`) → Podešavanja → Praćenje → „Google Ads (Conversion ID)“;
   - **Conversion label** svake akcije (deo posle `/` u `send_to`) → polja „oznaka: porudžbina / upit / registracija majstora“.
4. **Poboljšane konverzije:** u podešavanjima akcije „Porudžbina“ i „Upit“ uključite „Enhanced conversions“, metod **Google tag**. Sajt šalje heširanu e-poštu, telefon i ime samo kupcima koji su dozvolili oglašavanje — ništa ne treba dodavati.
5. **Consent Mode:** Google Ads → Alati → Podaci → „Consent mode“ treba da pokaže da se signal prima (osnovna implementacija: kod se učitava tek posle pristanka).
6. **Poziv sa sajta** (opciono): akcija „Pozivi sa sajta“ traži Google-ov broj za prosleđivanje — ne koristimo ga; umesto toga u GA4 postoji događaj `contact_click` koji možete uvesti kao sekundarnu konverziju.
7. Proverite: napravite probnu porudžbinu iz privatnog prozora (prihvatite kolačiće), pa posle 3–24 h u Ads → Konverzije status mora biti „Aktivna“.

### 3.1 Offline konverzije (jednom nedeljno)

Plaćanje je pouzećem, pa je prava vrednost „završena porudžbina“, ne „poslata porudžbina“.

1. U Google Ads napravite akciju **Uvoz → Konverzije sa klikova** (naziv npr. „Završena porudžbina“), pa isti naziv upišite u Podešavanja → Praćenje → „Naziv konverzije za offline uvoz“ (mora biti **identičan**).
2. Svakog ponedeljka: Admin → **Izvori** → „Preuzmi CSV (gclid)“ (poslednjih 90 dana; ponovni uvoz istog reda Google preskače).
3. Google Ads → Ciljevi → Konverzije → Uvoz → otpremite fajl (ako ekran upućuje na **Data Manager**, isti fajl se tamo učitava kao „Upload file“). Vremenska zona je u prvom redu fajla (Europe/Belgrade).
4. Porudžbine sa `gbraid`/`wbraid` (iPhone aplikacije) su na istoj strani pobrojane posebno — njih uvezite kroz Data Manager kad Google to ponudi za vaš nalog.
5. Kad offline konverzija ima ≥ 30 redova mesečno, postavite je kao primarnu za licitiranje, a „Porudžbinu“ sa sajta kao sekundarnu.

## 4. Google Analytics 4

1. analytics.google.com → novo svojstvo „SKLOP“ (kasnije pravo ime), **vremenska zona Beograd, valuta RSD**.
2. Tok podataka → Veb → adresa sajta. **Measurement ID** (`G-XXXXXXXXXX`) → Podešavanja → Praćenje.
3. „Poboljšano merenje“: ostavite uključeno, uključujući „promene strane zasnovane na istoriji pregledača“ (sajt ne šalje page_view sam, pa nema dupliranja).
4. Administracija → Događaji: označite kao **ključne događaje** `purchase` i `generate_lead`. `contact_click` po želji.
5. Povežite GA4 sa Google Ads (Administracija → Povezivanje proizvoda) i uvezite **samo one konverzije koje ne šaljete već direktno** (ne dva puta istu porudžbinu).
6. Zadržavanje podataka: 14 meseci. Filter internog saobraćaja: dodajte IP adresu radnje.
7. Izveštaji: Monetizacija → Kupovine (vrednost je sa PDV-om, uključuje dostavu), Akvizicija → izvori saobraćaja. Admin → Izvori na sajtu je tačniji za „ko je poručio“, jer vidi i posetioce koji su odbili kolačiće (bez ličnih podataka).

## 5. UTM oznake (dogovor za sve kanale)

| Parametar | Vrednosti |
|---|---|
| `utm_source` | `google`, `meta`, `viber`, `email`, `instagram_bio`, naziv partnera |
| `utm_medium` | `cpc` (plaćena pretraga), `paid_social` (Meta oglasi), `referral`, `transactional` (e-pošta iz prodavnice), `social` (neplaćene objave) |
| `utm_campaign` | `{kanal}-{marka}-{kategorija}`, mala slova, crtice: `search-vw-kocnice`, `meta-skoda-filteri`, `viber-akcija-oktobar` |
| `utm_content` | oznaka oglasa ili slike: `rsa1`, `karusel-plocice` |
| `utm_term` | samo za ručne linkove; Google Ads ima automatsko označavanje |

- Google Ads: **automatsko označavanje (gclid) mora ostati uključeno**. UTM nije obavezan; ako želite, u „Final URL suffix“ stavite `utm_source=google&utm_medium=cpc&utm_campaign={_kampanja}` sa prilagođenim parametrom.
- Meta: u oglasu → „URL parameters“: `utm_source=meta&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`.
- Viber poruke i objave: uvek dodajte `utm_source=viber&utm_medium=referral&utm_campaign=…`.
- Linkovi u e-porukama prodavnice već nose `utm_source=email&utm_medium=transactional`.

## 6. Meta (Facebook, Instagram) — Pixel, Conversions API, katalog

### 6.1 Pixel i Conversions API

1. business.facebook.com → Events Manager → **Poveži izvore podataka → Veb** → napravite skup podataka (Pixel). **Pixel ID** (15–16 cifara) → Podešavanja → Praćenje → „Meta Pixel ID“.
2. Events Manager → skup podataka → Podešavanja → **Conversions API → „Generiši pristupni token“**. Token se ne upisuje u admin, već na server: `npx convex env set META_CAPI_TOKEN <token>` (za produkciju sa `--prod`, radi ga onaj ko vodi server). Zatim u Podešavanja → Praćenje uključite „Meta Conversions API (sa servera)“. Status tokena vidite ispod: „Status servera i adrese za oglasne naloge“.
3. **Test:** Events Manager → „Test events“ → prepišite test kod u Podešavanja → Praćenje → „Meta test event kod“. Iz privatnog prozora prihvatite kolačiće, pogledajte artikal, dodajte u korpu i poručite. U „Test events“ treba da vidite `ViewContent`, `AddToCart`, `InitiateCheckout` i `Purchase` iz **pregledača i servera**, a `Purchase` označen kao **deduplikovan**. Posle testa **obrišite test kod**.
4. Verifikacija domena: Business Settings → Brand Safety → Domains (DNS TXT zapis).
5. Ako Events Manager traži izbor prioritetnih događaja za domen, stavite redom: Purchase, Lead, CompleteRegistration, InitiateCheckout, AddToCart, ViewContent.
6. Sajt šalje Meti samo kupcima koji su dozvolili oglašavanje: e-pošta, telefon, ime i grad idu heširani (SHA-256), nikad čitljivi.

### 6.2 Katalog (za kataloške / Advantage+ oglase)

1. Commerce Manager → Katalozi → Novi katalog → „E-trgovina“ → **Izvor podataka: planirani feed** → adresa `https://<vaš-domen>/feeds/meta-catalog.csv`, osvežavanje svakodnevno.
2. `id` u feedu je šifra artikla — isti ID šalju Pixel i Conversions API, pa Meta povezuje posete sa artiklima.
3. **Srbija i dinar:** u javnoj Meta dokumentaciji koju smo proverili (30.09.2026) nismo našli potvrdu da katalog i Advantage+ katalog oglasi prihvataju RSD za Srbiju. Pri pravljenju kataloga pogledajte da li je ponuđena valuta RSD; ako nije, **ne prevodite cene u evre** — umesto kataloških oglasa pokrenite obične oglase koji vode na strane kategorija ili `/ponuda/…`.
4. Demo artikli nikad ne ulaze u feed; artikli bez cene ili neaktivni takođe ne.

### 6.3 Predlog kampanja na Meti

- **Remarketing** (posetioci 30 dana koji su gledali artikle, bez kupaca iz poslednjih 30 dana): kataloški oglasi ako je RSD podržan, inače karusel najtraženijih kategorija.
- **Majstori**: interesovanja „automehaničar“, „auto servis“, lookalike iz liste registrovanih majstora (izvoz majstora iz admina, uz njihov pristanak) → `/za-majstore`.
- Kreativa: slike delova sa sajta (render ili fotografija), naslov = deo + model, jasna cena sa PDV-om. Bez logotipa proizvođača vozila.

## 7. Google Merchant Center (Shopping, besplatni oglasi)

- **Status za Srbiju (30.09.2026):** Google je 14.07.2026. najavio Shopping oglase i besplatne oglase za 14 novih tržišta uključujući Srbiju, ali je 18.08.2026. najavu povukao i Srbija više nije na spisku podržanih zemalja (support.google.com/merchants/answer/160637 ne navodi Srbiju ni RSD). Zato **Shopping i Performance Max sa feedom sada ne mogu da se pokrenu**.
- Feed je spreman i ispravan: `https://<vaš-domen>/feeds/google-merchant.xml` (RSS 2.0 sa `g:` poljima, cene u RSD, dostava po pravilu iz podešavanja, Google kategorija proizvoda i putanja kategorije).
- Kad Google uvede Srbiju: napravite Merchant Center nalog → Podaci o firmi → Dostava (iznosi iz Podešavanja → Dostava i plaćanje) → Povraćaj (14 dana) → Proizvodi → „Dodaj feed“ → planirano preuzimanje dnevno → povežite sa Google Ads → prvo **besplatni oglasi**, pa Shopping kampanja „Svi proizvodi“ podeljena po marki proizvođača.
- Mesečno proverite stranicu podrške iznad.

## 8. Google Business Profile (mapa, „auto delovi u blizini“)

- [ ] Profil na tačnu adresu radnje; kategorija **„Prodavnica auto-delova“** (primarna), sporedne po stvarnoj delatnosti.
- [ ] Naziv tačno kao na tabli i sajtu (bez ključnih reči u nazivu).
- [ ] Telefon, sajt (početna strana), radno vreme uključujući praznike — isto kao u Podešavanjima (Google upoređuje sa podacima na sajtu).
- [ ] Opis: šta prodajete (delovi za VW, Audi, Škoda, SEAT, Cupra), pouzeće, preuzimanje u radnji, majstori.
- [ ] Fotografije: spolja, ulaz, pult, police — prave fotografije radnje.
- [ ] Proizvodi/usluge: glavne kategorije sa linkom na `/delovi/…`.
- [ ] Recenzije: posle preuzimanja pošaljite link za ocenu (svima, bez biranja zadovoljnih kupaca); odgovarajte na svaku.
- [ ] Objave jednom nedeljno (nova roba, radno vreme za praznike).
- [ ] Isti naziv, adresa i telefon i na Facebook stranici, Bing Places i Apple Maps.
- [ ] Posle potvrde profila upišite link u Podešavanja → Firma („Link ka mapi“) i povežite profil u Google Ads kao lokaciju.

## 9. Google Search Console i mapa sajta

1. search.google.com/search-console → **Svojstvo za domen** (DNS TXT zapis kod registra domena).
2. Mape sajta → dodajte `https://<vaš-domen>/sitemap.xml` (indeks sa pod-mapama: statične strane, kategorije, vozila, strane kategorija × vozilo, proizvodi).
3. Posle 1–2 nedelje: Stranice → proverite „Isključeno oznakom noindex“ — tu su korpa, nalog, pretrage i strane „kategorija × vozilo“ sa premalo artikala; to je namerno.
4. Pregled URL-a → zatražite indeksiranje za početnu, glavne kategorije i 5 najjačih strana kategorija × model.
5. Strane „kategorija × vozilo“ ulaze u indeks same kad imaju dovoljno artikala (Podešavanja → SEO → pragovi; ograničenje je trenutno 300 strana). **Povećajte ograničenje tek kad Search Console pokaže da su postojeće strane indeksirane i imaju prikaze.**
6. Pretrage koje smeju u indeks (Podešavanja → SEO): dodajte samo upite za koje nemate stranu kategorije ili vozila, npr. popularan OEM broj.
7. Bing Webmaster Tools: uvezite svojstvo iz Search Console (jedan klik) — Bing pokreće i ChatGPT pretragu i Copilot.

## 10. Prvih 30 dana — spisak

**Pre starta (dan 0)**
- [ ] Demo podaci obrisani, podaci firme i radno vreme uneti, pravni tekstovi potvrđeni.
- [ ] GA4, Google Ads i Meta ID-jevi upisani; test porudžbina vidljiva u GA4 (Realtime), Ads (Dijagnostika taga) i Meta (Test events, deduplikovano).
- [ ] Search Console + mapa sajta; Google Business Profile potvrđen.
- [ ] 2–3 Search kampanje (Brend, VW, Škoda), frazno/tačno, negativne reči iz 2.3, sve ekstenzije.

**Nedelja 1**
- [ ] Svaki dan: Google Ads → Pretrage → nove negativne reči; dodajte dobre pretrage kao ključne reči.
- [ ] Admin → Pretrage → „Traženo, a nemamo“: nabavite ili izbacite iz kampanja delove kojih nema.
- [ ] Proverite da su odredišne strane tačne (model u oglasu = model na strani; ako nema dovoljno artikala, vodite na `/ponuda/…` sa izabranim artiklima).

**Nedelja 2**
- [ ] Admin → Izvori (7 dana): koliko upita i porudžbina po kampanji; pauzirajte grupe sa klikovima bez upita.
- [ ] Prvi uvoz offline konverzija (3.1).
- [ ] Dodajte Audi i SEAT/Cupra kampanje ako VW i Škoda imaju konverzije.

**Nedelja 3**
- [ ] A/B: dva oglasa po grupi (jedan sa „pouzećem“ u prvom naslovu, jedan sa „OEM brojem“).
- [ ] Meta remarketing (6.3) sa malim budžetom.
- [ ] Search Console: greške indeksiranja, prve pretrage.

**Nedelja 4**
- [ ] Pređite na „Maksimizuj konverzije“ u kampanjama sa ≥ 15 konverzija; ciljni CPA tek sa ≥ 30.
- [ ] Budžet preraspodelite ka kampanjama sa najmanjom cenom po završenoj porudžbini (Izvori → „Završeno“).
- [ ] Pregledajte kolonu „Izvor“ u porudžbinama: da li majstori dolaze iz oglasa ili direktno.
- [ ] Plan za sledeći mesec: nove kategorije, sezonske teme (zimske gume/akumulatori u jesen, klima u proleće).

## 11. Zaštita podataka — šta se nikad ne radi

- Ne upisujte e-poštu ili telefon kupaca u oglasne naloge ručno; sajt šalje samo heširane vrednosti i samo uz pristanak.
- Ne uključujte „Customer Match“ liste bez izričitog pristanka kupaca na marketing.
- Ne menjajte tekst trake za kolačiće tako da „Prihvati“ bude istaknutije od „Odbij“.
- Token za Meta Conversions API se nikad ne šalje e-poštom niti upisuje u admin.
