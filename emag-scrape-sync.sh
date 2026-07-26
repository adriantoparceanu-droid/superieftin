#!/bin/bash
# Automatizare zilnica: scraping eMAG LOCAL (Playwright, IP rezidential) -> sync pe prod.
# Rulat de LaunchAgent 'ro.superieftin.emag-scrape' (vezi ~/Library/LaunchAgents).
# eMAG e scanabil doar local (WAF-ul blocheaza IP-ul de datacenter) — de aceea ruleaza
# pe iMac, nu pe VPS. Vezi CLAUDE.md, sectiunea "eMAG e scanabil DOAR local".
set -uo pipefail

REPO="/Users/cosmin/dev/Superieftin.ro"
LOG="$HOME/Library/Logs/superieftin-emag.log"

# nvm nu e in PATH-ul launchd — il incarcam (rezista la upgrade de node).
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
export PATH="$NVM_DIR/versions/node/v22.22.3/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

ts() { date '+%Y-%m-%d %H:%M:%S'; }
mkdir -p "$(dirname "$LOG")"

echo "[$(ts)] === START scrape+sync eMAG ===" >> "$LOG"

if ! command -v node >/dev/null; then
  echo "[$(ts)] EROARE: node negasit in PATH. Automatizare oprita." >> "$LOG"
  exit 1
fi

# 1. Scraping local (EMAG_FETCH=playwright vine din .env)
cd "$REPO/worker" || { echo "[$(ts)] EROARE: lipseste $REPO/worker" >> "$LOG"; exit 1; }
npm run scrape-emag:now >> "$LOG" 2>&1
rc=$?
if [ $rc -ne 0 ]; then
  echo "[$(ts)] scrape a esuat (cod $rc) — NU sincronizez pe prod." >> "$LOG"
  exit 1
fi
echo "[$(ts)] scrape OK" >> "$LOG"

# 2. Sync pe productie (upsert doar eMAG; scriptul se opreste singur daca 0 oferte local)
cd "$REPO" || exit 1
# Retry: un blip de rețea (ex. la 07:00) nu trebuie să piardă sync-ul zilei. Upsert-ul
# e idempotent și tranzacțional, deci reîncercarea e sigură.
sync_rc=1
for attempt in 1 2 3; do
  if ./sync-emag-to-live.sh >> "$LOG" 2>&1; then sync_rc=0; break; fi
  sync_rc=$?
  echo "[$(ts)] sync încercarea $attempt a eșuat (cod $sync_rc); reîncerc în 60s..." >> "$LOG"
  sleep 60
done
if [ $sync_rc -ne 0 ]; then
  echo "[$(ts)] sync a eșuat definitiv după 3 încercări (cod $sync_rc)." >> "$LOG"
  exit 1
fi

echo "[$(ts)] === DONE (scrape + sync OK) ===" >> "$LOG"
