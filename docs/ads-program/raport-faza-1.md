# Raport Faza 1 — site pregătit pentru reclame

Data: 2026-09-26 · Branch: `ads/faza-1-site` (neimplementat pe producție)

## Ce s-a făcut (un commit per punct)

| # | Punct | Commit | Stare |
|---|---|---|---|
| 1 | Banner cookies propriu + Consent Mode v2 | `8142e1c` | ✅ testat (dev + build de producție) |
| 2 | Pagini de încredere + footer | `08fa9ed` | ⚠️ lipsesc datele firmei |
| 3 | „Mediana 30 de zile” + mesaj de status cu procent (±5%) | `852f3f6` | ✅ |
| 4 | Landing pages `/reduceri-reale/[categorie]` | `5d6b960` | ✅ |
| 5 | Redirecționări pentru URL-urile vechi | `466f838` | ✅ |
| 6 | PageSpeed mobil | acest raport | ⚠️ homepage slab (nu e landing de reclame) |

### 1. Cookies + Consent Mode v2
- Consimțământul implicit e `denied` pe toate cele 4 semnale și se setează `beforeInteractive`,
  **înainte** de gtag.js. Verificat în `dataLayer` pe build-ul de producție: `consent default`
  este prima intrare, înaintea lui `config`.
- Fără consimțământ: nu apare niciun cookie `_ga`, iar GA primește doar ping-ul anonim `gcs=G100`.
  După Accept apar `_ga` / `_ga_*`. Pentru un vizitator care revine, alegerea salvată se aplică
  înainte de `config`.
- „Accept toate” și „Refuz toate” au același stil. „Personalizez” oferă categoriile
  Necesare / Analiză / Publicitate. „Setări cookies” din footer redeschide bannerul.
- `hasAdConsent()` / `hasAnalyticsConsent()` sunt în `web/src/lib/consent.ts`, pentru Faza 2.
- Efect secundar al testului: 2–3 vizite de pe localhost au ajuns în proprietatea GA4 reală.

### 2. Pagini de încredere
`/despre` (metodologie), `/contact`, `/confidentialitate`, `/termeni`, `/cookies`. Au linkuri
în footer pe toate paginile și sunt incluse în sitemap. Textele descriu ce face **real** codul:
GA4/Ads doar cu consimțământ, click_id fără date personale, alertele Telegram, căutările
anonime, cookie-urile rețelelor de afiliere.

**Ce ai de completat într-un singur fișier:** `web/src/lib/company.ts`: denumirea firmei, CUI,
nr. Reg. Com., sediul, emailul (și emailul GDPR, dacă e altul), furnizorul VPS + țara.
Cât timp lipsesc, pe site apare `[DE COMPLETAT: …]` (galben).

De făcut manual în GA4: setează retenția datelor la **14 luni** (pagina de confidențialitate
o afirmă).

### 3. Analiza de preț
- Un singur prag, **±5% față de mediana 30 de zile** (decizia ta):
  ≥5% sub = „Reducere reală: X% sub mediana de 30 de zile”; între −5% și +5% = „Preț în
  intervalul obișnuit (X% sub/peste mediană)”; peste +5% = „Preț cu X% peste mediană — îți
  recomandăm alerta de preț”.
- Nivelul „Preț bun” (5–10%) a fost eliminat. Oricum apărea ca „Reducere reală”, deci etichetele se contraziceau.
- Decizia se ia pe valoarea exactă, identic cu SQL-ul (`< mediană × 0,95`). Astfel pagina de produs
  și landing page-ul nu se pot contrazice la 4,96%.
- Calculul e o mediană reală (`PERCENTILE_CONT(0.5)`). Textul „Medie 30z” a devenit „mediana 30 de zile”
  peste tot. Procentele se scriu cu virgulă (16,2%).

### 4. Landing pages `/reduceri-reale/[categorie]`
- Arată doar oferte **în stoc, cu link afiliat, ≥5% sub mediană**, cea mai bună ofertă per
  produs, sortate după procent. Include subcategoriile (ex. `/reduceri-reale/telefoane-accesorii`).
- H1 potrivit intenției („Reduceri reale la telefoane mobile”), metodologie scurtă, data și ora
  ultimei verificări, canonical propriu, incluse în sitemap (22 de pagini).
- Starea goală: mesaj, cele mai apropiate 8 produse (nemarcate ca reducere) și îndemn la alerta de preț.
- Sănătate & Naturale (și subcategoriile) → 404, conform regulii 8.
- Fix colateral: pe mobil (360 px) prețul se tăia în 41 din 48 de carduri pe paginile de categorie → 0.

> ⚠️ **Important pentru Faza 3.** Pe producție, azi, **laptopurile și televizoarele au 0 reduceri
> reale**. Unde există reduceri: încărcătoare & cabluri (120, valoare mică), telefoane mobile (21),
> folii (16), baterii externe (15). Campania-șablon „Laptopuri” din pachet ar trimite spre o
> pagină goală. market-research trebuie să pornească de la aceste date, nu de la șablon.

### 5. Redirecționări
Sursa sunt log-urile nginx de pe producție: ~9.000 de cereri 404 în 8 zile, inclusiv Googlebot.
Vechiul catalog era alt magazin (ceasuri, cosmetice, baterii de baie). Doar 14 din 4.816 slug-uri
vechi de produs există azi.

| URL vechi | Ce face acum |
|---|---|
| `/produs/<slug>`, `/product/<slug>` | 308 → `/p/<slug>` dacă produsul există, altfel **410** |
| `/categorie-produs/…`, `/product-category/…` | 308 → `/c/<slug>` sau `/t/<tag>` dacă e o categorie cunoscută, altfel 410 |
| `/shop`, `/shop/page/N` | 308 → `/` |
| `/c/incarcatoare-auto` și alte 7 slug-uri redenumite | 308 → slug-ul nou |
| `/c/second-hand`, `/c/refurbished` | 308 → `/t/…` (condiția e acum tag) |

410 în loc de redirect spre homepage: Google tratează redirecturile în masă spre homepage ca
„soft 404”, iar 410 scoate paginile din index mai repede. 308 e echivalentul Next.js pentru 301,
iar Google le tratează identic.

### 6. PageSpeed mobil (producția de azi, fără modificările de mai sus)
Măsurat cu Lighthouse 12 (emulare mobil, rețea 4G lentă simulată). API-ul PageSpeed Insights își
epuizase cota zilnică fără cheie.

| Pagină | Scor | LCP | FCP | TBT | CLS |
|---|---:|---:|---:|---:|---:|
| Homepage | **52** | 9,3 s | 3,7 s | 370 ms | 0 |
| Categorie (`/c/telefoane-mobile`) | 88 | 2,9 s | 1,1 s | 310 ms | 0 |
| Produs | 68 | 4,2 s | 0,9 s | 730 ms | 0 |

Cauze:
- **Homepage:** H1-ul (elementul LCP) așteaptă 8,6 s după HTML. Bannerele HTML din admin
  (iframe `/embed/banner/…`) sunt ascunse pe mobil cu CSS (`hidden lg:block`), dar **un iframe
  ascuns se încarcă oricum**: ~21 de cereri Profitshare + imagini Vegis/ITGalaxy, ~770 KB pe telefon.
  **Fix propus:** bannerele nu se mai randează deloc sub `lg`, în loc să fie doar ascunse.
- **Produs:** TTFB 1,16 s (pagina e randată la fiecare cerere, cu query-uri grele pe istoricul de
  preț) și TBT 730 ms (graficul de preț). Fix propus: cache pe `getProductDetail`/istoric, graficul
  încărcat lazy.
- **Toate:** GTM/gtag ocupă 400–560 ms din main thread, un cost acceptat pentru măsurare.
- CLS 0 peste tot (imaginile au dimensiuni fixe).

Homepage-ul **nu** e landing page pentru reclame. Paginile relevante pentru Quality Score sunt
`/reduceri-reale/*` și, secundar, `/p/*`. Recomandare: după deploy, măsurăm `/reduceri-reale/*`
și aplicăm cele două fix-uri de mai sus dacă scorul pe mobil e sub 70.

## Ce trebuie verificat manual (desktop + mobil)
1. Bannerul de cookies: Accept / Refuz / Personalizez / „Setări cookies” din footer.
2. Paginile din footer, după ce completezi `company.ts`.
3. O pagină de produs cu reducere, una „obișnuit” și una „peste mediană”.
4. `/reduceri-reale/telefoane-mobile` și `/reduceri-reale/laptopuri` (starea goală).

## Deploy
Branch-ul **nu e pe producție**. Deploy doar la comanda ta (`/deploy`). Nu are migrații noi.
Branch-ul separat `ads/faza-2a-subid` (click_id pe `/go`) are migrația **017** și e independent
de acesta. Le poți urca împreună sau separat.
