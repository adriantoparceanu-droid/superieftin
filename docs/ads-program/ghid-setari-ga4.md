# Ghid setări GA4 pentru proprietar (pași manuali)

> Agenții au acces DOAR de citire la GA4 (REGULI.md). Setările de mai jos le faci tu, din
> interfața Google Analytics (analytics.google.com), cu contul de proprietar. Durează ~20 de minute.
> Unde scrie „Admin”, e rotița din stânga-jos.

## Ce trimite site-ul (după Faza 2)

La click pe „Cumpără la …” / „Vezi la …” (link prin `/go/…`), site-ul trimite evenimentul
**`click_affiliate_link`** cu parametrii:

| Parametru | Ce conține | Exemplu |
|---|---|---|
| `product_id` | ID-ul intern al produsului | `48213` |
| `product_name` | denumirea produsului | `iPhone 15 128GB` |
| `merchant_name` | magazinul („store”) | `eMAG` |
| `category` | categoria de pe site | `telefoane-mobile` |
| `price` | prețul curent (RON) | `3299` |
| `discount_pct` | reducerea față de mediana 30 zile — **doar** când e afișată ca reală pe pagină | `12` |

Nu se trimit date personale și nici codul intern de click (`click_id`). Evenimentul respectă
Consent Mode: fără acord „Analiză”, Google primește doar semnale anonime, fără cookie-uri.

De ce contează: GA4 **nu** vede aceste clickuri ca „outbound click” automat, pentru că `/go/` e
pe același domeniu — de aceea avem evenimentul propriu.

> Atenție: evenimentul pornește doar în producție (după deploy). Pe local nu se trimite nimic.

## Pasul 1 — Marchează `click_affiliate_link` ca eveniment cheie

1. Admin → **Afișare date** (Data display) → **Evenimente** (Events).
2. Evenimentul apare în listă după primele clickuri reale (poate dura până la 24 h după deploy).
3. Pe rândul `click_affiliate_link`, activează comutatorul **„Marcați ca eveniment cheie”**
   (Mark as key event).
   - Dacă nu apare încă: Admin → **Evenimente cheie** → **Eveniment cheie nou** → scrie exact
     `click_affiliate_link`.

## Pasul 2 — Dimensiuni personalizate pentru parametri

Fără ele, parametrii ajung în GA4, dar nu îi vezi în rapoarte.

Admin → **Afișare date** → **Definiții personalizate** (Custom definitions) → **Creează dimensiuni
personalizate**, câte una pentru fiecare rând (Domeniu/Scope = **Eveniment**):

| Nume dimensiune | Parametru eveniment |
|---|---|
| Produs ID | `product_id` |
| Magazin | `merchant_name` |
| Categorie | `category` |
| Reducere % | `discount_pct` |

Și o **valoare** personalizată (tab-ul „Valori personalizate”, Custom metrics):

| Nume | Parametru | Unitate |
|---|---|---|
| Preț click | `price` | Monedă (Currency) |

`product_name` nu are nevoie de dimensiune (textul lung umple rapoartele; ajunge `product_id`).

## Pasul 3 — Filtru pentru traficul intern (clickurile tale nu se numără)

1. Admin → **Fluxuri de date** (Data streams) → fluxul web al site-ului → **Configurați setările
   etichetei** (Configure tag settings) → **Afișează tot** → **Definiți traficul intern**
   (Define internal traffic) → **Creează**:
   - Nume: `Birou / acasă`, `traffic_type` = `internal`
   - Tip de potrivire: **adresa IP este egală cu** → adresa ta IP publică (o afli căutând „what is my
     ip” în Google). Adaugă câte un rând pentru fiecare loc din care lucrezi.
2. Admin → **Colectarea și modificarea datelor** → **Filtre de date** (Data filters) → filtrul
   „Internal Traffic” e creat în starea **Testare**. Lasă-l 2–3 zile în testare, verifică în
   Rapoarte → Timp real că vizitele tale apar cu `Test data filter name`, apoi schimbă-l pe **Activ**.
   (Un filtru activ șterge definitiv datele filtrate — de aceea testăm întâi.)

## Pasul 4 — Google Signals OPRIT

Admin → **Colectarea datelor** (Data collection) → **Colectarea datelor Google Signals** → lasă
**dezactivat**. De ce: Signals leagă vizitele de conturile Google ale oamenilor (date
personale suplimentare), ceea ce ar cere texte noi în politica de confidențialitate și nu ne aduce
nimic esențial acum.

Tot aici verifică **Păstrarea datelor** (Data retention) = **14 luni** — așa scrie în
`/confidentialitate`.

## Pasul 5 — Legătura GA4 ↔ Google Ads

1. Admin → **Linkuri de produse** (Product links) → **Linkuri Google Ads** → **Asociați** (Link).
2. Alege contul **276-008-6909** → Înainte.
3. „Publicitate personalizată”: necesară pentru listele de remarketing din GA4 — **activ-o (sau las-o activă, dacă e deja) abia după
   deploy-ul bifei „Reclame personalizate”** din banner (vezi `remarketing-vizitatori.md`; până atunci
   listele rămân goale oricum, pentru că `ad_personalization` e refuzat). **Activează** „Etichetare automată”
   (auto-tagging: adaugă `gclid` la clickurile din reclame — fără el nu există potrivire cu comisioanele).
4. Trimite.

## Pasul 6 — Import în Google Ads ca conversie SECUNDARĂ (important)

Conversia principală e **„Comision afiliere”** (fost „Comision Profitshare”; comisionul real din
Profitshare și 2Performant, importat de `tracking:sync`).
`click_affiliate_link` se importă doar pentru observare, altfel Google numără de două ori și
optimizează pe clickuri, nu pe bani.

1. În Google Ads: **Obiective** → **Conversii** → **Rezumat** → **+ Creați acțiune de conversie** →
   **Importați** → **Proprietăți Google Analytics 4** → **Web** → bifează `click_affiliate_link` →
   Importați și continuați.
2. Deschide acțiunea importată → **Editați setările**:
   - **Optimizarea acțiunii** (Action optimization): **Acțiune secundară** („Secondary action —
     used for observation only”).
   - Valoare: **Nu folosiți o valoare** (nu e venit).
   - Numărare: **Una** (One) — un vizitator care dă 5 clickuri nu valorează de 5 ori mai mult.
3. Salvează.

Verificare: în lista de conversii, coloana „Optimizarea acțiunii” trebuie să arate
**Principală** doar la „Comision afiliere” și **Secundară** la `click_affiliate_link`.

> Atenție — în cont există deja acțiunea **„Achiziție”** (tip Pagină web, **principală**, categoria
> Cumpărare) și „Superieftin.ro – GA4 (web) purchase” (ascunsă). Noi nu vindem direct, deci
> „Achiziție” nu se va declanșa niciodată corect. Recomandare: setează-o **Secundară** (sau elimin-o)
> înainte de pornirea campaniilor, ca singura conversie principală de tip Cumpărare să fie
> „Comision afiliere”.

## Checklist final

- [ ] `click_affiliate_link` = eveniment cheie
- [ ] 4 dimensiuni + 1 valoare personalizate
- [ ] trafic intern definit, filtrul testat și apoi Activ
- [ ] Google Signals dezactivat; păstrarea datelor 14 luni
- [ ] GA4 legat de Google Ads 276-008-6909, auto-tagging activ
- [ ] `click_affiliate_link` importat ca **secundar**, fără valoare, numărare „Una”
- [ ] „Achiziție” trecută pe secundar / eliminată
