// Emailul de ramas-bun (inchiderea alertelor, 20 nov. 2026) — trimiterea pentru UN abonat.
// Fara DB: workerul (workers/email.worker.ts, job 'farewell') citeste abonatul si cheama functia;
// testele o cheama direct, cu serverul SMTP in memorie (fake-smtp.ts).
import type { Transporter } from 'nodemailer'
import type { EmailConfig } from './config.js'
import { sendEmail } from './send.js'
import { emailLinks, renderFarewellEmail } from './templates.js'
import { signAlertToken } from '../alert-token.js'

export async function sendFarewellEmail(
  cfg: EmailConfig,
  mailer: Pick<Transporter, 'sendMail'>,
  sub: { id: number; email: string },
): Promise<void> {
  const links = emailLinks(cfg.siteUrl, {
    manage: signAlertToken(cfg.tokenSecret, 'm', sub.id),
    unsubscribe: signAlertToken(cfg.tokenSecret, 'u', sub.id),
  })
  await sendEmail(mailer, cfg, sub.email, renderFarewellEmail({ links }))
}
