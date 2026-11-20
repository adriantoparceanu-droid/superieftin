# Reorganizare: din comparator în blog de recomandări — design

Data: 20 noiembrie 2026 · Status: validat de proprietar (brainstorming), neimplementat

## De ce

1. **eMAG refuză sursa.** În Profitshare, `www.superieftin.ro` (tip „agregatoare”) apare la eMAG
   cu „Neacceptat de advertiser”: eMAG nu acceptă trafic de la comparatoare. Comisioanele din
   clickurile de pe comparator riscă să fie respinse. eMAG = cel mai mare comision (până la 20%).
2. **Google nu valorifică paginile de comparare.** Search Console (sc-domain:superieftin.ro):
   afișări/săpt. 600–950 în iul.–aug. (poziție ~21–32) → 80–130 din oct. (poziție 40–52);
   clickuri 9–18/săpt. → 0–8. Căderi: 24 aug. (fără schimbare din partea noastră) și 5/21 oct.
   (noindex pe `/p/` cu istoric scurt / „fără poveste”: pagini `/p/` cu afișări 166 → 38).
   Eșantion URL Inspection pe `/p/` din sitemap: multe „Google nu cunoaște adresa” sau
   „Descoperită – nu este indexată”. Paginile cu conținut propriu (home, `/ghiduri`,
   `/reduceri-reale`) sunt indexate.

Concluzie: site-ul devine un **blog de recomandări** (conținut propriu), iar datele de preț
devin unealtă internă de lucru.

## Decizii (proprietar, 20.11.2026)

| Întrebare | Decizie |
|---|---|
| Comparatorul public | Dispare — doar articole (blog curat) |
| Produsul în articol | Card cu UN singur buton spre cel mai ieftin magazin partener |
| Istoricul de preț | DOAR intern (risc să fie văzut tot ca agregator) |
| Adresele `/p/` | 308 spre articolul în care apare produsul, altfel 410 |
| Observatorul (`/indice`, `/cand-sa-cumperi`, `/black-friday-2026`, `/reduceri-reale`) | Devin articole periodice; paginile → 308 spre articol sau 410 |
| Cine scrie | Claude ciornă → proprietarul verifică și publică (2–3/săpt.) |
| Tipuri de articole | Top-uri pe buget, comparații X vs Y, ghiduri de alegere, „Merită acum?” |
| eMAG până la reclasificare | Pauză (reversibilă) din Admin → Magazine |

## 1. Partea publică

- **Homepage**: articole noi + cele mai citite, pe teme.
- **Articole**: `/ghiduri/<slug>` (adrese păstrate — 11 deja indexate); în meniu „Articole”.
- **`/c/<temă>`**: textul introductiv existent (`intro_md`, FAQ) + lista articolelor din temă.
  Fără liste de produse, fără prețuri, fără filtre de marcă.
- Paginile legale/de încredere + `/llms.txt` rămân.
- **Sitemap**: doar articole + teme (zeci de adrese, nu ~18.000).
- **Dispar**: `/p/`, `/t/`, `/reduceri-reale` (+ landing-uri), `/indice`, `/cand-sa-cumperi`,
  `/black-friday-2026`; alertele de preț publice (Telegram + email).

## 2. Cardul de produs (marcajele din articole)

**Regula „cel mai ieftin magazin partener”** — o singură funcție (web; dublată în worker doar
dacă e nevoie, cu test de paritate):
- doar oferte disponibile (`OFFER_AVAILABLE_SQL`) ȘI cu `affiliate_url`;
- câștigă prețul cel mai mic; la egalitate, oferta confirmată cel mai recent;
- textul: „cel mai bun preț găsit la magazinele partenere” (nu „cel mai mic din România”).

**Cardul** (`{{oferte:ID}}` își schimbă randarea): poză, nume, prețul de azi, magazinul,
buton „Vezi la <magazin>” prin `AffiliateLink` → `/go/`. Fără grafic, mediană, procente,
„Reducere reală”. Fără ofertă disponibilă: „Momentan indisponibil la magazinele partenere”,
fără buton.

- `{{comparatie:ID1,ID2}}` → tabel de specificații față în față + câte un buton pe produs.
- `{{pret:ID}}` = prețul ofertei alese. `{{reducere:ID}}` și `{{istoric-pret:ID}}` ies din
  setul public de marcaje (istoricul e intern); validarea importului le respinge.
- Afirmațiile de timing („cel mai mic preț din ultimele 3 luni”) se scriu în cuvinte, pe baza
  datelor interne, ca fapte `confirmat` (regula 9: nimic ce nu putem dovedi).

## 3. Unealta internă și fluxul de scriere

- **`cd worker && npm run cercetare -- --tema=<slug> [--buget=N]`**: candidați disponibili cu
  link afiliat — cel mai bun preț + magazin, mediana 30 z, min 90 z, nr. magazine,
  schimbări de preț 60 z. Sursa pentru ciorne.
- **`/admin/cercetare`**: același tabel cu filtre + fișa veche de produs (grafic, verdict) mutată
  în admin (protejat, noindex).
- **Flux**: subiect din căutări reale (Search Console + termeni Ads din `/admin/statistici`) și
  din cercetare → `content/ghiduri/drafts/<slug>.json` → `npm run ghiduri:import` (ciornă) →
  proprietarul bifează fișa de verificare și publică. Regulile de publicare rămân.
- **Verificare săptămânală** (job BullMQ nou): pentru fiecare articol publicat semnalează în admin
  + Telegram produsele indisponibile, prețul ieșit din bugetul din titlu, articolele neactualizate
  de > 90 de zile. Doar semnalează; corecția o propune Claude, o aprobă proprietarul.
- **Start**: 10 articole noi; cele 11 ghiduri existente trec automat pe cardul nou.

## 4. Tranziția

1. **Acum**: eMAG pe pauză (Admin → Magazine).
2. **Construcție** pe branch separat; cele 10 articole scrise ca ciorne în paralel.
3. **Ziua schimbării** (un deploy): publicare articole; pagini noi + 308/410 + sitemap; toate
   campaniile Google Ads pe pauză (landing-uri `/p/`), refăcute spre articole după PASS
   policy-reviewer; mesaj de rămas-bun abonaților la alerte, apoi ștergerea datelor lor.
4. **După 2–4 săptămâni**: sursă nouă „blog/site de conținut” în Profitshare + reaplicare eMAG;
   eMAG repornit doar după acceptare.

**Nu se schimbă**: feed-uri, scanare eMAG (locală), `price_history` + `offer_price_stats`,
`/go/` (anti-roboți, click_id), `tracking:sync`, consimțământ, GA4.

**Riscuri asumate**: scădere pe termen scurt a afișărilor (deja mici); pierderea abonaților la
alerte; eMAG poate refuza și blogul (rămânem cu magazinele care acceptă).

## Testare

- Unitare: alegerea ofertei (disponibilă + afiliat + egalitate), harta 308/410, cardul
  indisponibil, regulile verificării săptămânale, validarea marcajelor scoase.
- E2E existent pe `/go/` pornit din cardul nou.
- Înainte de deploy: eșantion de adrese vechi din sitemap → 308/410 corect; sitemap + robots.
- După deploy: URL Inspection pe articole; clickuri afiliate în GA4.

## De actualizat la implementare

CLAUDE.md (secțiunile Ghiduri, SEO tehnic, Observator, Alerta de preț, Filtrul de marcă,
Pagina `/p/`, garda Ads) — o informație veche e mai rea decât una lipsă.
