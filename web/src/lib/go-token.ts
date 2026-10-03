// Tokenuri pentru /go/[offerId] — dovada ca clickul vine dintr-un browser real.
//
// De ce: pe 1 oct. 2026 un robot (user-agent de browser, ignora robots.txt) a cerut ~19.900 de
// /go/ in 6 ore. Fiecare cerere ajungea ca click de afiliat la Profitshare/2Performant (risc de
// suspiciune de frauda, statistici umflate). Robotii obisnuiti NU ruleaza JavaScript; un vizitator
// real da, deci:
//
//   1. Token JS („j”): butonul „Vezi oferta” (components/analytics/AffiliateLink.tsx) cere prin
//      JS un token de la POST /api/go-token si il lipeste pe link: /go/123?t=<token>. Tokenul e
//      semnat cu un secret de pe server, legat de oferta si expira (GO_TOKEN_TTL_S).
//   2. Token de formular („f”): pentru vizitatorii FARA JavaScript, pagina intermediara are un
//      buton care trimite un formular (POST) cu un token pus in HTML. E valabil doar dupa cateva
//      secunde de la afisare (un om citeste pagina; un robot care trimite formularul instant, nu)
//      si cel mult GO_FORM_MAX_AGE_S.
//
// Formatul: `<tip>.<timp in secunde, baza 36>.<semnatura>`. Semnatura = HMAC-SHA256 peste
// `go|<tip>|<offerId>|<timp>`, base64url, primele 22 de caractere (~128 biti — de ajuns pentru un
// token care traieste cateva minute). Fara stare pe server: verificarea = recalcularea semnaturii.
// Tokenul NU contine date despre vizitator.
//
// Fisierul nu importa nimic din Next.js, ca sa poata fi testat cu node --test (go-token.test.ts).

import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

export const GO_TOKEN_TTL_S = 10 * 60          // tokenul JS e valabil 10 minute
export const GO_FORM_MIN_AGE_S = 2              // formularul fara JS: minim 2 s de la afisare
export const GO_FORM_MAX_AGE_S = 30 * 60        // ... si maxim 30 de minute

type Kind = 'j' | 'f'

// Secretul de semnare. Ordinea:
//   1. GO_TOKEN_SECRET (recomandat: openssl rand -hex 32);
//   2. derivat din ADMIN_SESSION_SECRET (exista deja pe server) — HMAC cu o eticheta fixa, deci
//      tokenul /go/ nu poate fi folosit niciodata ca sesiune de admin si nici invers;
//   3. niciunul → null: verificarea tokenului e dezactivata (fail-open, vezi isTokenCheckEnabled),
//      ca un deploy fara env sa nu blocheze clickurile vizitatorilor reali.
export function goTokenSecret(env: Partial<Record<string, string>> = process.env): string | null {
  const own = env.GO_TOKEN_SECRET?.trim()
  if (own) return own
  const admin = env.ADMIN_SESSION_SECRET?.trim()
  if (admin) return createHmac('sha256', admin).update('superieftin/go-token/v1').digest('hex')
  return null
}

// Comutatorul de urgenta: GO_TOKEN_CHECK=0 opreste cerinta de token (limita de viteza ramane).
export function isTokenCheckEnabled(env: Partial<Record<string, string>> = process.env): boolean {
  if (env.GO_TOKEN_CHECK === '0') return false
  return goTokenSecret(env) !== null
}

function signature(secret: string, kind: Kind, offerId: number, t: string): string {
  return createHmac('sha256', secret).update(`go|${kind}|${offerId}|${t}`).digest('base64url').slice(0, 22)
}

function build(secret: string, kind: Kind, offerId: number, tSec: number): string {
  const t = tSec.toString(36)
  return `${kind}.${t}.${signature(secret, kind, offerId, t)}`
}

// Desface tokenul si verifica semnatura (comparatie in timp constant). Intoarce timpul din token
// (secunde) sau null daca tokenul e stricat / falsificat / pentru alta oferta.
function parse(secret: string, kind: Kind, offerId: number, token: unknown): number | null {
  if (typeof token !== 'string' || token.length > 64) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [k, t, sig] = parts
  if (k !== kind || !/^[0-9a-z]{1,10}$/.test(t)) return null
  const expected = Buffer.from(signature(secret, kind, offerId, t))
  const given = Buffer.from(sig)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  return parseInt(t, 36)
}

const nowSec = (nowMs: number) => Math.floor(nowMs / 1000)

// Token JS: in el se scrie momentul EXPIRARII.
export function signGoToken(secret: string, offerId: number, nowMs = Date.now()): { token: string; expiresAt: number } {
  const exp = nowSec(nowMs) + GO_TOKEN_TTL_S
  return { token: build(secret, 'j', offerId, exp), expiresAt: exp * 1000 }
}

export function verifyGoToken(secret: string, offerId: number, token: unknown, nowMs = Date.now()): boolean {
  const exp = parse(secret, 'j', offerId, token)
  if (exp === null) return false
  // Expirat sau cu expirare mult in viitor (nu emitem asa ceva) → invalid
  const now = nowSec(nowMs)
  return exp >= now && exp <= now + GO_TOKEN_TTL_S
}

// Token de formular: in el se scrie momentul AFISARII paginii intermediare.
export function signFormToken(secret: string, offerId: number, nowMs = Date.now()): string {
  return build(secret, 'f', offerId, nowSec(nowMs))
}

export type FormTokenResult = 'ok' | 'too_fast' | 'invalid'

export function verifyFormToken(secret: string, offerId: number, token: unknown, nowMs = Date.now()): FormTokenResult {
  const iat = parse(secret, 'f', offerId, token)
  if (iat === null) return 'invalid'
  const age = nowSec(nowMs) - iat
  if (age < 0 || age > GO_FORM_MAX_AGE_S) return 'invalid'
  if (age < GO_FORM_MIN_AGE_S) return 'too_fast'
  return 'ok'
}

// Exceptia pentru teste (lista alba): headerul `x-go-test-token` trebuie sa fie egal cu
// GO_TEST_TOKEN. Comparam hash-urile SHA-256 (lungime fixa) cu timingSafeEqual, ca timpul de
// raspuns sa nu tradeze cate caractere se potrivesc. Fara GO_TEST_TOKEN in env → exceptia e oprita.
export const GO_TEST_HEADER = 'x-go-test-token'

export function matchesTestToken(given: string | null | undefined, expected: string | undefined): boolean {
  const exp = expected?.trim()
  if (!exp || !given) return false
  const a = createHash('sha256').update(given).digest()
  const b = createHash('sha256').update(exp).digest()
  return timingSafeEqual(a, b)
}
