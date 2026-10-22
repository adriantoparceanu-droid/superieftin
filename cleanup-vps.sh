#!/bin/bash
# Curatenie periodica pe VPS: goleste cache-ul Next.js acumulat in stratul
# scriptibil al containerului web (paginile de produs generate on-demand prin
# ISR nu se evacueaza niciodata singure, chiar si dupa ce produsul dispare din
# DB) si sterge imaginile docker dangling. Aplicatia web e stateless, deci
# recrearea containerului e sigura (~cateva secunde de indisponibilitate).
# Nu atinge alte stack-uri de pe acelasi VPS (ex. pricetoday).
#
# Ruleaza pe VPS (nu local) — copie de referinta a /home/superieftin/app/cleanup.sh,
# instalat prin crontab-ul userului superieftin: 30 3 * * * (zilnic 03:30 ora serverului,
# Europe/Berlin = 04:30 ora Romaniei). Zilnic din 22.10.2026: cache-ul /p/ crestea ~3 GB/zi.
set -e
cd /home/superieftin/app
echo "=== $(date -Is) ==="
docker compose up -d --force-recreate web
docker image prune -f
