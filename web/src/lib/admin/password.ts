import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'

// Hash de parola cu scrypt (nativ Node, fara dependente).
// Format: scrypt:N:r:p:salt_hex:hash_hex
// ATENTIE: worker/src/lib/password.ts e o copie identica — modifica-le impreuna.

const N = 16384, R = 8, P = 1, KEYLEN = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P })
  return `scrypt:${N}:${R}:${P}:${salt.toString('hex')}:${hash.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, n, r, p, saltHex, hashHex] = parts
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, {
    N: parseInt(n), r: parseInt(r), p: parseInt(p),
  })
  return timingSafeEqual(actual, expected)
}
