# Euromotors Plus · OEM Parts — Promenljive okruženja za puštanje uživo

> Deo dokumentacije sajta Euromotors Plus — indeks: [README](README.md). Bezbednosni pregled: [SECURITY-AUDIT](SECURITY-AUDIT.md). Ova lista ulazi u `docs/GO-LIVE.md` (korak 23).

Postoje dva mesta:

- **Convex** (baza i serverske funkcije) — postavlja se komandom
  `npx convex env set --prod NAZIV "vrednost"` (za razvoj bez `--prod`).
- **Vercel** (sajt) — Project → Settings → Environment Variables (Production), pa ponovo objaviti sajt.

Tajne vrednosti se **nikad** ne upisuju u kod, u git ni u poruke. Nasumičnu vrednost od 48 znakova možete napraviti ovako:
`node -e "console.log(require('crypto').randomBytes(36).toString('base64url'))"`

## 1. Convex (produkcija)

| Promenljiva | Tajna | Obavezno | Čemu služi |
|---|---|---|---|
| `JWT_PRIVATE_KEY`, `JWKS` | da | **da** | Ključevi prijave (Convex Auth). Prave se jednom za produkciju (postupak u `docs/SECURITY.md` §D1); stari ključevi sa razvoja se ne prenose. |
| `SITE_URL` | ne | **da** | Adresa sajta, npr. `https://www.domen.rs` (Convex Auth i linkovi u mejlovima). |
| `NEXT_SITE_URL` | ne | preporuka | Ista adresa sajta — ima prednost za linkove u mejlovima i kanal za osvežavanje keša. |
| `LINK_TOKEN_SECRET` | da | **da** | Ključ za linkove ka statusu porudžbine/upita. **Bez njega produkcija odbija da napravi porudžbinu** (namerno — inače bi linkovi mogli da se izračunaju). Postaviti pre prve porudžbine i posle ne menjati (promena poništava stare linkove; vidi `maintenance:rekeyStatusLinks`). |
| `IP_HASH_SALT` | da | preporuka | So za heširanje IP adrese u ograničenjima zahteva. Ako nije postavljena, izvodi se iz `LINK_TOKEN_SECRET`. |
| `REVALIDATE_SECRET` | da | preporuka | Isti tekst kao u Vercelu; posle izmene kataloga/podešavanja sajt se osvežava odmah (bez nje za 5–60 min). |
| `EMAIL_MODE` | ne | da | `log` (samo zapis u adminu), `test` (šalje na probnu adresu Resend-a), `live` (pravi mejlovi). |
| `RESEND_API_KEY` | da | za mejlove | Ključ Resend naloga (HUMAN-TODO §4). |
| `RESEND_WEBHOOK_SECRET` | da | za mejlove | Potpis Resend webhooka `https://<convex-site>/resend-webhook` (isporučeno, odbijeno…). |
| `EMAIL_FROM` | ne | za mejlove | Pošiljalac sa proverenog domena, npr. `Euromotors Plus <prodaja@domen.rs>` (pravi domen: GO-LIVE §A). |
| `META_CAPI_TOKEN` | da | za Meta oglase | Token za Conversions API (ADS-PLAYBOOK §6). Prazno = kanal isključen. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | lozinka da | samo jednom | Za `npx convex run --prod seed:createOwner`. Pokrenuti **pre** nego što sajt bude javno dostupan; ako nalog sa tom adresom već postoji, postaje vlasnik samo ako ima baš tu lozinku. Posle prve prijave promeniti lozinku i obrisati obe promenljive (`npx convex env remove --prod …`). |
| `E2E_TEST_HELPERS` | ne | **nikad na produkciji** | Uključuje test-pomagače (`convex/testing.ts`) samo na razvojnom deploymentu. |

`CONVEX_SITE_URL` i `CONVEX_CLOUD_URL` Convex postavlja sam.

## 2. Vercel (sajt, Production)

| Promenljiva | Tajna | Obavezno | Čemu služi |
|---|---|---|---|
| `CONVEX_DEPLOY_KEY` | da | **da** | Da build objavi Convex funkcije na produkciju (Vercel integracija ili ručno). |
| `NEXT_PUBLIC_CONVEX_URL` | ne | **da** | Adresa produkcijske Convex baze (`https://<ime>.convex.cloud`). Ulazi i u CSP. |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | ne | **da** | `https://<ime>.convex.site` (HTTP rute; ulazi u CSP). |
| `NEXT_PUBLIC_SITE_URL` | ne | **da** | `https://www.domen.rs` — kanonske adrese, slike za deljenje, sitemap. |
| `REVALIDATE_SECRET` | da | preporuka | Isti tekst kao u Convexu. |
| `NEXT_PUBLIC_CONTACT_PHONE`, `…_VIBER`, `…_WHATSAPP`, `…_EMAIL` | ne | ne | Rezervni kontakt dok se ne unese u Admin → Podešavanja → Firma. |
| `NEXT_PUBLIC_TEST_HOOKS` | ne | **nikad na produkciji** | Samo za automatske testove 3D prikaza. |

Sve što počinje sa `NEXT_PUBLIC_` vidi svaki posetilac — tu nikad ne sme da stoji tajna.

## 3. Provera posle objave

1. `https://www.domen.rs` u pregledaču → alatke za programere → Network → prvi zahtev: moraju postojati zaglavlja `content-security-policy` (sa `nonce-`), `strict-transport-security`, `x-frame-options: DENY`.
2. `npx convex env list --prod --names-only` sadrži `LINK_TOKEN_SECRET`, `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` i nema `E2E_TEST_HELPERS` ni `SEED_ADMIN_PASSWORD`.
3. Probna porudžbina → link iz mejla otvara status; stranica statusa ne šalje `Referer`.
4. Posle pristanka na kolačiće, u Google Tag Assistant stranica statusa porudžbine mora da se vidi kao `/porudzbina/[token]`.
