#!/bin/bash
# Sincronizare date local → producție
#
# De ce: IP-ul VPS-ului (datacenter) este blocat de eMAG (CloudFront 511).
# Scraping-ul se face LOCAL cu IP rezidential, apoi datele se urca pe live.
#
# Rulare: ./sync-to-live.sh
# Conditii: PostgreSQL local pornit, conexiune SSH la VPS disponibila

set -euo pipefail

VPS_HOST="root@13.140.163.156"
VPS_COMPOSE="/opt/superieftin"
LOCAL_DB="postgresql://cosmin@localhost:5432/superieftin"
DUMP_DIR="/tmp/superieftin_sync_$$"

mkdir -p "$DUMP_DIR"
trap "rm -rf $DUMP_DIR" EXIT

echo "==> [1/4] Dump tabele din DB local..."

# Products
pg_dump "$LOCAL_DB" --data-only --table=products --no-owner --no-privileges \
  | grep -v '\\restrict\|\\unrestrict' > "$DUMP_DIR/products.sql"

# Offers (cu affiliate_url corecte)
pg_dump "$LOCAL_DB" --data-only --table=offers --no-owner --no-privileges \
  | grep -v '\\restrict\|\\unrestrict' > "$DUMP_DIR/offers.sql"

# Price history (tabela e partitionata — dump partitia lunii curente)
CURRENT_PARTITION="price_history_$(date +%Y_%m)"
pg_dump "$LOCAL_DB" --data-only --table="$CURRENT_PARTITION" --no-owner --no-privileges \
  | grep -v '\\restrict\|\\unrestrict' > "$DUMP_DIR/price_history.sql" 2>/dev/null || \
  echo "    Atentie: partitia $CURRENT_PARTITION nu exista local, sarim price_history."

PRODUCTS_COUNT=$(psql "$LOCAL_DB" -t -c "SELECT COUNT(*) FROM products;" | tr -d ' ')
OFFERS_COUNT=$(psql "$LOCAL_DB" -t -c "SELECT COUNT(*) FROM offers;" | tr -d ' ')
echo "    Local: $PRODUCTS_COUNT produse, $OFFERS_COUNT oferte"

echo "==> [2/4] Upload fisiere pe VPS..."
scp "$DUMP_DIR/products.sql" "$VPS_HOST:/tmp/sync_products.sql"
scp "$DUMP_DIR/offers.sql" "$VPS_HOST:/tmp/sync_offers.sql"
[ -s "$DUMP_DIR/price_history.sql" ] && \
  scp "$DUMP_DIR/price_history.sql" "$VPS_HOST:/tmp/sync_price_history.sql"

echo "==> [3/4] Import in DB productie..."
ssh "$VPS_HOST" "cd $VPS_COMPOSE && \
  docker compose exec -T postgres psql -U superieftin -d superieftin -c 'TRUNCATE offers CASCADE;' && \
  docker compose exec -T postgres psql -U superieftin -d superieftin -c 'TRUNCATE products CASCADE;' && \
  docker compose exec -T postgres psql -U superieftin -d superieftin < /tmp/sync_products.sql && \
  docker compose exec -T postgres psql -U superieftin -d superieftin < /tmp/sync_offers.sql"

if ssh "$VPS_HOST" "test -f /tmp/sync_price_history.sql"; then
  ssh "$VPS_HOST" "cd $VPS_COMPOSE && \
    docker compose exec -T postgres psql -U superieftin -d superieftin < /tmp/sync_price_history.sql"
fi

echo "==> [4/4] Restart web (golire cache Next.js)..."
ssh "$VPS_HOST" "cd $VPS_COMPOSE && docker compose restart web"

echo ""
echo "==> Sync complet!"
ssh "$VPS_HOST" "cd $VPS_COMPOSE && docker compose exec -T postgres psql -U superieftin -d superieftin \
  -c 'SELECT COUNT(*) AS produse FROM products; SELECT COUNT(*) AS oferte FROM offers; SELECT COUNT(*) AS istorice FROM price_history;'"
