// Alerte de pret pe email — reguli comune site-ului (logica pura, testata in email-alerts.test.ts).
// Trimiterea emailurilor o face workerul (worker/src/workers/email.worker.ts), prin coada 'email'.
//
// Fluxul (double opt-in):
//   1. formularul de pe /p/ → POST /api/alerte-email: se creeaza o alerta NECONFIRMATA si se cere
//      workerului emailul de confirmare. Raspunsul e acelasi indiferent daca adresa exista deja
//      (nu dezvaluim cine e abonat).
//   2. linkul din email → /alerte/confirmare: butonul „Confirmă” porneste alerta.
//   3. fiecare email are „Alertele mele” (/alerte/gestionare) si dezabonare (/alerte/dezabonare +
//      headerul List-Unsubscribe → POST /api/alerte-email/dezabonare).

import { alertTokenSecret } from './alert-token'

type Env = Partial<Record<string, string>>

// Aceeasi regula ca emailConfig() din worker: fara SMTP_HOST, EMAIL_FROM si ALERT_TOKEN_SECRET,
// formularul nu apare deloc, iar endpoint-urile raspund „dezactivat”.
export function emailAlertsEnabled(env: Env = process.env): boolean {
  return Boolean(env.SMTP_HOST?.trim() && env.EMAIL_FROM?.trim() && alertTokenSecret(env))
}

// Adresa: fara spatii, litere mici, forma simpla (validarea reala = emailul de confirmare)
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  if (e.length < 6 || e.length > 254) return null
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(e)) return null
  if (e.includes('..')) return null
  return e
}

export const MAX_TARGET_PRICE = 100000

// Pragul: suma pozitiva, in lei; „1.299,90”, „1299.9”, „1 299” sunt acceptate.
export function parseTargetPrice(raw: unknown): number | null {
  let t = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw : ''
  t = t.trim().replace(/\s/g, '')
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '')
  t = t.replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null
  const n = parseFloat(t)
  return n >= 1 && n <= MAX_TARGET_PRICE ? Math.round(n * 100) / 100 : null
}

// Pragul trebuie sa fie SUB cel mai mic pret disponibil acum: altfel alerta ar pleca imediat,
// fara ca pretul sa fi scazut. Produs indisponibil (fara pret) → orice prag valid.
export function targetBelowCurrent(target: number, bestPrice: number | null): boolean {
  return bestPrice == null || target < bestPrice
}

// Anti-abuz per adresa (cineva care trimite cereri cu adresa altcuiva): cel mult atatea emailuri de
// confirmare la 24 h pentru aceeasi adresa. Peste limita raspundem la fel, dar nu mai trimitem nimic.
export const MAX_PENDING_PER_EMAIL_24H = 3

// Limita per IP pentru formular si pentru cererea unui link nou (Redis, lib/go-rate-limit.ts)
export function emailAlertRateLimits(env: Env = process.env) {
  const int = (v: string | undefined, d: number) => {
    const n = parseInt(v ?? '', 10)
    return Number.isFinite(n) && n > 0 ? n : d
  }
  return {
    perMinute: int(env.ALERT_RATE_PER_MIN, 5),
    perHour: int(env.ALERT_RATE_PER_HOUR, 20),
    timeoutMs: int(env.GO_RATE_REDIS_TIMEOUT_MS, 150),
  }
}

// Re-armarea alertelor (logica in worker/src/lib/alert-rearm.ts — modifica-le impreuna): dupa anunt,
// alerta asteapta ca cel mai mic pret sa urce peste prag + ALERT_REARM_PCT (implicit 3%), apoi
// anunta din nou la urmatoarea scadere. Aici doar pentru textele din „Alertele mele”.
export function alertRearmPct(env: Env = process.env): number {
  const n = parseFloat(env.ALERT_REARM_PCT ?? '')
  return Number.isFinite(n) && n >= 0 ? n : 3
}
export function rearmThreshold(target: number, rearmPct: number): number {
  return Math.round(target * (1 + rearmPct / 100) * 100) / 100
}

// Mesajul (identic) pe care il vede vizitatorul dupa trimiterea formularului
export const SUBSCRIBE_OK_MESSAGE =
  'Ți-am trimis un email de confirmare. Alerta pornește după ce apeși linkul din email (valabil 3 zile). Dacă nu-l găsești, verifică și dosarul Spam.'
