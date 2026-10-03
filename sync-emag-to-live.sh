#!/bin/bash
# Sincronizare DOAR a produselor eMAG: local -> productie.
#
# De ce: IP-ul VPS-ului (datacenter) e blocat de eMAG (CloudFront/AWS WAF 511), deci
# scraping-ul eMAG ruleaza LOCAL (IP rezidential). Restul retailerilor (feed-uri
# Profitshare/2Performant) se sincronizeaza direct pe VPS si NU trebuie atinsi aici.
#
# Spre deosebire de sync-to-live.sh (care face TRUNCATE la tot), acest script face UPSERT
# chirurgical doar pentru ofertele eMAG:
#   - produsele se insereaza dupa slug (ON CONFLICT (slug) DO NOTHING — nu suprascrie
#     produsele canonice existente ale altor retaileri)
#   - ofertele eMAG se fac upsert dupa (product_id, retailer_id)
# Nu se sterge nimic. Idempotent.
#
# Rulare: ./sync-emag-to-live.sh
# Conditii: PostgreSQL local pornit cu date eMAG proaspete, conexiune SSH la VPS.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Extrage DOAR DATABASE_URL din .env (fara a sursa tot fisierul).
LOCAL_DB="$(grep -E '^DATABASE_URL=' "$SCRIPT_DIR/.env" | head -1 | cut -d= -f2- | sed -E 's/^["'\'']//; s/["'\'']$//')"
: "${LOCAL_DB:?DATABASE_URL lipseste din .env}"

VPS_HOST="superieftin@13.140.163.156"
VPS_APP="/home/superieftin/app"
PSQL_PROD="docker compose exec -T postgres psql -U superieftin -d superieftin"

DUMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/superieftin_emag_sync.XXXXXX")"
trap 'rm -rf "$DUMP_DIR"' EXIT

echo "==> [1/4] Export oferte eMAG din DB local..."
psql "$LOCAL_DB" --csv -c "
  SELECT p.slug, p.name, p.category, p.feed_category, p.part_no, p.brand, p.image_url,
         o.url, o.affiliate_url, o.current_price, o.currency, o.in_stock, o.last_checked
  FROM offers o
  JOIN retailers r ON r.id = o.retailer_id
  JOIN products  p ON p.id = o.product_id
  WHERE r.slug = 'emag'
" > "$DUMP_DIR/emag.csv"

ROWS=$(($(wc -l < "$DUMP_DIR/emag.csv") - 1))
echo "    Local: $ROWS oferte eMAG de sincronizat"
if [ "$ROWS" -le 0 ]; then
  echo "    Nimic de sincronizat (0 oferte eMAG local). Ruleaza intai scraping-ul local."
  exit 1
fi

# Garda de prospetime: daca ultima scanare locala reusita e mai veche de 24h, NU urcam —
# altfel retrimitem pe productie preturi vechi ca si cum ar fi noi (s-a intamplat in sep 2026:
# scanarea salva 0 produse, iar sync-ul reurca zilnic datele din 31 august).
AGE_H=$(psql "$LOCAL_DB" -tAc "
  SELECT COALESCE(floor(EXTRACT(EPOCH FROM now() - max(o.last_checked)) / 3600), 99999)::int
  FROM offers o JOIN retailers r ON r.id = o.retailer_id WHERE r.slug = 'emag'")
echo "    Ultima oferta eMAG verificata local acum ${AGE_H}h"
if [ "$AGE_H" -gt 24 ]; then
  echo "    EROARE: datele eMAG locale sunt mai vechi de 24h — NU sincronizez (scanarea a esuat?)."
  exit 1
fi

echo "==> [2/4] Construiesc SQL de upsert (staging + ON CONFLICT)..."
SQL_FILE="$DUMP_DIR/upsert.sql"
{
  echo "BEGIN;"
  echo "CREATE TEMP TABLE emag_stg ("
  echo "  slug text, name text, category text, feed_category text, part_no text,"
  echo "  brand text, image_url text,"
  echo "  url text, affiliate_url text, current_price numeric, currency text,"
  echo "  in_stock boolean, last_checked timestamptz"
  echo ") ON COMMIT DROP;"
  echo "COPY emag_stg (slug, name, category, feed_category, part_no, brand, image_url, url, affiliate_url, current_price, currency, in_stock, last_checked) FROM STDIN WITH (FORMAT csv, HEADER true);"
  cat "$DUMP_DIR/emag.csv"
  echo "\\."
  # Produse: category_id se rezolva pe prod din slug-ul categoriei (id-urile pot diferi
  # intre local si prod, slug-ul e stabil). category_id NULL = 'nemapat' in admin.
  # NU sincronizam part_no: exista index unic (part_no, brand) care ar declansa unificarea
  # cross-retailer (ex. acelasi MPN Apple la eMAG si alt retailer) — asta se face la ingest
  # local, nu intr-un sync SQL naiv. Ofertele eMAG raman de-sine-statatoare pe prod.
  echo "INSERT INTO products (name, slug, category, category_id, feed_category, brand, image_url)"
  echo "SELECT DISTINCT ON (s.slug) s.name, s.slug, s.category,"
  echo "       (SELECT c.id FROM categories c WHERE c.slug = s.category),"
  echo "       s.feed_category, s.brand, s.image_url"
  echo "FROM emag_stg s ORDER BY s.slug"
  echo "ON CONFLICT (slug) DO UPDATE SET"
  echo "  category      = COALESCE(EXCLUDED.category, products.category),"
  echo "  category_id   = COALESCE(products.category_id, EXCLUDED.category_id),"
  echo "  feed_category = COALESCE(products.feed_category, EXCLUDED.feed_category),"
  echo "  updated_at    = now();"
  # Oferte eMAG: upsert dupa (product_id, retailer_id)
  echo "INSERT INTO offers (product_id, retailer_id, url, affiliate_url, current_price, currency, in_stock, last_checked)"
  echo "SELECT p.id, (SELECT id FROM retailers WHERE slug='emag'),"
  echo "       s.url, s.affiliate_url, s.current_price, s.currency, s.in_stock, s.last_checked"
  echo "FROM emag_stg s JOIN products p ON p.slug = s.slug"
  # affiliate_url: un NULL local NU sterge linkul Profitshare de pe prod (ex. completat cu
  # backfill-emag-affiliate pe prod, dar inca NULL in DB-ul local) — altfel pierdem comisionul.
  echo "ON CONFLICT (product_id, retailer_id) DO UPDATE SET"
  echo "  url = EXCLUDED.url, affiliate_url = COALESCE(EXCLUDED.affiliate_url, offers.affiliate_url),"
  echo "  current_price = EXCLUDED.current_price, currency = EXCLUDED.currency,"
  echo "  in_stock = EXCLUDED.in_stock, last_checked = EXCLUDED.last_checked;"
  # Prod oglindeste exact setul local eMAG: sterge ofertele eMAG care nu mai sunt in
  # export (curatate local dupa TTL). Scoped la retailer eMAG — restul raman neatinsi.
  echo "DELETE FROM offers o USING retailers r"
  echo "WHERE o.retailer_id = r.id AND r.slug = 'emag'"
  echo "  AND NOT EXISTS (SELECT 1 FROM emag_stg s WHERE s.url = o.url);"
  echo "COMMIT;"
} > "$SQL_FILE"

echo "==> [3/4] Aplic upsert pe productie (fara truncate, doar eMAG)..."
ssh "$VPS_HOST" "cd $VPS_APP && $PSQL_PROD" < "$SQL_FILE"

echo "==> [4/4] Reconstruiesc cache-ul web (unstable_cache nu vede modificarea DB direct)..."
ssh "$VPS_HOST" "cd $VPS_APP && docker compose up -d --force-recreate web" >/dev/null 2>&1

echo ""
echo "==> Sync eMAG complet. Verificare pe productie:"
ssh "$VPS_HOST" "cd $VPS_APP && $PSQL_PROD -c \"
  SELECT r.slug, COUNT(*) AS oferte
  FROM offers o JOIN retailers r ON r.id=o.retailer_id
  GROUP BY r.slug ORDER BY oferte DESC;\""
# Mapare: cate produse eMAG au ramas nemapate (category_id NULL) — ar trebui 0
ssh "$VPS_HOST" "cd $VPS_APP && $PSQL_PROD -c \"
  SELECT COUNT(*) AS emag_nemapate
  FROM products p JOIN offers o ON o.product_id=p.id JOIN retailers r ON r.id=o.retailer_id
  WHERE r.slug='emag' AND p.category_id IS NULL;\""
