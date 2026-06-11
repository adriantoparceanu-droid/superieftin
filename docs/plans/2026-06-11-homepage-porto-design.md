# Prima pagină — redesign după modelul Porto shop36

**Data:** 2026-06-11 · **Status:** validat cu utilizatorul

Adaptăm layoutul Porto shop36 (magazin) la comparator: fără coș/cumpărare, cu prețuri,
reduceri reale și retaileri.

## Structura (de sus în jos)

1. **Hero** — două bannere CSS cu date reale: principal (produsul cu cea mai mare reducere
   reală + badge -XX% + căutare) și secundar (prima categorie din meniu + produs reprezentativ).
   Fallback când nu există reduceri validate: cel mai ieftin produs cu imagine.
2. **Bara de beneficii** — 4 coloane: verificate zilnic / istoric 30 zile / validate matematic /
   acces direct la magazin.
3. **Grila de categorii** — cu imaginea unui produs reprezentativ per categorie (fallback iconiță).
4. **Top reduceri reale** — carusel orizontal scroll-snap cu badge-uri %; fallback „cele mai mici prețuri".
5. **Secțiuni pe categorii** — primele 3 categorii din meniul administrabil, 6 produse + „Vezi toate".
6. **Carusel retaileri** — logo-urile din retailers.logo_url (Profitshare).
7. **„Cum verificăm reducerile"** — secțiunea existentă, mutată la final.

## Implementare

- Componente noi: `HeroBanners`, `BenefitsBar`, `ProductCarousel`, `RetailerStrip`;
  `CategoryGrid` extins cu imagini.
- Query-uri noi (cache pe tag-urile existente): `getCategoryThumbs()` (imagine reprezentativă
  per categorie), `getActiveRetailersPublic()` (logo-uri). Hero refolosește `getTopDiscounts`.
- Secțiunile featured se derivă din `getMenu()` → administrabil fără cod.
- Fără modele de date noi.
