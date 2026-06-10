# Design Audit — superieftin.ro vs. superieftin-design-brief.md

Generat la Pasul 1 din Faza 4.5. Fiecare linie = un loc unde codul actual diferă de brief.

---

## Pasul 1 ✅ — Fundație (DONE)
- Tokeni CSS adăugați în `globals.css` (`:root` + `@theme inline`)
- `Archivo Black` și `Instrument Sans` încărcate în `layout.tsx` cu `display: swap`
- `prefers-reduced-motion` adăugat în `globals.css`
- Helper class `.tabular` pentru cifre adăugat

---

## Pasul 2 — Eticheta de Verdict (TODO)

### `src/components/ProductCard.tsx`

| Linie | Actual | Brief | Token de folosit |
|-------|--------|-------|-----------------|
| 14 | `border-gray-100` | `border-line` | `--color-line` |
| 14 | `hover:shadow-md transition-shadow` | fără umbre, `hover:border-brand` | — |
| 31 | `bg-green-500 text-white` (badge discount) | `bg-brand-light text-brand` | `--color-brand-light`, `--color-brand` |
| 38 | `bg-blue-500 text-white` (badge "good") | **eliminar** — brief are un singur tip de badge | — |
| 44 | `hover:text-red-600` | `hover:text-brand` | `--color-brand` |
| 51 | `text-lg font-bold` pe preț | `text-xl font-black font-archivo` + `tabular-nums` | `--font-archivo` |
| 61 | `verdictColor()` — 4 culori (green/blue/gray/orange) | o singură formulare: `🔥 Reducere reală` (brand color) sau nimic | — |
| 67 | `bg-red-600 hover:bg-red-700 text-white` CTA | `bg-yellow-400 text-gray-900` | hardcodat `yellow-400` |
| 67 | text CTA: `Cumpără →` | `Vezi la {Retailer}` | — |

### `src/lib/discount.ts`

| Funcție | Actual | Brief |
|---------|--------|-------|
| `calculateDiscount` | 4 verdict-uri: real/good/normal/higher | Simplificat: `real` (≥5%) vs. `no-data` |
| `verdictColor` | 4 combinații de culori | O singură formulare cu `--color-brand` |
| labelRo pe `real` | `Reducere reală −X%` | `🔥 Reducere reală` (fără procent în label, procentul e în PriceTag) |

---

## Pasul 3 — Cardul de produs și grila (TODO)

### `src/app/page.tsx` și `src/app/c/[categorie]/page.tsx`

| Element | Actual | Brief |
|---------|--------|-------|
| Grid homepage | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4` | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3` (gap mai mic) |
| Imagine card | `aspect-square` (1:1 full) | max 40% din înălțimea cardului |
| Imaginea placeholder | emoji `📱` | icon generic + `--color-line` background |

---

## Pasul 4 — Pagina de produs și homepage (TODO)

### `src/app/p/[slug]/page.tsx`
- De citit separat; probabil culori hardcodate similare cu ProductCard
- Graficul de preț (`PriceHistoryChart`) — culori de aliniat la tokeni

### `src/app/page.tsx`
- Titlul de secțiune (`h2`) — de verificat font și culori
- Hero: brief-ul vrea direct produse, fără banner decorativ

---

## Pasul 5 — Microcopy + igienă (TODO)

### `src/app/layout.tsx` — Footer
| Actual | Brief (text exact) |
|--------|-------------------|
| `Prețurile includ linkuri de afiliere. Ultima actualizare: în timp real.` | `superieftin.ro folosește linkuri de afiliere. Dacă cumperi prin linkurile noastre, primim un comision mic din partea retailerului, fără cost suplimentar pentru tine. Prețurile și reducerile sunt verificate independent.` |

### Focus vizibil pe tastatură
- De adăugat `focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2` pe toate elementele interactive (butoane, linkuri, inputs)
- Curent nu există focus ring explicit

---

## Culori hardcodate rămase (listă completă după Pasul 1)

Toate componentele care trebuie actualizate în pașii următori:

- `ProductCard.tsx`: `gray-100`, `gray-50`, `gray-300`, `gray-900`, `gray-400`, `green-500`, `blue-500`, `red-600`, `red-700`
- `Header.tsx`: `gray-100`, `red-600`, `gray-600`, `gray-900`
- `layout.tsx` (body): `gray-50`, `gray-900` în className, footer `gray-100`, `gray-400`
- `discount.ts`: culori ca string returnate de `verdictColor()`
- `PriceHistoryChart.tsx`: de citit la Pasul 4
