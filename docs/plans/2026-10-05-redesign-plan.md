# Redesign superieftin.ro — plan de implementare

Design: `docs/plans/2026-10-05-redesign-design.md`. Branch: `feat/redesign`. Execuție: agenți `site-dev`,
pe rând (aceleași fișiere → fără paralelism), coordonați de sesiunea principală. Fiecare etapă se termină cu
`cd web && npm test`, `npx tsc --noEmit`, capturi Playwright și un commit în română.

## Etapa 0 — Date (worker + migrație)
- `db/migrations/032_offer_price_stats_min_max.sql`: `ALTER TABLE offer_price_stats ADD COLUMN IF NOT EXISTS
  min_30d NUMERIC, ADD COLUMN IF NOT EXISTS max_30d NUMERIC`.
- `worker/src/lib/price-stats.ts`: calculează `min_30d`/`max_30d` în același INSERT … ON CONFLICT.
- Alerta: `worker/src/lib/price-alert.ts` / `bot.worker.ts` `checkTarget` — pragul peste prețul curent devine
  valid (alerta pleacă la următoarea verificare); actualizează testele.
- Verificare: `cd worker && npm test`, migrația aplicată local, recalculare locală.

## Etapa 1 — Fundația
- `app/globals.css`: tokenii din design (luminos + `prefers-color-scheme: dark`), `body` cu fundal din token,
  aliasuri Tailwind (`bg-brand` etc. → noile valori) ca restul componentelor să preia automat culorile.
- `app/layout.tsx`: Archivo (axa `wdth`) + Inter prin `next/font/google`, `latin-ext`.
- `components/Logo.tsx` (SVG inline) + `app/icon.svg` (favicon).
- `components/VerdictBadge.tsx`: cele 4 stări (real / obișnuit / peste / monitorizăm).

## Etapa 2 — Antet, meniu, subsol
- `Header.tsx` + `CategoryMenu.tsx`: antet cărbune, panou mobil cu acordeon pe 2 niveluri, bară de categorii
  desktop; căutare. `Footer.tsx` cărbune. `CookieBanner` pe tokeni.

## Etapa 3 — Pagina de produs (prioritatea 1)
- Componente noi: `product/VerdictCard.tsx` (cu termometru), `product/OfferList.tsx`,
  `product/PriceAlertCard.tsx` (câmp editabil, mesaj live, Telegram/Email — refolosește `EmailAlertForm`),
  `product/PriceFacts.tsx` (3 rânduri generate din date, helper pur testat), `product/StickyBuyBar.tsx`.
- `PriceHistoryChart.tsx`: trepte, fereastra 30 z, mediana, zona de reducere, punct azi, atingere.
- `app/p/[slug]/page.tsx`: noua ordine; JSON-LD, canonical, `historyPartialSince` neschimbate; `/api/alerte-email`
  acceptă prag ≥ preț curent.
- Query: `JOIN offer_price_stats` pentru `min_30d`/`max_30d`.

## Etapa 4 — Liste
- `ProductCard.tsx` (card grilă) + rând de listă cu mini-termometru; `/c/` (restilizare coloană filtre +
  `MobileFilters` ca foaie de jos + bara lipicioasă), `/t/`, `/cautare`, `/reduceri-reale` (+ `[categorie]`).

## Etapa 5 — Homepage
- Hero cărbune cu cifre live, legenda verdictelor, „Reduceri reale azi”, categorii, ghiduri; scoate/înlocuiește
  `HeroBanners`/`BenefitsBar` dacă nu se potrivesc.

## Etapa 6 — Restul paginilor
- Ghiduri (`GuideBody`, liste), pagini legale (`LegalPage`), alerte, 404, `/despre`, `/contact`: tokeni, fonturi,
  mod întunecat. Adminul doar moștenește tokenii (fără restructurare).

## Etapa 7 — QA și lansare
- `cd web && npm test`, `npx tsc --noEmit`, `cd worker && npm test`.
- Capturi Playwright 390 px și 1366 px, luminos și întunecat: `/`, `/c/telefoane-mobile`, `/p/<produs cu reducere>`,
  `/p/<produs fără reducere>`, `/cautare?q=samsung`, `/reduceri-reale`, `/ghiduri`, o pagină legală, 404.
  Fără scroll orizontal, fără erori în consolă.
- `policy-reviewer` pe paginile de produs (afirmații adevărate, fără promisiuni, consimțământ).
- CLAUDE.md actualizat (tokeni, componente noi, migrația 032, regula pragului).
- Merge în `main` → `./deploy.sh` (migrația 032 rulează înaintea codului) → verificări pe producție
  (paginile cheie 200, capturi live) → `cd worker && npm run ads:guard` (doar citire) → `git push origin main`.
- Dacă garda raportează un landing căzut din cauza redesignului: corectează și redeploiază; nu pune nimic pe pauză.
