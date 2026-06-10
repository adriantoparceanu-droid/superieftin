#!/bin/bash
# Script de deploy pe VPS (Faza 4)
# Rulat pe server ca: ./deploy.sh

set -e

echo "==> Pull ultimele modificari..."
git pull origin main

echo "==> Build si restart containere..."
docker compose build --no-cache web worker
docker compose up -d

echo "==> Rulare migratii..."
docker compose exec web node /app/db/migrate.mjs

echo "==> Deploy complet."
docker compose ps
