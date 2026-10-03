// Trimiterea propriu-zisa, prin SMTP (nodemailer). Fiecare email are link de dezabonare in corp
// si headerele List-Unsubscribe + List-Unsubscribe-Post (dezabonare dintr-un click din Gmail,
// Yahoo, Apple Mail — RFC 8058; cerute de Gmail/Yahoo pentru expeditorii de volum).
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type { EmailConfig } from './config.js'
import type { RenderedEmail } from './templates.js'

export function createMailer(cfg: EmailConfig): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass ?? '' } : undefined,
    // Nu asteptam la nesfarsit un server SMTP cazut: jobul trebuie sa se termine
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  })
}

export async function sendEmail(
  mailer: Pick<Transporter, 'sendMail'>,
  cfg: EmailConfig,
  to: string,
  mail: RenderedEmail,
): Promise<void> {
  await mailer.sendMail({
    from: cfg.from,
    to,
    replyTo: cfg.replyTo ?? undefined,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    headers: {
      'List-Unsubscribe': `<${mail.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
}
