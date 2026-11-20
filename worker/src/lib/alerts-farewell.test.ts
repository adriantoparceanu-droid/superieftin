// Teste pentru inchiderea alertelor (20 nov. 2026): textele de ramas-bun, scriptul alerte:ramas-bun
// (plan / trimitere / stergere) si botul in modul „inchis”. Fara retea si fara DB: Telegram e simulat,
// emailurile pleaca spre serverul SMTP in memorie (email/fake-smtp.ts) — NICIUN mesaj real.
// Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FAREWELL_DELETE_DAYS, FAREWELL_EMAIL, closedBotReply, farewellHomeUrl, farewellTelegramText, priceAlertsEnabled } from './alerts-closing.js'
import { parseFarewellArgs, runFarewell, type FarewellCounts, type FarewellDeps, type TelegramSendResult } from './alerts-farewell.js'
import { emailConfig } from './email/config.js'
import { createMailer } from './email/send.js'
import { sendFarewellEmail } from './email/farewell.js'
import { startFakeSmtp } from './email/fake-smtp.js'
import { verifyAlertToken } from './alert-token.js'

const SITE = 'https://www.superieftin.ro'
const NO_PROMISES = /reducer|%|garant|economis|ieftinit|mai ieftin/i

test('comutatorul PRICE_ALERTS_ENABLED: implicit OPRIT, pornit doar cu „1”', () => {
  assert.equal(priceAlertsEnabled({}), false)
  assert.equal(priceAlertsEnabled({ PRICE_ALERTS_ENABLED: '0' }), false)
  assert.equal(priceAlertsEnabled({ PRICE_ALERTS_ENABLED: 'true' }), false)
  assert.equal(priceAlertsEnabled({ PRICE_ALERTS_ENABLED: ' 1 ' }), true)
})

test('textele de rămas-bun: link spre homepage cu utm, ștergere în 7 zile, „nu trebuie să faci nimic”, fără promisiuni', () => {
  assert.equal(farewellHomeUrl(SITE + '/', 'telegram'), `${SITE}/?utm_source=alerta&utm_medium=telegram&utm_campaign=inchidere_alerte`)
  const tg = farewellTelegramText(SITE)
  assert.match(tg, /href="https:\/\/www\.superieftin\.ro\/\?utm_source=alerta&amp;utm_medium=telegram&amp;utm_campaign=inchidere_alerte"/)
  assert.match(tg, new RegExp(`se șterg în ${FAREWELL_DELETE_DAYS} zile`))
  assert.match(tg, /Nu trebuie să faci nimic/)
  assert.match(tg, /blog de recomandări/)
  assert.doesNotMatch(tg, NO_PROMISES)
  const all = [FAREWELL_EMAIL.subject, FAREWELL_EMAIL.preheader, ...FAREWELL_EMAIL.paragraphs, FAREWELL_EMAIL.closing].join('\n')
  assert.match(all, /se șterg în 7 zile/)
  assert.match(all, /Nu trebuie să faci nimic/)
  assert.doesNotMatch(all, NO_PROMISES)
  const bot = closedBotReply(SITE)
  assert.match(bot, /s-au închis/)
  assert.doesNotMatch(bot, NO_PROMISES)
})

test('emailul de rămas-bun (SMTP în memorie): subiect, link utm_medium=email, List-Unsubscribe, ștergere imediată, fără „Alertele mele”', async () => {
  const smtp = await startFakeSmtp()
  try {
    const cfg = { ...emailConfig({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), EMAIL_FROM: 'superieftin.ro <alerte@superieftin.ro>', ALERT_TOKEN_SECRET: 's', SITE_URL: SITE })!, secure: false }
    await sendFarewellEmail(cfg, createMailer(cfg), { id: 42, email: 'abonat@exemplu.ro' })
    assert.equal(smtp.messages.length, 1)
    const raw = smtp.messages[0].data.replace(/\r\n[ \t]+/g, ' ')
    assert.match(smtp.messages[0].to[0], /abonat@exemplu\.ro/)
    assert.match(raw, /^Subject: =\?UTF-8\?/m)   // diacritice → subiect codat
    const unsub = raw.match(/^List-Unsubscribe: <https:\/\/www\.superieftin\.ro\/api\/alerte-email\/dezabonare\?t=([^>]+)>/m)
    assert.ok(unsub, 'List-Unsubscribe lipsește')
    assert.equal(verifyAlertToken('s', 'u', decodeURIComponent(unsub[1])), 42)
    assert.match(raw, /^List-Unsubscribe-Post: List-Unsubscribe=One-Click/m)
    // corpul (quoted-printable) — decodam cat sa cautam textul
    const body = raw.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    assert.match(body, /utm_campaign=inchidere_alerte/)
    assert.match(body, /utm_medium=email/)
    assert.match(body, /alerte\/dezabonare\?t=/)
    assert.doesNotMatch(body, /alerte\/gestionare/)
  } finally { await smtp.close() }
})

// --- scriptul (lib/alerts-farewell.ts) cu dependinte simulate ---------------------------------------

const COUNTS: FarewellCounts = { telegramChats: 3, telegramAlerts: 5, telegramUsers: 4, emailSubscribers: 2, emailAlerts: 3, emailUnconfirmed: 1, allAlerts: 9 }

function fakeDeps(over: Partial<FarewellDeps> = {}, tgResults: Record<number, TelegramSendResult[]> = {}) {
  const calls = { telegram: [] as { chatId: number; text: string }[], enqueued: [] as number[], sleeps: [] as number[], purged: 0, logs: [] as string[] }
  const sent = new Set<number>()
  const queued = new Set<number>()
  const deps: FarewellDeps = {
    siteUrl: SITE,
    telegramEnabled: true,
    emailEnabled: true,
    counts: async () => COUNTS,
    telegramChats: async () => [101, 102, 103],
    emailSubscriberIds: async () => [7, 8],
    sendTelegram: async (chatId, text) => {
      calls.telegram.push({ chatId, text })
      return tgResults[chatId]?.shift() ?? { ok: true }
    },
    enqueueFarewellEmail: async (id) => { if (queued.has(id)) return 'exists'; queued.add(id); calls.enqueued.push(id); return 'added' },
    pendingFarewellEmails: async () => 0,
    purge: async () => { calls.purged++; return { emailSubscribers: 3, telegramUsers: 4, alerts: 9 } },
    sentTelegram: { has: async (id) => sent.has(id), add: async (id) => { sent.add(id) }, clear: async () => { sent.clear() } },
    sleep: async (ms) => { calls.sleeps.push(ms) },
    log: (l) => { calls.logs.push(l) },
    ...over,
  }
  return { deps, calls, sent }
}

test('argumente: implicit plan; --confirm trimite; --purge = plan de ștergere; --purge --confirm șterge', () => {
  assert.equal(parseFarewellArgs([]), 'plan')
  assert.equal(parseFarewellArgs(['--confirm']), 'send')
  assert.equal(parseFarewellArgs(['--purge']), 'purge-plan')
  assert.equal(parseFarewellArgs(['--purge', '--confirm']), 'purge')
  assert.ok('error' in (parseFarewellArgs(['--prod']) as object))
})

test('PLAN: doar numără și afișează textele — niciun mesaj, niciun job, nicio ștergere', async () => {
  const { deps, calls } = fakeDeps()
  const r = await runFarewell('plan', deps)
  assert.equal(calls.telegram.length + calls.enqueued.length + calls.purged, 0)
  const out = calls.logs.join('\n')
  assert.match(out, /3 conversații distincte/)
  assert.match(out, /2 abonați confirmați/)
  assert.ok(out.includes(farewellTelegramText(SITE)), 'textul Telegram integral')
  for (const p of FAREWELL_EMAIL.paragraphs) assert.ok(out.includes(p), 'paragraf email')
  assert.equal(r.counts.telegramChats, 3)
})

test('--confirm: UN mesaj per conversație (plafon de rată), 429 reîncercat, bot blocat sărit; UN job per abonat; reluarea nu dublează', async () => {
  const { deps, calls } = fakeDeps({}, {
    102: [{ ok: false, retryAfterSec: 3 }, { ok: true }],
    103: [{ ok: false, blocked: true, error: 'Forbidden: bot was blocked by the user' }],
  })
  const r = await runFarewell('send', deps)
  assert.deepEqual(calls.telegram.map((c) => c.chatId), [101, 102, 102, 103])
  assert.ok(calls.telegram.every((c) => c.text === farewellTelegramText(SITE)))
  assert.deepEqual(r.telegram, { sent: 2, skipped: 1, failed: 0 })
  assert.ok(calls.sleeps.includes(4000), '429: așteaptă retry_after + 1 s')
  assert.ok(calls.sleeps.filter((ms) => ms === 50).length >= 3, 'max 20 mesaje/s')
  assert.deepEqual(calls.enqueued, [7, 8])
  assert.deepEqual(r.email, { queued: 2, alreadyQueued: 0 })

  // a doua rulare: nimic nou
  const r2 = await runFarewell('send', deps)
  assert.equal(calls.telegram.length, 4)
  assert.deepEqual(r2.telegram, { sent: 0, skipped: 3, failed: 0 })
  assert.deepEqual(r2.email, { queued: 0, alreadyQueued: 2 })
})

test('--confirm: emailurile ajung (prin „coadă”) la SMTP-ul în memorie, câte unul per abonat', async () => {
  const smtp = await startFakeSmtp()
  try {
    const cfg = { ...emailConfig({ SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), EMAIL_FROM: 'a <a@superieftin.ro>', ALERT_TOKEN_SECRET: 's', SITE_URL: SITE })!, secure: false }
    const mailer = createMailer(cfg)
    const emails: Record<number, string> = { 7: 'sapte@exemplu.ro', 8: 'opt@exemplu.ro' }
    // „coada”: jobul 'farewell' trimite imediat (in productie: workers/email.worker.ts)
    const { deps } = fakeDeps({ telegramEnabled: false, enqueueFarewellEmail: async (id) => { await sendFarewellEmail(cfg, mailer, { id, email: emails[id] }); return 'added' } })
    await runFarewell('send', deps)
    assert.deepEqual(smtp.messages.map((m) => m.to[0].replace(/^RCPT TO:<|>.*$/gi, '')), ['sapte@exemplu.ro', 'opt@exemplu.ro'])
  } finally { await smtp.close() }
})

test('--confirm fără Telegram / email configurat: sare canalul, fără erori', async () => {
  const { deps, calls } = fakeDeps({ telegramEnabled: false, emailEnabled: false })
  await runFarewell('send', deps)
  assert.equal(calls.telegram.length + calls.enqueued.length, 0)
})

test('--purge: refuză cât timp mai sunt emailuri în coadă; plan fără ștergere; --confirm șterge și uită conversațiile', async () => {
  const busy = fakeDeps({ pendingFarewellEmails: async () => 2 })
  const r0 = await runFarewell('purge', busy.deps)
  assert.match(r0.refused ?? '', /2 emailuri/)
  assert.equal(busy.calls.purged, 0)

  const { deps, calls, sent } = fakeDeps()
  await runFarewell('purge-plan', deps)
  assert.equal(calls.purged, 0)
  sent.add(101)
  const r = await runFarewell('purge', deps)
  assert.equal(calls.purged, 1)
  assert.deepEqual(r.purged, { emailSubscribers: 3, telegramUsers: 4, alerts: 9 })
  assert.equal(sent.size, 0)
})

// --- botul: cu alertele inchise nu creeaza nimic, raspunde politicos ---------------------------------

test('bot închis: /start prod_… și offer_… primesc mesajul de închidere, fără nicio scriere în DB', async () => {
  delete process.env.PRICE_ALERTS_ENABLED
  const pool = (await import('./db.js')).default
  const { processUpdate } = await import('../workers/bot.worker.js')
  const origQuery = pool.query.bind(pool)
  const origFetch = globalThis.fetch
  let queries = 0
  const sentTexts: string[] = []
  ;(pool as unknown as { query: unknown }).query = async () => { queries++; throw new Error('fara DB in modul inchis') }
  globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
    sentTexts.push(JSON.parse(init?.body ?? '{}').text)
    return new Response('{"ok":true}', { status: 200 })
  }) as typeof fetch
  try {
    for (const text of ['/start prod_12_999', '/start offer_5', '/alertele_mele', '800']) {
      await processUpdate({ update_id: 1, message: { text, chat: { id: 555 }, from: { username: 'x', first_name: 'Ana' } } })
    }
    assert.equal(queries, 0)
    assert.equal(sentTexts.length, 4)
    for (const t of sentTexts) assert.match(t, /Alertele de preț pe superieftin\.ro s-au închis/)
  } finally {
    ;(pool as unknown as { query: unknown }).query = origQuery
    globalThis.fetch = origFetch
    await pool.end()
  }
})
