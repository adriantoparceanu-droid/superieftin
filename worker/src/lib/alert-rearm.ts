// Ciclul de viata al unei alerte de pret, cu RE-ARMARE (aprobat de proprietar, 2026-10-03).
// Logica pura, testata in alert-rearm.test.ts; o folosesc atat Telegram (alerts.worker.ts), cat si
// emailul (email.worker.ts).
//
// Starile unei alerte vii (is_active = true):
//   ARMATA     (triggered_at IS NULL)     — asteptam ca cel mai mic pret disponibil sa ajunga la prag
//   TRIMISA    (triggered_at IS NOT NULL) — am anuntat; asteptam ca pretul sa urce din nou peste
//                                          prag + ALERT_REARM_PCT (implicit 3%), apoi o re-armam
// Exemplu (prag 1.000 lei, marja 3% → pragul de re-armare 1.030 lei):
//   1.050 → 990  : ARMATA → anunt, devine TRIMISA
//   990 → 1.020  : sub 1.030, ramane TRIMISA (o oscilatie mica nu re-armeaza → fara spam)
//   1.020 → 1.040: peste 1.030 → re-armata
//   1.040 → 985  : anunt nou
// Fara nicio oferta disponibila, alerta TRIMISA ramane asa (nu se re-armeaza, nu se sterge).
//
// Plafoane: pe email, cel mult un digest la EMAIL_ALERT_MIN_INTERVAL_HOURS per abonat (digest.ts);
// pe Telegram, cel mult un mesaj la TELEGRAM_ALERT_MIN_INTERVAL_HOURS per alerta (implicit 24 h) —
// o alerta re-armata care scade din nou mai repede asteapta (ramane ARMATA) pana trece fereastra.

export type AlertDecision = 'notify' | 'rearm' | 'wait'

export interface AlertSnapshot {
  armed: boolean                 // triggered_at IS NULL
  target: number
  bestPrice: number | null       // cel mai mic pret DISPONIBIL acum (null = nicio oferta disponibila)
  lastNotifiedAt: string | null  // ultimul anunt (pentru plafonul per alerta)
}

export interface RearmOptions {
  rearmPct: number
  minIntervalHours: number | null   // plafon per alerta (Telegram); null = fara (emailul are plafon per abonat)
  nowMs: number
}

export function rearmThreshold(target: number, rearmPct: number): number {
  return Math.round(target * (1 + rearmPct / 100) * 100) / 100
}

export function decideAlert(a: AlertSnapshot, o: RearmOptions): AlertDecision {
  if (a.armed) {
    if (a.bestPrice == null || a.bestPrice > a.target) return 'wait'
    if (o.minIntervalHours != null && a.lastNotifiedAt) {
      const last = Date.parse(a.lastNotifiedAt)
      if (Number.isFinite(last) && o.nowMs - last < o.minIntervalHours * 3600 * 1000) return 'wait'
    }
    return 'notify'
  }
  // TRIMISA: re-armam doar cand pretul a urcat clar peste prag (strict peste pragul de re-armare)
  if (a.bestPrice != null && a.bestPrice > rearmThreshold(a.target, o.rearmPct)) return 'rearm'
  return 'wait'
}

// Cel mai mic pret dintre ofertele disponibile (null = niciuna)
export function bestAvailablePrice(offers: { price: number; available: boolean }[] | null | undefined): number | null {
  let best: number | null = null
  for (const o of offers ?? []) {
    if (!o.available || !(o.price > 0)) continue
    if (best == null || o.price < best) best = o.price
  }
  return best
}

type Env = Partial<Record<string, string>>
const num = (v: string | undefined, d: number, min = 0) => {
  const n = parseFloat(v ?? '')
  return Number.isFinite(n) && n >= min ? n : d
}

export const alertRearmPct = (env: Env = process.env) => num(env.ALERT_REARM_PCT, 3)
export const telegramMinIntervalHours = (env: Env = process.env) => num(env.TELEGRAM_ALERT_MIN_INTERVAL_HOURS, 24)
// Limita de viata: o alerta fara nicio confirmare / anunt / re-armare / schimbare de prag de atatea
// zile se sterge (promis in /confidentialitate). Implicit 365 de zile.
export const alertMaxIdleDays = (env: Env = process.env) => num(env.ALERT_MAX_IDLE_DAYS, 365, 1)
