// Ramas-bun la inchiderea alertelor de pret (npm run alerte:ramas-bun) — logica, fara DB/Redis/retea.
// Totul vine prin `deps` (scriptul scripts/alerte-ramas-bun.ts le leaga de Postgres, BullMQ si
// Telegram; testele de simulari — niciun mesaj real).
//
// Pasi (fiecare pornit separat, de mana):
//   plan                — doar numara si afiseaza textele (implicit);
//   send  (--confirm)   — UN mesaj Telegram per conversatie cu alerte active (plafon de rata) +
//                          UN job 'farewell' per abonat email confirmat (coada 'email'; workerul
//                          trimite emailul cu List-Unsubscribe). Se poate relua fara dubluri:
//                          conversatiile deja anuntate sunt tinute minte (Redis), joburile au jobId fix;
//   purge-plan (--purge) — arata ce s-ar sterge;
//   purge (--purge --confirm) — sterge abonatii email (CASCADE pe alerte), conversatiile Telegram
//                          (CASCADE pe alerte) si orice alerta ramasa. Refuza cat timp mai sunt
//                          emailuri de ramas-bun in coada (altfel s-ar pierde).

import { FAREWELL_DELETE_DAYS, FAREWELL_EMAIL, farewellTelegramText } from './alerts-closing.js'

export type FarewellMode = 'plan' | 'send' | 'purge-plan' | 'purge'

export interface FarewellCounts {
  telegramChats: number          // conversatii distincte cu cel putin o alerta activa (primesc mesaj)
  telegramAlerts: number         // alerte active pe Telegram
  telegramUsers: number          // toate conversatiile salvate (se sterg la purge)
  emailSubscribers: number       // abonati email confirmati (primesc email)
  emailAlerts: number            // alerte active confirmate pe email
  emailUnconfirmed: number       // abonati neconfirmati (nu primesc nimic; se sterg la purge)
  allAlerts: number              // toate randurile din price_alerts (se sterg la purge)
}

export type TelegramSendResult = { ok: true } | { ok: false; retryAfterSec?: number; blocked?: boolean; error?: string }

export interface SentStore {
  has(chatId: number): Promise<boolean>
  add(chatId: number): Promise<void>
  clear(): Promise<void>
}

export interface FarewellDeps {
  siteUrl: string
  counts(): Promise<FarewellCounts>
  telegramChats(): Promise<number[]>
  emailSubscriberIds(): Promise<number[]>
  sendTelegram(chatId: number, text: string): Promise<TelegramSendResult>
  enqueueFarewellEmail(subscriberId: number): Promise<'added' | 'exists'>
  pendingFarewellEmails(): Promise<number>
  purge(): Promise<{ emailSubscribers: number; telegramUsers: number; alerts: number }>
  sentTelegram: SentStore
  telegramEnabled: boolean       // TELEGRAM_BOT_TOKEN configurat
  emailEnabled: boolean          // SMTP + EMAIL_FROM + ALERT_TOKEN_SECRET configurate
  sleep(ms: number): Promise<void>
  log(line: string): void
}

// Telegram: max ~30 mesaje/s global; ramanem la 20/s (50 ms intre mesaje)
export const TELEGRAM_RATE_PER_SEC = 20

export interface FarewellResult {
  mode: FarewellMode
  counts: FarewellCounts
  telegram: { sent: number; skipped: number; failed: number }
  email: { queued: number; alreadyQueued: number }
  purged: { emailSubscribers: number; telegramUsers: number; alerts: number } | null
  refused: string | null
}

export function previewTexts(siteUrl: string): string {
  const t = FAREWELL_EMAIL
  return [
    '──── Telegram (parse_mode HTML) ────',
    farewellTelegramText(siteUrl),
    '',
    '──── Email ────',
    `Subiect: ${t.subject}`,
    `Previzualizare: ${t.preheader}`,
    '',
    t.paragraphs.join('\n\n'),
    '',
    `[buton] ${t.button} → ${siteUrl.replace(/\/+$/, '')}/?utm_source=alerta&utm_medium=email&utm_campaign=inchidere_alerte`,
    '',
    t.closing,
    '',
    `Subsol: ${t.why} · ${t.deleteNowLabel} (dezabonare = ștergere imediată) · Confidențialitate · Contact`,
    '(plus headerele List-Unsubscribe + List-Unsubscribe-Post, ca la toate emailurile)',
  ].join('\n')
}

function describeCounts(c: FarewellCounts): string[] {
  return [
    `Telegram: ${c.telegramChats} conversații distincte cu alerte active (${c.telegramAlerts} alerte active); ${c.telegramUsers} conversații salvate în total`,
    `Email: ${c.emailSubscribers} abonați confirmați (${c.emailAlerts} alerte active); ${c.emailUnconfirmed} abonați neconfirmați (nu primesc nimic)`,
    `Toate alertele din baza de date (orice stare): ${c.allAlerts}`,
  ]
}

export async function runFarewell(mode: FarewellMode, deps: FarewellDeps): Promise<FarewellResult> {
  const counts = await deps.counts()
  const result: FarewellResult = {
    mode, counts, telegram: { sent: 0, skipped: 0, failed: 0 }, email: { queued: 0, alreadyQueued: 0 }, purged: null, refused: null,
  }
  for (const l of describeCounts(counts)) deps.log(l)

  if (mode === 'plan') {
    deps.log('')
    deps.log('MOD PLAN — nu se trimite nimic. Textele care ar pleca:')
    deps.log('')
    deps.log(previewTexts(deps.siteUrl))
    deps.log('')
    deps.log(`Pasul următor: --confirm (trimite), apoi după ${FAREWELL_DELETE_DAYS} zile --purge --confirm (șterge).`)
    if (!deps.telegramEnabled) deps.log('Atenție: TELEGRAM_BOT_TOKEN lipsește — mesajele Telegram NU ar pleca.')
    if (!deps.emailEnabled) deps.log('Atenție: emailul nu e configurat (SMTP_HOST / EMAIL_FROM / ALERT_TOKEN_SECRET) — emailurile NU ar pleca.')
    return result
  }

  if (mode === 'send') {
    // --- Telegram: direct, cu plafon de rata; o conversatie deja anuntata e sarita ---
    if (!deps.telegramEnabled) deps.log('Telegram: TELEGRAM_BOT_TOKEN lipsește — sar peste mesaje.')
    else {
      const text = farewellTelegramText(deps.siteUrl)
      const gap = Math.ceil(1000 / TELEGRAM_RATE_PER_SEC)
      for (const chatId of await deps.telegramChats()) {
        if (await deps.sentTelegram.has(chatId)) { result.telegram.skipped++; continue }
        let r = await deps.sendTelegram(chatId, text)
        // 429 (prea multe mesaje): asteptam cat cere Telegram si mai incercam o data
        if (!r.ok && r.retryAfterSec) {
          await deps.sleep((r.retryAfterSec + 1) * 1000)
          r = await deps.sendTelegram(chatId, text)
        }
        if (r.ok) { result.telegram.sent++; await deps.sentTelegram.add(chatId) }
        else if (r.blocked) {
          // Utilizatorul a blocat botul / a sters conversatia: nu-l mai putem anunta, nu reincercam
          result.telegram.skipped++
          await deps.sentTelegram.add(chatId)
        } else { result.telegram.failed++; deps.log(`Telegram: conversația ${chatId} a eșuat (${r.error ?? 'eroare'})`) }
        await deps.sleep(gap)
      }
      deps.log(`Telegram: ${result.telegram.sent} trimise, ${result.telegram.skipped} sărite (deja anunțate / bot blocat), ${result.telegram.failed} eșuate`)
    }

    // --- Email: un job 'farewell' per abonat confirmat; trimiterea o face workerul de email ---
    if (!deps.emailEnabled) deps.log('Email: neconfigurat — sar peste emailuri.')
    else {
      for (const id of await deps.emailSubscriberIds()) {
        const r = await deps.enqueueFarewellEmail(id)
        if (r === 'added') result.email.queued++
        else result.email.alreadyQueued++
      }
      deps.log(`Email: ${result.email.queued} emailuri puse în coadă (${result.email.alreadyQueued} erau deja); le trimite workerul de email, unul câte unul`)
    }
    return result
  }

  // --- purge ---
  const pending = await deps.pendingFarewellEmails()
  if (pending > 0) {
    result.refused = `Mai sunt ${pending} emailuri de rămas-bun în coadă — așteaptă să plece, apoi reia --purge.`
    deps.log(result.refused)
    return result
  }
  if (mode === 'purge-plan') {
    deps.log(`MOD PLAN — s-ar șterge: ${counts.emailSubscribers + counts.emailUnconfirmed} abonați email, ${counts.telegramUsers} conversații Telegram, ${counts.allAlerts} alerte. Rulează cu --purge --confirm.`)
    return result
  }
  result.purged = await deps.purge()
  await deps.sentTelegram.clear()
  deps.log(`Șters: ${result.purged.emailSubscribers} abonați email, ${result.purged.telegramUsers} conversații Telegram, ${result.purged.alerts} alerte.`)
  return result
}

export function parseFarewellArgs(args: string[]): FarewellMode | { error: string } {
  const known = new Set(['--confirm', '--purge'])
  const unknown = args.filter((a) => !known.has(a))
  if (unknown.length) return { error: `Argumente necunoscute: ${unknown.join(' ')} (permis: --confirm, --purge)` }
  const purge = args.includes('--purge'), confirm = args.includes('--confirm')
  if (purge) return confirm ? 'purge' : 'purge-plan'
  return confirm ? 'send' : 'plan'
}
