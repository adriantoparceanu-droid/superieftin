# --- Etapa 1: Dependente ---
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json ./web/
COPY worker/package.json ./worker/
RUN npm ci

# --- Etapa 2: Build TypeScript ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY worker ./worker
RUN npm run build --workspace=worker

# --- Etapa 3: Runner ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Dependente de runtime (hoisted in monorepo)
COPY --from=deps /app/node_modules ./node_modules

# Codul compilat
COPY --from=builder /app/worker/dist ./worker/dist
COPY --from=builder /app/worker/package.json ./worker/package.json

# Fisierele de migratie (folosite de migrate.js)
COPY db ./db

CMD ["node", "worker/dist/index.js"]
