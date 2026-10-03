// Linkuri semnate pentru alertele pe email (fara cont, fara parola).
//
// ACELASI format ca worker/src/lib/alert-token.ts — modifica-le impreuna. Workerul semneaza linkurile
// din emailuri (confirmare, „Alertele mele”, dezabonare), site-ul le verifica. Testele din ambele
// parti verifica acelasi token de referinta (TOKEN_DE_REFERINTA), ca sa prinda o desincronizare.
//
// Format: `<tip>.<id baza 36>.<expirare in secunde baza 36, 0 = fara>.<semnatura>`
// Semnatura = HMAC-SHA256(secret, `alerta|<tip>|<id>|<exp>`), base64url, 22 de caractere (~128 biti).
// Fara stare pe server: verificarea = recalcularea semnaturii. Tokenul nu contine adresa de email.
//
// Tipuri:
//   c = confirmarea unei alerte (id = price_alerts.id), expira in CONFIRM_TTL_S
//   m = pagina „Alertele mele” (id = email_subscribers.id), expira in MANAGE_TTL_S
//   u = dezabonare totala (id = email_subscribers.id), NU expira: linkul din orice email vechi
//       trebuie sa mearga oricand (cerinta Gmail/Yahoo pentru List-Unsubscribe)

import { createHmac, timingSafeEqual } from 'node:crypto'

export type AlertTokenKind = 'c' | 'm' | 'u'

export const CONFIRM_TTL_S = 3 * 24 * 3600     // 3 zile (abonarile neconfirmate se sterg la 7)
export const MANAGE_TTL_S = 60 * 24 * 3600     // 60 de zile; fiecare email nou aduce un link nou

// Secret dedicat (openssl rand -hex 32), acelasi in web si worker. Fara el, alertele pe email
// sunt dezactivate (vezi lib/email/config.ts).
export function alertTokenSecret(env: Partial<Record<string, string>> = process.env): string | null {
  return env.ALERT_TOKEN_SECRET?.trim() || null
}

function signature(secret: string, kind: AlertTokenKind, id: string, exp: string): string {
  return createHmac('sha256', secret).update(`alerta|${kind}|${id}|${exp}`).digest('base64url').slice(0, 22)
}

export function signAlertToken(secret: string, kind: AlertTokenKind, id: number, nowMs = Date.now()): string {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`id invalid: ${id}`)
  const ttl = kind === 'c' ? CONFIRM_TTL_S : kind === 'm' ? MANAGE_TTL_S : 0
  const exp = ttl ? (Math.floor(nowMs / 1000) + ttl).toString(36) : '0'
  const i = id.toString(36)
  return `${kind}.${i}.${exp}.${signature(secret, kind, i, exp)}`
}

// Intoarce id-ul sau null (token stricat, falsificat, de alt tip sau expirat).
export function verifyAlertToken(secret: string, kind: AlertTokenKind, token: unknown, nowMs = Date.now()): number | null {
  if (typeof token !== 'string' || token.length > 80) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [k, i, exp, sig] = parts
  if (k !== kind || !/^[0-9a-z]{1,11}$/.test(i) || !/^[0-9a-z]{1,10}$/.test(exp)) return null
  const expected = Buffer.from(signature(secret, kind, i, exp))
  const given = Buffer.from(sig)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  const expSec = parseInt(exp, 36)
  if (expSec !== 0 && expSec * 1000 < nowMs) return null
  if (kind !== 'u' && expSec === 0) return null   // doar dezabonarea poate fi fara expirare
  const id = parseInt(i, 36)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}
