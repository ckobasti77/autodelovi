/**
 * Seed content (docs/ROUTES.md §B1 static & legal, docs/DATA-MODEL.md §C2): Serbian page
 * templates and FAQs. Placeholders are filled from settings at render time:
 *   {{key}}            → the value; a line whose required value is empty is dropped
 *   {{key|fallback}}   → the fallback when the value is empty
 * Keys: firma.naziv, firma.pib, firma.mb, firma.adresa, firma.email, firma.telefon,
 * firma.registar, firma.racun, brend, sajt, dostava.kurir.cena, dostava.besplatnoPreko,
 * ponuda.vaziDana, radnoVreme.
 *
 * Every legal page is `needsLegalReview: true` until the owner's lawyer confirms it
 * (docs/HUMAN-TODO.md §3). Texts follow the Zakon o zaštiti potrošača (the 2026 law, Sl. glasnik
 * RS 35/2026, in force from 2.8.2026 — deadlines to be confirmed by the lawyer), the Zakon o
 * elektronskoj trgovini and the Zakon o zaštiti podataka o ličnosti (Sl. glasnik RS 87/2018).
 */

export type SeedPage = {
  slug: string;
  title: string;
  bodyMd: string;
  needsLegalReview: boolean;
};

export type SeedFaq = { scope: string; question: string; answerMd: string };

const SELLER_BLOCK = `## Podaci o prodavcu
- Naziv: {{firma.naziv}}
- Sedište: {{firma.adresa}}
- PIB: {{firma.pib}}
- Matični broj: {{firma.mb}}
- Registracija: {{firma.registar}}
- Tekući račun: {{firma.racun}}
- Telefon: {{firma.telefon}}
- E-pošta: {{firma.email}}`;

export const SEED_PAGES: readonly SeedPage[] = [
  {
    slug: "o-nama",
    title: "O nama",
    needsLegalReview: false,
    bodyMd: `{{brend}} je prodavnica delova za vozila grupe Volkswagen: Volkswagen, Audi, Škoda, SEAT i Cupra. Radimo sa majstorima i auto servisima i sa vozačima koji sami održavaju svoj auto.

## Kako radimo
- Deo tražite po OEM (kataloškom) broju, po vozilu ili klikom na deo na 3D prikazu automobila.
- Za svaki artikal vidite proizvođača, kvalitet (original VAG, OEM kvalitet ili aftermarket), cenu sa PDV-om i stanje.
- Porudžbinu šaljete bez plaćanja unapred. Plaćate pouzećem, pri preuzimanju u radnji ili virmanom uz predračun.
- Kad ne znate broj dela, pošaljete broj šasije (VIN) i šta vam treba, a mi vam javimo ponudu.

## Za majstore
Servisi posle odobrenja naloga vide svoju cenu sa rabatom na celom sajtu, poručuju nalepljenom listom brojeva i imaju istoriju porudžbina na jednom mestu.

## Zašto 3D automobil
Automobil na početnoj strani je generički kompaktni hečbek, a ne konkretan model. Služi kao mapa: kliknete na turbinu, pločice ili amortizer i dobijete delove te kategorije za vaše vozilo.

${SELLER_BLOCK}`,
  },
  {
    slug: "kontakt",
    title: "Kontakt",
    needsLegalReview: false,
    bodyMd: `Najbrže je da nas pozovete ili pišete na Viber. Ako ne znate broj dela, pošaljite upit sa brojem šasije i fotografijom starog dela; odgovaramo u toku radnog dana.

${SELLER_BLOCK}`,
  },
  {
    slug: "dostava-i-placanje",
    title: "Dostava i plaćanje",
    needsLegalReview: true,
    bodyMd: `Na sajtu nema plaćanja karticom. Porudžbinu šaljete bez plaćanja, a mi je potvrđujemo telefonom ili e-poštom pre slanja.

## Načini dostave
- **Lično preuzimanje** u radnji, bez troška. Javljamo vam kad je deo spreman.
- **Kurirska služba** na adresu u Srbiji: {{dostava.kurir.cena|prema ceniku kurirske službe}}. Dostava je besplatna za porudžbine iznad {{dostava.besplatnoPreko|iznosa navedenog u korpi}}.

Porudžbine potvrđene radnim danom do 14 časova šaljemo istog dana, ako je deo na stanju. Rok isporuke kurirske službe je obično 1–2 radna dana. Za delove „po porudžbini“ rok piše na stranici artikla i u potvrdi porudžbine.

## Načini plaćanja
- **Pouzećem** — plaćate kuriru gotovinom pri preuzimanju paketa.
- **Gotovinom ili karticom pri preuzimanju** u radnji.
- **Virmanom uz predračun** — za firme. Predračun šaljemo posle potvrde, a deo rezervišemo do uplate.
- **Odloženo plaćanje** — samo za majstore kojima je ta opcija odobrena, po dogovorenom roku.

## Cene
Sve cene na sajtu su u dinarima (RSD) i uključuju PDV 20 %. Cena važi u trenutku slanja porudžbine; ako se u međuvremenu promeni, pre slanja vidite obaveštenje u korpi.

## Pregled paketa
Pri preuzimanju od kurira pregledajte paket. Ako je oštećen, zapišite to sa kurirom i javite nam se istog dana.`,
  },
  {
    slug: "reklamacije-i-povrat",
    title: "Reklamacije i povrat",
    needsLegalReview: true,
    bodyMd: `Ova pravila važe za kupce koji su potrošači u smislu Zakona o zaštiti potrošača. Za pravna lica i preduzetnike (servise) važe opšta pravila obligacionog prava i dogovor sa prodavcem.

## Odustanak od ugovora (14 dana)
Kod kupovine na daljinu imate pravo da odustanete od ugovora u roku od 14 dana od dana kada ste vi ili lice koje ste odredili preuzeli robu, bez navođenja razloga.

1. Pošaljite nam izjavu o odustanku e-poštom ({{firma.email|adresa sa stranice Kontakt}}) ili pismom na adresu prodavca. Dovoljno je da navedete broj porudžbine, artikal i da odustajete od ugovora.
2. Robu vratite najkasnije 14 dana od slanja izjave, neoštećenu i u originalnom pakovanju. Trošak vraćanja robe snosite vi.
3. Novac za robu (i za osnovnu dostavu, ako ste je platili) vraćamo najkasnije u roku od 14 dana od prijema izjave, istim načinom plaćanja ili uplatom na vaš račun. Povraćaj možemo zadržati dok ne primimo robu ili dokaz da je poslata.

Pravo na odustanak nemate za robu izrađenu po vašoj specifikaciji ili jasno prilagođenu vama (na primer deo naručen specijalno za vaše vozilo po broju šasije, ako je to naglašeno u ponudi), kao ni za robu u zapečaćenom pakovanju koja iz zdravstvenih ili higijenskih razloga nije pogodna za vraćanje posle otvaranja. Za ugrađen deo koji je korišćen odgovarate za umanjenje vrednosti nastalo rukovanjem koje nije neophodno da bi se utvrdila priroda i svojstva robe.

## Reklamacija (saobraznost robe)
Ako deo ima nedostatak, reklamaciju možete izjaviti u roku od dve godine od dana prijema robe.

1. Javite nam se telefonom, e-poštom ili lično i dostavite račun ili drugi dokaz o kupovini (na primer broj porudžbine).
2. Prijem reklamacije potvrđujemo i upisujemo je u evidenciju reklamacija.
3. Na reklamaciju odgovaramo bez odlaganja, a najkasnije u roku od 8 dana od prijema, pisanim ili elektronskim putem.
4. Reklamaciju rešavamo u zakonskom roku od podnošenja (15 dana, odnosno 30 dana za tehničku robu) — popravkom, zamenom, umanjenjem cene ili raskidom ugovora, u skladu sa zakonom.

Pre ugradnje proverite da li deo odgovara vozilu (OEM broj, oznaka motora, broj šasije). Nedostatak nastao nestručnom ugradnjom ili upotrebom suprotnom uputstvu proizvođača nije osnov za reklamaciju.

## Garancija proizvođača
Kada proizvođač daje garanciju, uslovi i rok garancije navedeni su u garantnom listu ili na stranici artikla. Garancija ne isključuje vaša prava po osnovu saobraznosti.

## Vansudsko rešavanje sporova
Ako spor ne rešimo dogovorom, možete se obratiti telu za vansudsko rešavanje potrošačkih sporova sa liste ministarstva nadležnog za zaštitu potrošača.

${SELLER_BLOCK}`,
  },
  {
    slug: "uslovi-koriscenja",
    title: "Uslovi korišćenja i kupovine",
    needsLegalReview: true,
    bodyMd: `Ovi uslovi uređuju korišćenje sajta {{sajt|ovog sajta}} i kupovinu robe preko njega. Slanjem porudžbine potvrđujete da ste ih pročitali i da ih prihvatate.

${SELLER_BLOCK}

## Katalog i cene
- Cene su izražene u dinarima (RSD) i uključuju PDV 20 %.
- Trudimo se da podaci o artiklima (OEM brojevi, kompatibilnost, stanje) budu tačni. Kompatibilnost sa vozilom je informativna; pre ugradnje uporedite OEM broj sa starim delom ili nam pošaljite broj šasije.
- Nazive marki vozila koristimo samo da bismo označili vozila kojima su delovi namenjeni. Nismo povezani sa proizvođačima vozila niti smo njihov ovlašćeni zastupnik.
- Artikli označeni kao demo služe za prikaz rada sajta i ne mogu se kupiti dok ih ne zamene stvarni artikli.

## Porudžbina i zaključenje ugovora
1. Porudžbinu šaljete iz korpe, kao gost ili prijavljeni korisnik.
2. Posle slanja dobijate broj porudžbine i potvrdu na e-poštu. To je potvrda prijema, ne i prihvat ponude.
3. Ugovor je zaključen kada porudžbinu potvrdimo telefonom ili e-poštom. Ako artikal nije dostupan ili je cena pogrešno objavljena, javljamo vam se pre potvrde i možete odustati bez troška.

## Plaćanje i dostava
Načini plaćanja i dostave, rokovi i troškovi opisani su na stranici „Dostava i plaćanje“. Na sajtu se ne unose podaci o platnim karticama.

## Odustanak, reklamacije i garancija
Prava potrošača na odustanak od ugovora zaključenog na daljinu i na reklamaciju opisana su na stranici „Reklamacije i povrat“.

## Nalog na sajtu
Nalog je opcion. Odgovorni ste za čuvanje lozinke. Nalog možemo privremeno blokirati u slučaju zloupotrebe (na primer lažnih porudžbina).

## Nalozi za majstore (B2B)
Registracija servisa podleže odobrenju. Rabat, odloženo plaćanje i drugi uslovi za pravna lica i preduzetnike dogovaraju se posebno; na njih se ne primenjuju pravila Zakona o zaštiti potrošača koja važe samo za potrošače.

## Zaštita podataka
Obradu podataka o ličnosti opisuje „Politika privatnosti“, a kolačiće stranica „Kolačići“.

## Izmene uslova
Uslove možemo izmeniti; na porudžbinu se primenjuju uslovi važeći u trenutku njenog slanja.`,
  },
  {
    slug: "politika-privatnosti",
    title: "Politika privatnosti",
    needsLegalReview: true,
    bodyMd: `Ova politika objašnjava koje podatke o ličnosti obrađujemo, zašto, koliko dugo i koja su vaša prava, u skladu sa Zakonom o zaštiti podataka o ličnosti.

## Rukovalac
- {{firma.naziv|Prodavac naveden na stranici Kontakt}}
- Adresa: {{firma.adresa}}
- E-pošta za pitanja o podacima: {{firma.email}}

## Koje podatke obrađujemo i zašto
| Podaci | Svrha | Pravni osnov |
|---|---|---|
| Ime, prezime, telefon, e-pošta, adresa dostave | Obrada porudžbine, dostava, obaveštenja o statusu | Izvršenje ugovora |
| Podaci firme (naziv, PIB, matični broj) | Predračun, račun, poslovanje sa firmama | Izvršenje ugovora, zakonska obaveza |
| Broj šasije (VIN), fotografije dela, opis | Odgovor na upit i izrada ponude | Vaš zahtev pre zaključenja ugovora |
| Podaci o porudžbinama i računima | Knjigovodstvena evidencija | Zakonska obaveza |
| Pretrage na sajtu (bez ličnih podataka) | Dopuna asortimana („traženo, a nemamo“) | Legitimni interes |
| Izvor posete (npr. oznaka kampanje) | Merenje koje reklame donose porudžbine | Legitimni interes; za oglasne kolačiće pristanak |
| E-pošta za „Javi mi kad stigne“ | Jedno obaveštenje o dolasku robe | Pristanak |

## Koliko dugo čuvamo podatke
- Porudžbine i račune koliko propisi o računovodstvu zahtevaju.
- Upite do 24 meseca od poslednje komunikacije.
- Prijave „Javi mi kad stigne“ do slanja obaveštenja ili odjave.
- Fotografije iz upita do 12 meseci.

## Primaoci
Podatke dobijaju samo oni kojima su potrebni za izvršenje usluge: kurirska služba (ime, adresa, telefon), pružalac usluge slanja e-pošte i pružaoci infrastrukture na kojoj sajt radi. Neki od njih obrađuju podatke van Srbije, uz mere zaštite propisane zakonom. Podatke ne prodajemo.

## Vaša prava
Imate pravo da zatražite pristup podacima, ispravku, brisanje, ograničenje obrade i prenosivost, pravo na prigovor i pravo da u svakom trenutku opozovete pristanak. Zahtev pošaljite na {{firma.email|e-poštu sa stranice Kontakt}}; odgovaramo najkasnije u roku od 30 dana. Imate pravo i da podnesete pritužbu Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti.

## Bezbednost
Lozinke se ne čuvaju u čitljivom obliku, veza sa sajtom je šifrovana, a pristup podacima u administraciji imaju samo ovlašćeni zaposleni i beleži se.`,
  },
  {
    slug: "kolacici",
    title: "Kolačići",
    needsLegalReview: true,
    bodyMd: `Kolačići i slični zapisi (localStorage) su mali podaci koje sajt čuva u vašem pregledaču.

## Neophodni (uvek uključeni)
| Naziv | Svrha | Trajanje |
|---|---|---|
| Kolačići prijave | Održavanje prijave na nalog | Do 30 dana |
| sk_cart (localStorage) | Korpa za kupovinu bez naloga | Dok ga ne obrišete |
| sk.vehicle.v1 (localStorage) | Izabrano vozilo za filtriranje delova | Dok ga ne obrišete |
| sk_attr_s | Izvor dolaska na sajt (oznake kampanje), vezan za porudžbinu ili upit | Do zatvaranja pregledača |

## Analitika i oglašavanje (samo uz vaš pristanak)
Alati za merenje posećenosti i oglašavanja (Google Analytics, Google Ads, Meta Pixel) uključuju se tek kada to odobrite u podešavanjima kolačića. Do tada se ne učitavaju.

## Kako da upravljate kolačićima
Izbor možete promeniti preko linka „Podešavanja kolačića“ u podnožju sajta, a kolačiće obrisati u podešavanjima pregledača.`,
  },
];

export const SEED_FAQS: readonly SeedFaq[] = [
  {
    scope: "home",
    question: "Kako da budem siguran da deo odgovara mom autu?",
    answerMd:
      "Najsigurnije je po OEM broju sa starog dela ili iz servisne knjižice: upišite ga u pretragu kako god ga imate, razmaci i crtice ne smetaju. Ako broja nemate, izaberite vozilo i motor, pa na stranici artikla proverite tabelu kompatibilnosti. Kad niste sigurni, pošaljite upit sa brojem šasije (VIN) — proverimo pre slanja.",
  },
  {
    scope: "home",
    question: "Gde nalazim broj šasije (VIN)?",
    answerMd:
      "U saobraćajnoj dozvoli, polje E. Na vozilu je utisnut ispod vetrobranskog stakla sa strane vozača i na nalepnici na B-stubu. Ima 17 znakova, bez slova I, O i Q.",
  },
  {
    scope: "home",
    question: "Šta znači original VAG, OEM kvalitet i aftermarket?",
    answerMd:
      "Original VAG je deo u pakovanju proizvođača vozila. OEM kvalitet je deo proizvođača koji isti deo isporučuje fabrici (npr. Bosch, LuK, Valeo), u sopstvenom pakovanju. Aftermarket je zamenski deo drugog proizvođača, obično povoljniji. Proizvođač i kvalitet pišu na svakom artiklu.",
  },
  {
    scope: "home",
    question: "Da li plaćam unapred?",
    answerMd:
      "Ne. Porudžbinu šaljete bez plaćanja. Plaćate kuriru pouzećem, gotovinom ili karticom pri preuzimanju u radnji, a firme mogu virmanom uz predračun.",
  },
  {
    scope: "home",
    question: "Koliko košta dostava i kada stiže?",
    answerMd:
      "Kurirska dostava je {{dostava.kurir.cena|navedena u korpi}}, a besplatna za porudžbine iznad {{dostava.besplatnoPreko|iznosa iz korpe}}. Delove na stanju šaljemo istog radnog dana za porudžbine potvrđene do 14 časova; kurir obično isporučuje za 1–2 radna dana. Lično preuzimanje je bez troška.",
  },
  {
    scope: "home",
    question: "Mogu li da vratim deo?",
    answerMd:
      "Kao potrošač možete odustati od kupovine u roku od 14 dana od prijema, ako deo nije ugrađivan i vraćate ga u originalnom pakovanju. Detalji su na stranici Reklamacije i povrat.",
  },
  {
    scope: "home",
    question: "Radim u servisu. Imate li posebne cene?",
    answerMd:
      "Imamo. Registrujte servis na stranici Za majstore; posle odobrenja vidite svoju cenu sa rabatom na celom sajtu i poručujete nalepljenom listom OEM brojeva.",
  },
  {
    scope: "home",
    question: "Deo nije na stanju. Šta sada?",
    answerMd:
      "Na stranici artikla uključite „Javi mi kad stigne“ ili pošaljite upit — često možemo da nabavimo deo ili ponudimo zamenu drugog proizvođača sa istim OEM brojem.",
  },
  {
    scope: "za-majstore",
    question: "Ko može da dobije majstorski nalog?",
    answerMd:
      "Registrovani auto servisi, vulkanizeri, autoelektričari i limari koji kupuju delove za vozila svojih mušterija. Potrebni su naziv firme ili radnje, PIB i matični broj.",
  },
  {
    scope: "za-majstore",
    question: "Koliko traje odobrenje?",
    answerMd:
      "Registraciju proveravamo u toku radnog dana. Kad nalog odobrimo, stiže vam e-mail sa nivoom rabata, a cene na sajtu se odmah menjaju u vaše.",
  },
  {
    scope: "za-majstore",
    question: "Kako se računa rabat?",
    answerMd:
      "Rabat se računa od maloprodajne cene sa PDV-om, po nivou saradnje. Za pojedine proizvođače i kategorije procenat može biti drugačiji; tačnu cenu uvek vidite na artiklu, u korpi i u cenovniku koji preuzimate iz portala.",
  },
  {
    scope: "za-majstore",
    question: "Kako radi brza porudžbina?",
    answerMd:
      "Nalepite brojeve delova, jedan po redu, sa količinom (npr. `1K0615301AA 2`) ili otpremite CSV. Sistem prepoznaje brojeve sa razmacima, tačkama i crticama, pokaže šta je na stanju i po kojoj ceni, a brojeve koje nemamo šaljete kao upit jednim klikom.",
  },
  {
    scope: "za-majstore",
    question: "Mogu li da platim kasnije?",
    answerMd:
      "Odloženo plaćanje uključujemo servisima sa kojima redovno radimo, uz dogovoreni rok i limit. Do tada plaćate pouzećem, pri preuzimanju ili virmanom uz predračun.",
  },
  {
    scope: "za-majstore",
    question: "Da li dostavljate u servis?",
    answerMd:
      "Da. Kurir dostavlja na adresu servisa iz vašeg profila; adresu možete promeniti pri svakoj porudžbini. Lično preuzimanje u radnji je bez troška.",
  },
];
