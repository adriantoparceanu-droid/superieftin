# --- Build (Debian slim - compatibil cu binare native Tailwind/lightningcss) ---
FROM node:22-slim AS builder
WORKDIR /app

# Dependente (separate pentru cache Docker)
# Nu copiem package-lock.json: lockfile generat pe macOS pune lightningcss
# si binarul sau linux in node_modules diferite (web/ vs root), ceea ce rupe build-ul.
# npm install fara lockfile rezolva nativ pentru platforma curenta.
COPY package.json ./
COPY web/package.json ./web/
COPY worker/package.json ./worker/
RUN npm install --include=optional

# Surse + build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# NEXT_PUBLIC_* se inline-uiesc in bundle la build — vin ca build args din compose
ARG NEXT_PUBLIC_GA_MEASUREMENT_ID
ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
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
