#!/bin/bash
# Script de deploy pe VPS (Faza 4)
# Rulat in /opt/superieftin ca root sau utilizator cu drepturi docker

set -euo pipefail

echo "==> [1/5] Pull ultimele modificari..."
git pull origin main

echo "==> [2/5] Build imagini Docker..."
docker compose build web worker

echo "==> [3/5] Pornire postgres si redis..."
docker compose up -d postgres redis

echo "    Asteptare postgres healthy..."
timeout 60 bash -c 'until docker compose exec -T postgres pg_isready -U "${POSTGRES_USER:-superieftin}" > /dev/null 2>&1; do sleep 2; done'
echo "    PostgreSQL ready."

echo "==> [4/5] Rulare migratii baza de date..."
docker compose run --rm --profile tools migrate

echo "==> [5/5] Pornire / restart servicii web si worker..."
docker compose up -d web worker

echo ""
echo "==> Deploy complet!"
docker compose ps
