// Configurarea alertelor pe email, din .env. Agnostic de furnizor: orice server SMTP (Brevo,
// Amazon SES, Postmark, Resend, serverul propriu...). Furnizorul se schimba doar din .env.
//
// Alertele pe email sunt ACTIVE doar daca exista toate: SMTP_HOST, EMAIL_FROM, ALERT_TOKEN_SECRET.
// Lipseste una → totul e oprit curat: formularul nu apare pe /p/ (web: lib/email-alerts.ts,
// aceeasi regula), workerul nu trimite nimic si scrie un singur avertisment in log.

import { alertTokenSecret } from '../alert-token.js'
import { siteUrl } from '../price-alert.js'

export interface EmailConfig {
  host: string
  port: number
  secure: boolean            // true = TLS direct (de obicei portul 465); false = STARTTLS pe 587
  user: string | null
  pass: string | null
  from: string               // ex. "superieftin.ro <alerte@superieftin.ro>"
  replyTo: string | null
  siteUrl: string
  tokenSecret: string
  minIntervalHours: number   // plafonul: cel mult un email de alerte la atatea ore per abonat
}

type Env = Partial<Record<string, string>>

export function emailConfig(env: Env = process.env): EmailConfig | null {
  const host = env.SMTP_HOST?.trim()
  const from = env.EMAIL_FROM?.trim()
  const tokenSecret = alertTokenSecret(env)
  if (!host || !from || !tokenSecret) return null
  const port = parseInt(env.SMTP_PORT ?? '', 10) || 587
  const secureEnv = env.SMTP_SECURE?.trim().toLowerCase()
  const secure = secureEnv ? secureEnv === '1' || secureEnv === 'true' : port === 465
  const hours = parseFloat(env.EMAIL_ALERT_MIN_INTERVAL_HOURS ?? '')
  return {
    host,
    port,
    secure,
    user: env.SMTP_USER?.trim() || null,
    pass: env.SMTP_PASS ?? null,
    from,
    replyTo: env.EMAIL_REPLY_TO?.trim() || null,
    siteUrl: siteUrl(env as NodeJS.ProcessEnv),
    tokenSecret,
    minIntervalHours: Number.isFinite(hours) && hours >= 0 ? hours : 24,
  }
}
