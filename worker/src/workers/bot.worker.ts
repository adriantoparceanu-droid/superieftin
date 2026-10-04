import pool from '../lib/db.js'
import pino from 'pino'
import { escHtml } from '../lib/admin-telegram.js'
import { checkTarget, formatRon, immediateAlertNote, parseAlertStartParam, parseTypedPrice, siteUrl } from '../lib/price-alert.js'
import { PRODUCT_BEST_PRICE_SQL } from '../lib/alert-sql.js'
import { alertRearmPct, rearmThreshold } from '../lib/alert-rearm.js'

const logger = pino({ level: 'info' })
const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BASE = `https://api.telegram.org/bot${TOKEN}`
const SITE_URL = siteUrl()

// Stare conversatie: chat_id → produsul pentru care asteptam pretul. Alerta e pe PRODUS (orice
// magazin); currentPrice = cel mai mic pret disponibil acum (null = produs indisponibil).
const pendingAlerts = new Map<number, { productId: number; productName: string; currentPrice: number | null }>()

async function tgPost(method: string, body: object) {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.json()
}

async function sendMsg(chatId: number, text: string) {
  return tgPost('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true })
}

async function getOrCreateUser(chatId: number, username?: string, firstName?: string) {
  const { rows } = await pool.query(
    `INSERT INTO telegram_users (telegram_chat_id, telegram_username, first_name)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_chat_id) DO UPDATE
       SET telegram_username = EXCLUDED.telegram_username,
           first_name = EXCLUDED.first_name
     RETURNING id`,
    [chatId, username ?? null, firstName ?? null]
  )
  return rows[0].id as number
}

// O singura alerta activa per utilizator + produs: un al doilea click pe buton (sau o suma noua
// trimisa in chat) schimba pragul, nu dubleaza alerta. Pe Telegram alerta e confirmata din start
// (vizitatorul a pornit singur conversatia), deci confirmed_at = acum. Un prag nou = alerta ARMATA
// din nou; daca pragul e la/peste pretul de acum, pleaca la urmatoarea verificare (checkTarget).
async function saveAlert(userId: number, productId: number, target: number) {
  const upd = await pool.query(
    `UPDATE price_alerts SET target_price = $3, triggered_at = NULL, updated_at = now()
     WHERE telegram_user_id = $1 AND product_id = $2 AND is_active = true`,
    [userId, productId, target]
  )
  if (!upd.rowCount) {
    await pool.query(
      `INSERT INTO price_alerts (telegram_user_id, product_id, target_price, confirmed_at) VALUES ($1, $2, $3, now())`,
      [userId, productId, target]
    )
  }
}

async function handleStart(chatId: number, param: string | null, username?: string, firstName?: string) {
  await getOrCreateUser(chatId, username, firstName)

  // Butonul de pe site trimite prod_<id produs>_<prag>; linkurile vechi offer_<id oferta>[_<prag>]
  // se muta pe produsul ofertei (alerta e pe produs, orice magazin). Inainte testam doar prefixul
  // „offer_”, asa ca linkurile noi prod_… primeau mesajul de bun venit in loc de alerta.
  if (param?.startsWith('offer_') || param?.startsWith('prod_')) {
    const parsed = parseAlertStartParam(param)
    if (!parsed) {
      await sendMsg(chatId, 'Link invalid. Încearcă din nou de pe site.')
      return
    }

    const { rows } = await pool.query(
      `SELECT p.id, p.name, ${PRODUCT_BEST_PRICE_SQL} AS best_price
       FROM products p
       WHERE p.id = COALESCE($1::bigint, (SELECT product_id FROM offers WHERE id = $2::bigint))`,
      [parsed.productId, parsed.offerId]
    )

    if (!rows[0]) {
      await sendMsg(chatId, 'Produsul nu a fost găsit.')
      return
    }

    const name = rows[0].name as string
    const productId = Number(rows[0].id)
    const currentPrice = rows[0].best_price != null ? Number(rows[0].best_price) : null
    pendingAlerts.set(chatId, { productId, productName: name, currentPrice })
    const priceLine = currentPrice != null
      ? `Cel mai mic preț acum: <b>${formatRon(currentPrice)} RON</b>\n`
      : 'Momentan indisponibil la magazinele monitorizate.\n'

    // Prag ales pe site si valid → salvam direct: vizitatorul l-a vazut pe pagina si a apasat
    // butonul, iar /start l-a trimis chiar el. Poate trimite alta suma. Daca pragul e la/peste
    // pretul de acum ('immediate'), il salvam oricum si spunem ca alerta pleaca imediat.
    const startCheck = parsed.target != null ? checkTarget(parsed.target, currentPrice) : 'invalid'
    if (parsed.target != null && startCheck !== 'invalid') {
      const userId = await getOrCreateUser(chatId, username, firstName)
      await saveAlert(userId, productId, parsed.target)
      const note = startCheck === 'immediate' && currentPrice != null ? `\n${immediateAlertNote(currentPrice)}\n` : ''
      await sendMsg(chatId,
        `✅ <b>Alertă salvată</b>\n\n<b>${escHtml(name)}</b>\n${priceLine}${note}Te anunțăm când prețul, la oricare dintre magazinele monitorizate, ajunge la <b>${formatRon(parsed.target)} RON</b> sau mai puțin — și din nou la fiecare scădere nouă sub prag (cel mult un mesaj pe zi).\n\nVrei alt prag? Trimite suma în RON (ex: <code>${Math.floor(parsed.target * 0.95)}</code>).\n/alertele_mele — toate alertele tale · /sterge &lt;id&gt; — oprește o alertă`
      )
      return
    }

    await sendMsg(chatId,
      `🔔 <b>Alertă de preț</b>\n\n<b>${escHtml(name)}</b>\n${priceLine}\nLa ce preț vrei să fii anunțat?\nTrimite suma în RON (ex: <code>${currentPrice != null ? Math.floor(currentPrice * 0.95) : 800}</code>):`
    )
  } else {
    const name = firstName ? `, ${firstName}` : ''
    await sendMsg(chatId,
      `👋 Salut${name}!\n\nSunt botul <b>superieftin.ro</b> — te anunț când prețul unui produs scade sub pragul tău.\n\n📌 <b>Cum funcționează:</b>\n1. Mergi pe <a href="${SITE_URL}">${SITE_URL}</a>\n2. Deschide pagina unui produs\n3. Apasă butonul <b>🔔 Anunță-mă când scade prețul</b>\n\n<b>Comenzi:</b>\n/alertele_mele — alertele active\n/sterge &lt;id&gt; — șterge o alertă`
    )
  }
}

async function handleAlerteleMele(chatId: number) {
  const userId = await getOrCreateUser(chatId)
  const { rows } = await pool.query(
    `SELECT pa.id, p.name, pa.target_price, ${PRODUCT_BEST_PRICE_SQL} AS current_price,
            pa.triggered_at IS NULL AS armed, pa.trigger_price::float AS trigger_price
     FROM price_alerts pa
     JOIN products p ON p.id = pa.product_id
     WHERE pa.telegram_user_id = $1 AND pa.is_active = true
     ORDER BY pa.created_at DESC
     LIMIT 10`,
    [userId]
  )

  if (!rows.length) {
    await sendMsg(chatId,
      `📋 Nu ai alerte active.\n\nMergi pe <a href="${SITE_URL}">${SITE_URL}</a> și apasă <b>🔔 Anunță-mă când scade prețul</b> pe un produs.`
    )
    return
  }

  const list = rows.map(r => {
    const target = parseFloat(r.target_price).toLocaleString('ro-RO', { minimumFractionDigits: 2 })
    const current = r.current_price != null ? `${formatRon(Number(r.current_price))} RON` : 'indisponibil'
    // Starea (re-armare, lib/alert-rearm.ts): activa = asteapta scaderea; trimisa = asteapta ca
    // pretul sa urce peste prag + marja, apoi te anuntam la urmatoarea scadere
    const state = r.armed
      ? '🟢 activă — te anunțăm când ajunge la prag'
      : `🔔 trimisă${r.trigger_price != null ? ` (la ${formatRon(Number(r.trigger_price))} RON)` : ''} — te anunțăm din nou după ce prețul urcă peste ${formatRon(rearmThreshold(Number(r.target_price), alertRearmPct()))} RON și scade iar la prag`
    return `<b>${r.id}.</b> ${escHtml(r.name)}\n   Prag: ${target} RON (cel mai mic preț acum: ${current})\n   ${state}`
  }).join('\n\n')

  await sendMsg(chatId,
    `📋 <b>Alertele tale:</b>\n\n${list}\n\n/sterge &lt;id&gt; — oprește (șterge) o alertă`
  )
}

async function handleSterge(chatId: number, alertId: number) {
  const userId = await getOrCreateUser(chatId)
  const { rowCount } = await pool.query(
    `UPDATE price_alerts SET is_active = false
     WHERE id = $1 AND telegram_user_id = $2 AND is_active = true`,
    [alertId, userId]
  )

  if (!rowCount) {
    await sendMsg(chatId, '❌ Alerta nu a fost găsită sau a fost deja ștearsă.')
  } else {
    await sendMsg(chatId, '✅ Alertă oprită. Nu te mai anunțăm pentru acest produs.')
  }
}

async function handlePrice(chatId: number, text: string) {
  const pending = pendingAlerts.get(chatId)
  if (!pending) {
    await sendMsg(chatId,
      `Nu am înțeles comanda.\n\nFolosește /alertele_mele sau mergi pe <a href="${SITE_URL}">${SITE_URL}</a>.`
    )
    return
  }

  const price = parseTypedPrice(text)
  const check = checkTarget(price, pending.currentPrice)
  if (check === 'invalid') {
    await sendMsg(chatId, '❌ Preț invalid. Trimite o sumă în RON, ex: <code>800</code>')
    return
  }
  // Pragul la/peste pretul de azi e acceptat (decizia proprietarului, 5 oct. 2026): il salvam
  // si spunem clar ca alerta pleaca la urmatoarea verificare
  const note = check === 'immediate' && pending.currentPrice != null ? `\n${immediateAlertNote(pending.currentPrice)}` : ''

  const userId = await getOrCreateUser(chatId)
  await saveAlert(userId, pending.productId, price)
  pendingAlerts.delete(chatId)

  await sendMsg(chatId,
    `✅ <b>Alertă salvată!</b>\n\n${escHtml(pending.productName)}\nTe anunțăm când prețul, la oricare dintre magazinele monitorizate, ajunge la <b>${formatRon(price)} RON</b> sau mai puțin.${note}\n\n/alertele_mele — toate alertele tale`
  )
}

async function processUpdate(update: Record<string, unknown>) {
  const msg = update.message as Record<string, unknown> | undefined
  if (!msg?.text) return

  const chatId = (msg.chat as Record<string, unknown>).id as number
  const text = (msg.text as string).trim()
  const from = msg.from as Record<string, unknown> | undefined
  const username = from?.username as string | undefined
  const firstName = from?.first_name as string | undefined

  if (text.startsWith('/start')) {
    const param = text.split(' ')[1] ?? null
    await handleStart(chatId, param, username, firstName)
  } else if (text === '/alertele_mele') {
    await handleAlerteleMele(chatId)
  } else if (text.startsWith('/sterge')) {
    const parts = text.split(' ')
    const id = parseInt(parts[1])
    if (!parts[1] || isNaN(id)) {
      await sendMsg(chatId, 'Folosire: /sterge &lt;id&gt;\nExemplu: /sterge 3\n\n/alertele_mele — vezi ID-urile alertelor')
    } else {
      await handleSterge(chatId, id)
    }
  } else if (/^[\d.,\s]+$/.test(text)) {
    await handlePrice(chatId, text)
  } else {
    await sendMsg(chatId,
      `Comenzi disponibile:\n/alertele_mele — alertele active\n/sterge &lt;id&gt; — șterge o alertă\n\n<a href="${SITE_URL}">${SITE_URL}</a>`
    )
  }
}

export async function startBotWorker() {
  if (!TOKEN) {
    logger.warn('TELEGRAM_BOT_TOKEN lipseste — bot-ul Telegram nu porneste')
    return
  }

  logger.info('Bot Telegram pornit (long polling)')
  let offset = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await fetch(`${BASE}/getUpdates?offset=${offset}&timeout=30`)
      const data = await res.json() as { ok: boolean; result: Record<string, unknown>[] }

      if (!data.ok) {
        logger.error({ data }, 'Telegram getUpdates error')
        await new Promise(r => setTimeout(r, 5000))
        continue
      }

      for (const update of data.result) {
        offset = (update.update_id as number) + 1
        try {
          await processUpdate(update)
        } catch (err) {
          logger.error({ err, update_id: update.update_id }, 'Eroare procesare update Telegram')
        }
      }
    } catch (err) {
      logger.error({ err }, 'Eroare getUpdates — retry in 5s')
      await new Promise(r => setTimeout(r, 5000))
    }
  }
}
