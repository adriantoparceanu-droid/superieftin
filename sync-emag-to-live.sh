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
  SELECT p.slug, p.name, p.category, p.brand, p.image_url,
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

echo "==> [2/4] Construiesc SQL de upsert (staging + ON CONFLICT)..."
SQL_FILE="$DUMP_DIR/upsert.sql"
{
  echo "BEGIN;"
  echo "CREATE TEMP TABLE emag_stg ("
  echo "  slug text, name text, category text, brand text, image_url text,"
  echo "  url text, affiliate_url text, current_price numeric, currency text,"
  echo "  in_stock boolean, last_checked timestamptz"
  echo ") ON COMMIT DROP;"
  echo "COPY emag_stg (slug, name, category, brand, image_url, url, affiliate_url, current_price, currency, in_stock, last_checked) FROM STDIN WITH (FORMAT csv, HEADER true);"
  cat "$DUMP_DIR/emag.csv"
  echo "\\."
  # Produse noi (nu suprascriem produse canonice existente ale altor retaileri)
  echo "INSERT INTO products (name, slug, category, brand, image_url)"
  echo "SELECT DISTINCT ON (slug) name, slug, category, brand, image_url FROM emag_stg"
  echo "ON CONFLICT (slug) DO NOTHING;"
  # Oferte eMAG: upsert dupa (product_id, retailer_id)
  echo "INSERT INTO offers (product_id, retailer_id, url, affiliate_url, current_price, currency, in_stock, last_checked)"
  echo "SELECT p.id, (SELECT id FROM retailers WHERE slug='emag'),"
  echo "       s.url, s.affiliate_url, s.current_price, s.currency, s.in_stock, s.last_checked"
  echo "FROM emag_stg s JOIN products p ON p.slug = s.slug"
  echo "ON CONFLICT (product_id, retailer_id) DO UPDATE SET"
  echo "  url = EXCLUDED.url, affiliate_url = EXCLUDED.affiliate_url,"
  echo "  current_price = EXCLUDED.current_price, currency = EXCLUDED.currency,"
  echo "  in_stock = EXCLUDED.in_stock, last_checked = EXCLUDED.last_checked;"
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
