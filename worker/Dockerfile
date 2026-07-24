# --- Build ---
FROM node:22-slim AS builder
WORKDIR /app

# Dependente (separate pentru cache Docker)
COPY package.json package-lock.json ./
COPY web/package.json ./web/
COPY worker/package.json ./worker/
# Playwright e folosit DOAR local (scraping eMAG de pe IP rezidential). In productie nu
# descarcam browserul (WAF-ul blocheaza oricum IP-ul de datacenter) — imagine zvelta.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

# Surse worker + build TypeScript
COPY worker ./worker
RUN npm run build --workspace=worker

# --- Runner ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Dependente de runtime
COPY --from=builder /app/node_modules ./node_modules

# Cod compilat
COPY --from=builder /app/worker/dist ./worker/dist
COPY --from=builder /app/worker/package.json ./worker/package.json

# Fisierele de migratie SQL
COPY db ./db

CMD ["node", "worker/dist/index.js"]
