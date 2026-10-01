import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import pool from '../db'

// Sesiune admin: cookie httpOnly cu token semnat HMAC-SHA256.
// Token: base64url(userId.expiraLa).semnatura_hex

export const ADMIN_SESSION_COOKIE = 'admin_session'
const COOKIE_NAME = ADMIN_SESSION_COOKIE
const SESSION_DAYS = 7

// Semn ca browserul e al unui admin: clickurile lui pe /go nu se numara ca clickuri de clienti
// (lib/internal-traffic.ts). Ramane 1 an si dupa logout — nu da niciun drept de acces.
export const INTERNAL_COOKIE = 'se_intern'
export const INTERNAL_COOKIE_MAX_AGE = 365 * 24 * 3600

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET
  if (!s) throw new Error('ADMIN_SESSION_SECRET lipseste din .env')
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

export function buildToken(userId: number): string {
  const exp = Date.now() + SESSION_DAYS * 24 * 3600 * 1000
  const payload = Buffer.from(`${userId}.${exp}`).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function parseToken(token: string | undefined): number | null {
  if (!token) return null
  const [payload, signature] = token.split('.')
  if (!payload || !signature) return null
  const expected = sign(payload)
  const sigBuf = Buffer.from(signature)
  const expBuf = Buffer.from(expected)
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null
  const [userId, exp] = Buffer.from(payload, 'base64url').toString().split('.')
  if (!userId || !exp || Date.now() > parseInt(exp)) return null
  return parseInt(userId)
}

export async function createSession(userId: number): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, buildToken(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 3600,
  })
  cookieStore.set(INTERNAL_COOKIE, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: INTERNAL_COOKIE_MAX_AGE,
  })
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export interface AdminUser {
  id: number
  email: string
  name: string
}

// Utilizatorul curent sau null — pentru componente server.
export async function getAdminUser(): Promise<AdminUser | null> {
  const cookieStore = await cookies()
  const userId = parseToken(cookieStore.get(COOKIE_NAME)?.value)
  if (!userId) return null
  const { rows } = await pool.query<AdminUser>(
    'SELECT id, email, name FROM admin_users WHERE id = $1 AND is_active = true',
    [userId]
  )
  return rows[0] ?? null
}

// Gardian pentru server actions si layout-ul protejat.
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser()
  if (!user) redirect('/admin/login')
  return user
}
