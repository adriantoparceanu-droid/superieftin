#!/bin/bash
# Deploy cap-coadă de pe Mac pe VPS (superieftin@13.140.163.156:/home/superieftin/app).
# Folosit de comanda /deploy (.claude/commands/deploy.md). Rulează DOAR la cererea proprietarului.
#
#   ./deploy.sh              web + worker
#   ./deploy.sh web          doar site-ul (Next.js)
#   ./deploy.sh worker       doar workerul (feed-uri, joburi, bot Telegram)
#   Opțiuni: --skip-checks   sare peste testele locale (doar în urgențe)
#            --check         doar verificările + migrațiile în așteptare; NU modifică nimic pe server
#            --allow-dirty   permite modificări necomise (implicit: refuză — pe prod ajunge DOAR
#                            cod salvat în git, ca producția să poată fi refăcută oricând din git)
#
# Pașii: verificări locale → sincronizare fișiere → migrații noi (dacă există) → build → restart
# → verificare (containere Up, site 200, loguri worker). Se oprește la prima eroare.

set -euo pipefail
cd "$(dirname "$0")"

HOST=superieftin@13.140.163.156
APP=/home/superieftin/app
SITE=https://www.superieftin.ro

TARGET=all; SKIP_CHECKS=0; ALLOW_DIRTY=0; CHECK_ONLY=0
for a in "$@"; do
  case "$a" in
    web|worker|all) TARGET=$a ;;
    --skip-checks) SKIP_CHECKS=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --check) CHECK_ONLY=1 ;;
    *) echo "Argument necunoscut: $a (folosește web | worker | all, --check, --skip-checks, --allow-dirty)"; exit 1 ;;
  esac
done
SERVICES=$([ "$TARGET" = all ] && echo "web worker" || echo "$TARGET")
step() { echo; echo "==> $*"; }
remote() { ssh -o BatchMode=yes "$HOST" "cd $APP && $*"; }

# ── 1. Verificări locale ────────────────────────────────────────────────────────────────
step "[1/7] Verificări locale (țintă: $SERVICES)"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
[ "$BRANCH" = main ] || echo "    ! Ești pe branch-ul „${BRANCH}”, nu pe main — deploiez ce e pe disc acum."
DIRTY=$(git status --porcelain -- web worker db docker-compose.yml package.json package-lock.json | grep -v '^??' || true)
if [ -n "$DIRTY" ] && [ "$ALLOW_DIRTY" = 0 ]; then
  echo "    ✗ Modificări necomise în fișierele care ajung pe producție:"; echo "$DIRTY" | sed 's/^/      /'
  echo "    Fă commit (sau rulează cu --allow-dirty)."; exit 1
fi
if [ "$SKIP_CHECKS" = 0 ]; then
  if [[ " $SERVICES " == *" worker "* ]]; then
    (cd worker && npm test >/tmp/superieftin-deploy-test.log 2>&1) \
      && echo "    ✓ teste worker ($(grep -Eo '^# pass [0-9]+' /tmp/superieftin-deploy-test.log | grep -Eo '[0-9]+') trecute)" \
      || { echo "    ✗ Testele worker-ului au picat — vezi /tmp/superieftin-deploy-test.log"; exit 1; }
    (cd worker && npx tsc --noEmit -p .) && echo "    ✓ TypeScript worker" || { echo "    ✗ Erori TypeScript în worker"; exit 1; }
  fi
  if [[ " $SERVICES " == *" web "* ]]; then
    (cd web && npx tsc --noEmit) && echo "    ✓ TypeScript web" || { echo "    ✗ Erori TypeScript în web"; exit 1; }
  fi
else
  echo "    ! Testele locale au fost sărite (--skip-checks)"
fi
ssh -o BatchMode=yes -o ConnectTimeout=10 "$HOST" true && echo "    ✓ conexiune SSH"

# Variabilele cerute de docker-compose.yml fără valoare implicită (${VAR}, nu ${VAR:-…}) care
# lipsesc din .env-ul de pe VPS. Doar NUMELE — valorile nu se citesc și nu se afișează.
NEEDED=$(grep -Eo '\$\{[A-Z0-9_]+\}' docker-compose.yml | tr -d '${}' | sort -u)
PRESENT=$(remote "grep -Eo '^[A-Z0-9_]+=' .env | tr -d '='" | sort -u)
MISSING=$(comm -23 <(echo "$NEEDED") <(echo "$PRESENT") | tr '\n' ' ')
[ -z "${MISSING// }" ] && echo "    ✓ .env pe VPS are toate variabilele cerute de compose" \
  || echo "    ! Lipsesc din .env pe VPS (vor fi goale): $MISSING"

if [ "$CHECK_ONLY" = 1 ]; then
  APPLIED=$(remote "docker compose exec -T postgres sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atc \"SELECT version FROM schema_migrations\"'" | sort -u)
  PENDING=$(comm -23 <(ls db/migrations/*.sql | xargs -n1 basename | sed 's/\.sql$//' | sort -u) <(echo "$APPLIED") | tr '\n' ' ')
  echo "    migrații în așteptare: ${PENDING:-niciuna}"
  echo; echo "==> --check: verificări gata, nimic modificat pe server."; exit 0
fi

# ── 2. Sincronizare fișiere ─────────────────────────────────────────────────────────────
# Fiecare fișier la calea lui (un rsync spre director ar copia Dockerfile-urile „flat”).
step "[2/7] Sincronizare fișiere"
D=$HOST:$APP
rsync -az db/migrations/ "$D/db/migrations/"
rsync -az docker-compose.yml package.json package-lock.json "$D/"
rsync -az web/Dockerfile "$D/web/Dockerfile"
rsync -az worker/Dockerfile "$D/worker/Dockerfile"
# web: codul + fișierele statice + configurările (next.config.ts setează domeniul canonic)
rsync -az --delete --exclude='.DS_Store' web/src/ "$D/web/src/"
rsync -az --delete --exclude='.DS_Store' web/public/ "$D/web/public/"
rsync -az web/package.json web/next.config.ts web/tsconfig.json web/postcss.config.mjs web/eslint.config.mjs "$D/web/"
# worker
rsync -az --delete --exclude='dist' --exclude='.DS_Store' worker/src/ "$D/worker/src/"
rsync -az worker/package.json worker/tsconfig.json "$D/worker/"
echo "    ✓ fișiere sincronizate"

# ── 3. Migrații noi ─────────────────────────────────────────────────────────────────────
# Comparăm migrațiile de pe disc cu tabela schema_migrations din producție. Imaginea migrate
# are migrațiile BAKED (COPY db) → dacă sunt noi, o reconstruim ÎNAINTE să le rulăm și ÎNAINTE
# de codul nou (care poate depinde de schemă).
step "[3/7] Migrații"
APPLIED=$(remote "docker compose exec -T postgres sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atc \"SELECT version FROM schema_migrations\"'" | sort -u)
LOCAL=$(ls db/migrations/*.sql | xargs -n1 basename | sed 's/\.sql$//' | sort -u)
PENDING=$(comm -23 <(echo "$LOCAL") <(echo "$APPLIED") | tr '\n' ' ')
if [ -n "${PENDING// }" ]; then
  echo "    migrații noi: $PENDING"
  remote "docker compose --profile tools build migrate" >/tmp/superieftin-deploy-build.log 2>&1 \
    || { echo "    ✗ Build migrate eșuat — vezi /tmp/superieftin-deploy-build.log"; exit 1; }
  remote "docker compose --profile tools run --rm migrate" 2>&1 | grep -Eo '"msg":"[^"]*"' | grep -Ev 'Skip' | sed 's/^/    /'
  STILL=$(comm -23 <(echo "$LOCAL") <(remote "docker compose exec -T postgres sh -c 'psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Atc \"SELECT version FROM schema_migrations\"'" | sort -u) | tr '\n' ' ')
  [ -z "${STILL// }" ] && echo "    ✓ migrații aplicate" || { echo "    ✗ Migrații neaplicate: $STILL"; exit 1; }
else
  echo "    ✓ nicio migrație nouă"
fi

# ── 4–5. Build + restart ────────────────────────────────────────────────────────────────
step "[4/7] Build $SERVICES (câteva minute)"
remote "docker compose build $SERVICES" >/tmp/superieftin-deploy-build.log 2>&1 \
  || { echo "    ✗ Build eșuat — ultimele linii:"; tail -25 /tmp/superieftin-deploy-build.log | sed 's/^/      /'; exit 1; }
echo "    ✓ imagini construite"

step "[5/7] Restart $SERVICES"
remote "docker compose up -d $SERVICES" 2>&1 | grep -E 'Started|Running|Recreated|Error' | sed 's/^/    /' || true

# ── 6–7. Verificare ─────────────────────────────────────────────────────────────────────
step "[6/7] Verificare"
CODE=000
for _ in $(seq 1 30); do
  CODE=$(curl -sk -o /dev/null -w '%{http_code}' "$SITE/" || true)
  [ "$CODE" = 200 ] && break
  sleep 3
done
remote "docker ps --format '{{.Names}} {{.Status}}'" | grep superieftin | sed 's/^/    /'
DOWN=$(remote "docker ps --format '{{.Names}} {{.Status}}'" | grep -E "superieftin-($(echo $SERVICES | tr ' ' '|'))-1" | grep -v ' Up ' || true)
FAIL=0
[ "$CODE" = 200 ] && echo "    ✓ $SITE/ → 200" || { echo "    ✗ $SITE/ → $CODE"; FAIL=1; }
[ -z "$DOWN" ] || { echo "    ✗ Containere oprite: $DOWN"; FAIL=1; }
if [[ " $SERVICES " == *" worker "* ]]; then
  sleep 5
  LOGS=$(remote "docker logs superieftin-worker-1 --since 3m 2>&1")
  echo "$LOGS" | grep -q 'Worker pornit' && echo "    ✓ worker pornit" || { echo "    ✗ worker-ul nu a raportat „Worker pornit”"; FAIL=1; }
  echo "$LOGS" | grep -qE '"level":(50|60)|Eroare fatala' && { echo "    ! erori în logurile worker-ului:"; echo "$LOGS" | grep -E '"level":(50|60)|Eroare fatala' | tail -5 | cut -c1-300 | sed 's/^/      /'; } || true
fi

step "[7/7] Rezultat"
if [ "$FAIL" = 0 ]; then
  echo "    ✓ Deploy reușit: $SERVICES · commit $(git rev-parse --short HEAD) · $(date '+%Y-%m-%d %H:%M')"
else
  echo "    ✗ Deploy cu probleme — vezi mai sus"; exit 1
fi
