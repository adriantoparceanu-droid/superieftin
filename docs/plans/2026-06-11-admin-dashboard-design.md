# Dashboard de administrare — categorii, mapare feed-uri, meniu

**Data:** 2026-06-11
**Status:** validat cu utilizatorul (secțiunile 1–3)

## Decizii

- Admin integrat în aplicația Next.js existentă, sub `/admin`, cu **utilizatori în DB** (email + parolă).
- Ierarhie de categorii pe **2 niveluri** (categorie → subcategorie).
- **Constructor de meniu separat** (`menu_items`): intrări către categorii sau linkuri custom.
- După validare locală, **totul rulează pe VPS** (worker + admin); `sync-to-live.sh` se pensionează —
  feed-urile Profitshare nu blochează IP-uri de datacenter, deci sincronizarea nu mai are nevoie
  de mașina locală.

## Modelul de date (migrația `007_admin.sql`)

- `admin_users` — email unic, password_hash, name, last_login_at. Primul admin: `npm run admin:create`.
- `categories` — name, slug unic, parent_id (max 2 niveluri impus de aplicație), description,
  icon, sort_order, is_visible.
- `tags` + `product_tags` — many-to-many.
- `feed_category_map` — (retailer_id NULL = regulă globală, feed_category) → category_id + tag_ids;
  regula specifică retailerului are prioritate. Înlocuiește `category_map`.
- `menu_items` — label, category_id SAU url custom, parent_id (dropdown), sort_order, is_visible.
- `products` + `category_id` (FK), + `feed_category` (textul brut din feed, pentru remapare).
- `feed_syncs` + source (`profitshare`/`upload`), filename, unmapped_count.

**Fluxul de mapare:** la import se caută regula (retailer, categorie_feed) — întâi specifică,
apoi globală. Cu regulă → category_id + taguri. Fără → `category_id = NULL` + apare în inbox-ul
de mapare. Maparea se aplică retroactiv la salvare.

## Ecranele admin

1. **Dashboard** — sincronizări recente, produse/oferte per retailer, produse nemapate.
2. **Import feed** — upload XML/CSV → `runFileImport` (job BullMQ) → raport + istoric.
3. **Inbox mapare** — categorii feed fără regulă, grupate cu număr de produse; dropdown
   categorie + taguri; aplicare retroactivă imediată.
4. **Categorii** — arbore 2 niveluri, CRUD, ordine, vizibilitate; ștergerea cere realocare.
5. **Taguri** — CRUD + număr de produse.
6. **Meniu** — intrări categorie/link custom, 2 niveluri, ordine, vizibilitate.
7. **Utilizatori** — adăugare/dezactivare admini, resetare parole.

Toate scrierile prin server actions cu sesiune verificată (cookie semnat).

## Integrarea cu site-ul public

- Header din `menu_items`; grila homepage din `categories` vizibile cu număr de produse.
- `/c/[slug]` filtrează pe category_id; părintele include subcategoriile; breadcrumbs.
- `/t/[slug]` — pagini de tag.
- Tag-uri noi de cache (`categories`, `menu`) invalidate la salvările din admin.

## Migrarea datelor existente

Categoriile-text actuale → rânduri în `categories`; `category_map` → reguli globale în
`feed_category_map`; products.category_id prin potrivirea textului. Nimic nu se șterge.

## Erori și testare

- Import invalid → raport, DB neatins (validarea existentă).
- Ștergeri cu confirmare + realocare produse.
- Teste unitare: rezolvarea mapării (specific vs global), autentificare/hash parole.
- Construit și testat local pe datele reale (14k produse nemapate = caz de test).

## Ordinea implementării

1. Migrație + autentificare + admin shell + categorii/mapare (rezolvă problema acută).
2. Meniu + integrarea site-ului public.
3. Upload feed din admin + taguri.
4. Mutarea pe VPS (doar la comandă explicită).
