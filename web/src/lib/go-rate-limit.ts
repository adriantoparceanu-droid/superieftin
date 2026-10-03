// Limitare de viteza per IP pentru /go/[offerId] (si /api/go-token), in Redis.
//
// De ce Redis si nu lib/rate-limit.ts (in memorie): contorul trebuie sa supravietuiasca
// restartului containerului web si sa fie acelasi pentru toate procesele. Redis exista deja.
//
// Doua ferestre fixe, verificate impreuna:
//   - pe minut  (GO_RATE_PER_MIN,  implicit 20) — prinde rafalele;
//   - pe ora    (GO_RATE_PER_HOUR, implicit 120) — prinde robotul „politicos” care merge constant
//     sub limita pe minut (ex. 19/min = 1.140/ora). Un om care compara oferte face cateva-zeci
//     de clickuri pe ora, nu sute.
//
// Confidentialitate (GDPR): IP-ul NU se salveaza nicaieri. Cheia din Redis e un hash (HMAC cu un
// secret al serverului, deci nu se poate inversa prin incercarea tuturor IP-urilor) si expira
// singura: cheia pe minut dupa 2 minute, cea pe ora dupa ~61 de minute. Nu ajunge in baza de date,
// nu se logheaza.
//
// Fail-open: daca Redis e cazut sau raspunde greu (> GO_RATE_REDIS_TIMEOUT_MS), cererea TRECE.
// Un vizitator real nu trebuie blocat de o pana; protectia prin token (go-token.ts) ramane activa.

import { createHmac } from 'node:crypto'

// Minimul de care avem nevoie din clientul Redis (ioredis) — interfata permite un Redis fals in teste.
export interface RateLimitRedis {
  status?: string
  multi(): {
    incr(key: string): unknown
    expire(key: string, seconds: number): unknown
    exec(): Promise<Array<[Error | null, unknown]> | null>
  }
}

export interface GoRateLimits {
  perMinute: number
  perHour: number
  timeoutMs: number
}

function intFromEnv(v: string | undefined, def: number): number {
  const n = parseInt(v ?? '', 10)
  return Number.isFinite(n) && n > 0 ? n : def
}

export function goRateLimits(env: Partial<Record<string, string>> = process.env): GoRateLimits {
  return {
    perMinute: intFromEnv(env.GO_RATE_PER_MIN, 20),
    perHour: intFromEnv(env.GO_RATE_PER_HOUR, 120),
    timeoutMs: intFromEnv(env.GO_RATE_REDIS_TIMEOUT_MS, 150),
  }
}

// Limita pentru /api/go-token: mai larga, pentru ca tokenul se cere si la trecerea mouse-ului
// peste butoane (o pagina de categorie are zeci de oferte), nu doar la click.
export function goTokenRateLimits(env: Partial<Record<string, string>> = process.env): GoRateLimits {
  return {
    perMinute: intFromEnv(env.GO_TOKEN_RATE_PER_MIN, 60),
    perHour: intFromEnv(env.GO_TOKEN_RATE_PER_HOUR, 600),
    timeoutMs: intFromEnv(env.GO_RATE_REDIS_TIMEOUT_MS, 150),
  }
}

// Hash-ul IP-ului folosit drept cheie. Salt = secretul serverului (acelasi ca la tokenuri);
// fara secret, un salt fix — tot nu se salveaza nimic, cheia expira in minute.
export function hashIp(ip: string, salt: string | null): string {
  return createHmac('sha256', salt ?? 'superieftin/go-rl').update(ip).digest('base64url').slice(0, 16)
}

export type RateLimitResult =
  | { allowed: true; reason: 'ok' | 'fail_open' | 'no_ip' }
  | { allowed: false; reason: 'minute' | 'hour' }

export async function checkRateLimit(
  redis: RateLimitRedis,
  scope: string,                 // 'go' sau 'tok' — contoare separate
  ip: string,
  limits: GoRateLimits,
  salt: string | null,
  nowMs = Date.now(),
): Promise<RateLimitResult> {
  // Fara IP (headerele de la Cloudflare/nginx lipsesc — ex. next dev local sau o configurare
  // schimbata pe server): NU folosim o cheie comuna, pentru ca atunci TOTI vizitatorii ar imparti
  // aceeasi limita de 20/min si s-ar bloca unii pe altii. Trecem cererea (protectia prin token ramane).
  if (!ip || ip === 'necunoscut') return { allowed: true, reason: 'no_ip' }

  // Conexiune deja cazuta (ioredis se reconecteaza in fundal): nu mai asteptam deloc.
  if (redis.status === 'end' || redis.status === 'reconnecting' || redis.status === 'close') {
    return { allowed: true, reason: 'fail_open' }
  }

  const h = hashIp(ip, salt)
  const minuteBucket = Math.floor(nowMs / 60_000)
  const hourBucket = Math.floor(nowMs / 3_600_000)
  const kMin = `rl:${scope}:m:${h}:${minuteBucket}`
  const kHour = `rl:${scope}:h:${h}:${hourBucket}`

  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    // MULTI = cele 4 comenzi pleaca intr-un singur drum spre Redis si se executa impreuna
    const m = redis.multi()
    m.incr(kMin)
    m.expire(kMin, 120)
    m.incr(kHour)
    m.expire(kHour, 3_660)
    const timeout = new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), limits.timeoutMs) })
    const res = await Promise.race([m.exec(), timeout])
    if (res === 'timeout' || !res) return { allowed: true, reason: 'fail_open' }
    const [[e1, cMin], , [e3, cHour]] = res
    if (e1 || e3) return { allowed: true, reason: 'fail_open' }
    if (Number(cMin) > limits.perMinute) return { allowed: false, reason: 'minute' }
    if (Number(cHour) > limits.perHour) return { allowed: false, reason: 'hour' }
    return { allowed: true, reason: 'ok' }
  } catch {
    return { allowed: true, reason: 'fail_open' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
