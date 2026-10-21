# Repoziționare: „Observatorul reducerilor reale din România”

**Data:** 2026-10-21 · **Stare:** design validat de proprietar (brainstorming), neimplementat
**Context:** retrogradarea din 21 aug. 2026 (August 2026 Spam Update) — vezi `docs/seo/2026-10-05-audit-scadere-gsc.md`. Nu e cauzată de migrarea de pe WordPress (site-ul nou mergea bine în iul.–aug.); e o judecată de calitate pe modelul „mii de pagini de produs din feed-uri, puțin text propriu”.

## Decizii ale proprietarului

| Întrebare | Decizie |
|---|---|
| Efort editorial uman | **Aproape deloc** → valoarea trebuie să vină din date, automat; fără texte AI în masă (ar fi „scaled content”) |
| Direcție | **Observator de prețuri (identitate) + prag de calitate pe index** |
| Verticale în index | Telefoane, Laptopuri (noi), TV & Audio, Animale de companie (fără farmacie veterinară; Sănătate rămâne exclusă) |
| Prag index `/p/` | **„Are poveste”** (mai jos) |
| Componente | Tracker Black Friday live, Indicele lunar, „Când să cumperi” (pe categorie) |
| Ton „reduceri umflate” | **Pozitiv + agregat**: fără clasament de magazine; umflarea doar agregat pe categorie și ca fapt pe `/p/` |

## 1. Poziționare și politica de index

- Identitate: superieftin.ro măsoară zilnic prețurile din magazinele mari și spune, cu date, dacă o reducere e reală și când merită să cumperi. Comparatorul + linkurile afiliate devin consecința analizei.
- Aceeași formulare (cu cifre live: produse urmărite, magazine, de la ce dată) în homepage (titlu/meta), `Organization.description` (`lib/seo/jsonld.ts`), `/despre`, `llms.txt`.
- Meniu: „Black Friday 2026”, „Indicele prețurilor”, „Când să cumperi” lângă categorii.
- **„Are poveste”**: `/p/` indexabil = regula de azi (`lib/seo/product-index.ts`: ofertă disponibilă, istoric ≥ 30 zile, categorie mapată și vizibilă, nu Sănătate) **ȘI** cel puțin una:
  - ≥ 2 magazine cu preț disponibil;
  - ≥ 3 schimbări de preț în ultimele 60 de zile.
- Numărul de schimbări de preț se precalculează în `offer_price_stats` (migrația 035, scrisă de `worker/src/lib/price-stats.ts`) — nu agregăm `price_history` pe cerere.
- Variante aproape identice (culori/configurații, refurbished în serie) → canonical spre pagina principală a grupului.
- Paginile rămân accesibile vizitatorilor și reclamelor; garda acceptă deja noindex cu `InStock`.
- **Înainte de activare:** cifra exactă de pagini indexabile pe producție (SELECT), prezentată proprietarului.

## 2. Tracker Black Friday — `/black-friday-2026`

- URL permanent; după eveniment = arhivă; anul următor `/black-friday-2027`, linkuri reciproce.
- Definiții (publicate pe pagină):
  - **Referință** = mediana pe 30 de zile **înghețată pe 1 noiembrie** (mediana mobilă ar prinde prețul de BF).
  - **Reducere reală** = preț azi ≥ 5% sub referință.
  - **Reducere umflată** = în cele 14 zile dinaintea reducerii prețul a urcat ≥ 10% peste referință, iar „reducerea” pornește de la prețul urcat. Doar agregat pe categorie + fapt pe `/p/`.
- Conținut (ISR 1 h): cifre-cheie datate („din X produse reduse azi, Y% sunt reduceri reale”); tabel pe categorie (reduse, % reale, reducere reală mediană); top reduceri reale pe vertical (prin `AffiliateLink`); grafic zilnic % reale din 1 nov.; metodologie + FAQ (`FAQPage`).
- Date: `event_reference_prices` (offer_id → mediana înghețată) + `price_snapshots_event` (agregate zilnice pe categorie, scrise de worker după feed-sync; supraviețuiesc ofertelor dispărute/410) — migrația 036.
- Agregatele folosesc doar ofertele confirmate în ultimele 3 zile (regula stale); pagina arată câte magazine intră în calcul.
- `/p/`: rând nou în „Pe scurt despre preț” când e cazul („În cele 14 zile dinaintea reducerii, prețul a crescut cu 18%”).
- Neatinse: textul „Reducere reală” și fraza citită de `parseDiscountPct` (garda de reclame).
- Fără prețuri scrise de mână, fără promisiuni (regula 9). IndexNow la publicare.

## 3. Indicele lunar și „Când să cumperi”

**Indice** — `/indice` (arhivă) + `/indice/YYYY-MM` (ediție imutabilă):
- Coș stabil per categorie: produse cu ofertă disponibilă în ambele luni comparate (schimbările de catalog nu falsifică cifrele).
- Variația medianei pe categorie, cele mai mari scăderi din coș, număr reduceri reale în lună, magazinul cel mai ieftin pe categorie (fapt pozitiv).
- Job BullMQ `price-index` (1 ale lunii, 05:00) → `price_index_monthly` (migrația 037); pagina doar citește. Corecțiile = notă vizibilă, nu rescriere.
- Prima ediție: 2026-10, publicată 1 nov.; arhivă retroactivă iul.–sep. marcată „calculat retroactiv”.

**„Când să cumperi”** — `/cand-sa-cumperi/<categorie>`, **pe categorie, nu pe model**:
- Perioadele cu mediana cea mai joasă, frecvența și durata medie a reducerilor reale, BF anterior (din 2027).
- Regula 9: „de la iunie 2026, de când urmărim categoria”; fără afirmații de sezonalitate anuală până la 12 luni de date (helperi ca `historyPartialSince`).
- Doar categorii cu ≥ 50 de produse în coș; restul nu există (nici noindex).
- Text din marcaje (ca `lib/category-markers.ts`) + FAQ.

**Legături interne:** `/c/` → „Când să cumperi” + indicele categoriei; `/p/` → tracker BF (noiembrie) + categoria; ghidurile Black Friday existente → tracker.

## 4. AI/GEO, riscuri, testare, livrare

**AI/GEO:**
- Fiecare pagină de observator începe cu o frază-fapt citabilă, datată, cu sursă și N.
- `Dataset` JSON-LD pe indice și tracker; `dateModified` real.
- `llms.txt` / `llms-full.txt`: secțiune „Observator” cu ultimele cifre + metodologie.
- Recomandare (decizia proprietarului, Cloudflare): deblocarea GPTBot/ClaudeBot cel puțin pentru paginile observatorului.

**Riscuri:**
- Index mai mic → posibilă scădere temporară de afișări (cost asumat).
- Recuperarea după un spam update durează luni; nu promitem o dată.
- Feed-uri căzute pot distorsiona agregatele → doar oferte confirmate ≤ 3 zile + numărul de magazine afișat.

**Testare:** funcții pure cu teste unitare (definiția umflării, coșul stabil, pragul „are poveste”, frazele) în `web/src/lib/seo/` și `worker`; test de paritate unde logica e dublată web ↔ worker; verificare locală pe date reale; deploy doar prin `/deploy`.

**Ordinea livrării:**
1. Săpt. 1 (≈ 28 oct.): tracker BF + tabelele de snapshot/referință (colectarea pornește înainte de 1 nov.).
2. Săpt. 2 (până la 1 nov.): indicele (prima ediție + arhiva retroactivă); repoziționare homepage / `/despre` / `llms.txt`.
3. Săpt. 3: politica de index „are poveste” + canonical pe variante (după aprobarea cifrelor).
4. După BF: „Când să cumperi” + arhiva BF.
