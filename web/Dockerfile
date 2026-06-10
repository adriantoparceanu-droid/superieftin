# --- Build ---
FROM node:22-alpine AS builder
WORKDIR /app

# Dependente (separate pentru cache Docker)
COPY package.json package-lock.json ./
COPY web/package.json ./web/
COPY worker/package.json ./worker/
RUN npm ci

# Surse + build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build --workspace=web

# --- Runner (imagine minimala) ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone Next.js: include doar serverul + fisierele statice
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/web/.next/static ./web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/web/public ./web/public

USER nextjs
EXPOSE 3000

CMD ["node", "web/server.js"]
