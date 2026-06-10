# superieftin.ro — Design Brief

Document de referință pentru toate deciziile vizuale. Claude Code citește acest fișier înaintea oricărei lucrări de UI. **Nicio decizie estetică în afara acestui brief.**

---

## 1. Identitate și poziționare vizuală

**Propunere de valoare vizuală:** „Datele sunt arma ta. Noi le facem lisibile."

Site-ul e un instrument de investigație a prețurilor, nu un magazin. Tonul vizual este **bold și energic** — fonturi groase, culori saturate, etichete de preț vizibile, zero decorațiuni inutile. Fiecare pixel servește datele.

---

## 2. Paletă de culori

| Token              | Valoare HEX | Utilizare |
|--------------------|-------------|-----------|
| `--color-brand`    | `#E53E3E`   | CTA principal, badge-uri active, accent |
| `--color-brand-dark` | `#C53030`  | Hover pe brand, focus ring |
| `--color-brand-light` | `#FED7D7` | Background badge reducere |
| `--color-success`  | `#38A169`   | Stoc disponibil, confirmare |
| `--color-danger`   | `#E53E3E`   | Stoc epuizat (același cu brand — intenționat) |
| `--color-text`     | `#1A202C`   | Text principal |
| `--color-text-muted` | `#718096`  | Text secundar, metadata |
| `--color-line`     | `#E2E8F0`   | Borduri carduri, separatoare |
| `--color-surface`  | `#FFFFFF`   | Fundal card |
| `--color-bg`       | `#F7FAFC`   | Fundal pagină |

**Regulă strictă:** verde și roșu apar EXCLUSIV la verdict (`--color-success` pentru prețuri sub mediană, `--color-danger` / `--color-brand` pentru badge reducere). Nu se folosesc decorativ.

---

## 3. Tipografie

| Rol | Font | Greutate | Fallback |
|-----|------|----------|---------|
| Titluri, brand, preț principal | **Archivo Black** | 900 | sans-serif |
| Corp text, UI, etichete | **Instrument Sans** | 400 / 600 | system-ui, sans-serif |

```css
/* Încărcare Google Fonts — în layout.tsx */
@import url('https://fonts.googleapis.com/css2?family=Archivo+Black&family=Instrument+Sans:wght@400;600&display=swap');
```

**Regulă cifre:** toate prețurile și procentele folosesc `font-variant-numeric: tabular-nums` — cifrele nu se mișcă la actualizare.

**Scale tipografică:**
- Prețul principal pe card: `text-xl font-black` (Archivo Black)
- Titlu produs pe card: `text-sm font-medium` (Instrument Sans)
- Badge reducere: `text-xs font-semibold` (Instrument Sans)
- Body / descriere: `text-sm` (Instrument Sans)

---

## 4. Componente-semnătură

### 4.1 PriceTag
Afișează prețul curent cu badge opțional de reducere.

```
┌─────────────────────────┐
│  1.299 lei   [-23%]     │
│  (Archivo Black, xl)    │
└─────────────────────────┘
```

- Prețul: `Archivo Black`, `text-xl`, `--color-text`, `tabular-nums`
- Badge `[-23%]`: background `--color-brand-light`, text `--color-brand`, `text-xs font-semibold`, `rounded-full px-2 py-0.5`
- Badge apare DOAR dacă `discount_pct != null` (reducere verificată față de mediană 30 zile)

### 4.2 VerdictBadge
Eticheta principală de verdict — componenta-semnătură a site-ului.

```
🔥 Reducere reală     ← când discount_pct >= 5%
(nimic)               ← când nu există reducere verificată
```

- Text exact: `🔥 Reducere reală`
- Styling: `text-xs font-semibold`, culoare `--color-brand`, background transparent
- NU se inventează alte formulări — textul e fix

### 4.3 Sparkline
Mini grafic de tendință al prețului (ultimele 30 zile), 80×24px, SVG.

- Linie: `--color-brand` dacă prețul curent e sub mediană, `--color-text-muted` altfel
- Fără axe, fără labels, fără tooltip — doar tendința
- Afișat pe card dacă există minim 2 puncte de istoric

---

## 5. Cardul de produs

```
┌──────────────────────────┐
│  [Imagine produs]        │  ← max 40% din înălțimea cardului
│  max-h-[120px] object-contain │
├──────────────────────────┤
│  🔥 Reducere reală       │  ← VerdictBadge (doar dacă există)
│  Nume produs (2 linii)   │  ← text-sm, line-clamp-2
│  Brand                   │  ← text-xs text-muted
├──────────────────────────┤
│  1.299 lei  [-23%]       │  ← PriceTag
│  ▁▂▄▃▅▂▄▆               │  ← Sparkline (dacă există istoric)
├──────────────────────────┤
│  [Vezi la eMAG →]        │  ← CTA galben, text negru, w-full
└──────────────────────────┘
```

**Regulile cardului:**
- Bordură: `border border-[--color-line]`, `rounded-lg`, fără umbre grele (`shadow-none`)
- Hover: `hover:border-[--color-brand]` — doar bordura se schimbă, fără scale sau shadow
- CTA: `bg-yellow-400 text-gray-900 font-semibold text-sm py-2 rounded-md w-full` — UN singur buton per card, text `„Vezi la {retailer}"`
- Imagine: fundal `bg-gray-50`, `object-contain`, nu `object-cover`

**Grilă:**
- Mobil: 2 coloane (`grid-cols-2`)
- Tabletă: 3 coloane (`sm:grid-cols-3`)
- Desktop: 4 coloane (`lg:grid-cols-4`)
- Gap: `gap-3`

---

## 6. Microcopy — formulări fixe

Textele de mai jos sunt EXACTE — nu se parafrazează, nu se variază.

| Context | Text |
|---------|------|
| Verdict reducere reală | `🔥 Reducere reală` |
| Verdict fără reducere verificată | (nimic — fără text negativ) |
| CTA card produs | `Vezi la {Retailer}` |
| CTA pagina produs | `Cumpără la {Retailer} →` |
| Lipsă date istorice | `Istoric insuficient pentru verificare` |
| Stoc epuizat | `Indisponibil` |
| Ultima verificare | `Verificat acum {X} ore` sau `Verificat azi` |

### Notă obligatorie de transparență afiliere
**Obligație legală** — trebuie să apară în footer-ul fiecărei pagini și pe pagina de produs:

> *superieftin.ro folosește linkuri de afiliere. Dacă cumperi prin linkurile noastre, primim un comision mic din partea retailerului, fără cost suplimentar pentru tine. Prețurile și reducerile sunt verificate independent.*

Footer: text `text-xs text-muted`, centrat sau stânga.
Pagina produs: sub butonul CTA, `text-xs text-muted`.

---

## 7. Accesibilitate și mișcare

- `prefers-reduced-motion`: Sparkline și orice tranziție CSS → `@media (prefers-reduced-motion: reduce) { transition: none; animation: none; }`
- Focus vizibil pe tastatură: `focus-visible:ring-2 focus-visible:ring-[--color-brand] focus-visible:ring-offset-2` pe toate elementele interactive
- Contrast minim: text pe fundal alb ≥ 4.5:1 (WCAG AA). `--color-text-muted` (#718096) pe alb = 4.6:1 ✓

---

## 8. Ce NU face acest site

- **Fără hero decorativ** — homepage-ul începe direct cu produse/reduceri
- **Fără carousel/slider** — grid static, fără animații de scroll
- **Fără pop-up-uri** la intrare pe site
- **Fără stele de rating** — nu avem date de rating, nu inventăm
- **Fără culori multiple** — paleta e intenționat limitată; nu se adaugă culori noi fără motiv

---

## Cum se folosește acest document (pentru Claude Code)

1. Citește secțiunile relevante înainte de orice componentă nouă.
2. Tokenii CSS (`--color-brand` etc.) se definesc în `:root` în `globals.css` și se mapează în `tailwind.config` ca valori custom.
3. Orice decizie vizuală care nu e acoperită de brief → întreabă utilizatorul, nu improviza.
4. La audit (Pasul 1 din Faza 4.5): compară fiecare componentă cu secțiunile 4 și 5, notează divergențele în `design-audit.md`.
