import pool from '../lib/db.js'
import pino from 'pino'

const logger = pino({ level: 'info' })
const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const BASE = `https://api.telegram.org/bot${TOKEN}`
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://superieftin.ro'

// Stare conversatie: chat_id → oferta pentru care asteptam pretul
const pendingAlerts = new Map<number, { offerId: number; productName: string; currentPrice: number }>()

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

async function handleStart(chatId: number, param: string | null, username?: string, firstName?: string) {
  await getOrCreateUser(chatId, username, firstName)

  if (param?.startsWith('offer_')) {
    const offerId = parseInt(param.replace('offer_', ''))
    if (isNaN(offerId)) {
      await sendMsg(chatId, 'Link invalid. Încearcă din nou de pe site.')
      return
    }

    const { rows } = await pool.query(
      `SELECT p.name, o.current_price
       FROM offers o
       JOIN products p ON p.id = o.product_id
       WHERE o.id = $1`,
      [offerId]
    )

    if (!rows[0]) {
      await sendMsg(chatId, 'Produsul nu a fost găsit.')
      return
    }

    const { name, current_price } = rows[0]
    pendingAlerts.set(chatId, { offerId, productName: name, currentPrice: parseFloat(current_price) })

    const priceStr = parseFloat(current_price).toLocaleString('ro-RO', { minimumFractionDigits: 2 })
    await sendMsg(chatId,
      `🔔 <b>Alertă de preț</b>\n\n<b>${name}</b>\nPreț actual: <b>${priceStr} RON</b>\n\nLa ce preț vrei să fii anunțat?\nTrimite suma în RON (ex: <code>800</code>):`
    )
  } else {
    const name = firstName ? `, ${firstName}` : ''
    await sendMsg(chatId,
      `👋 Salut${name}!\n\nSunt botul <b>superieftin.ro</b> — te anunț când prețul unui produs scade sub pragul tău.\n\n📌 <b>Cum funcționează:</b>\n1. Mergi pe <a href="${SITE_URL}">${SITE_URL}</a>\n2. Deschide pagina unui produs\n3. Apasă butonul <b>🔔 Alertă de preț</b>\n\n<b>Comenzi:</b>\n/alertele_mele — alertele active\n/sterge &lt;id&gt; — șterge o alertă`
    )
  }
}

async function handleAlerteleMele(chatId: number) {
  const userId = await getOrCreateUser(chatId)
  const { rows } = await pool.query(
    `SELECT pa.id, p.name, pa.target_price, o.current_price
     FROM price_alerts pa
     JOIN offers o ON o.id = pa.offer_id
     JOIN products p ON p.id = o.product_id
     WHERE pa.telegram_user_id = $1 AND pa.is_active = true
     ORDER BY pa.created_at DESC
     LIMIT 10`,
    [userId]
  )

  if (!rows.length) {
    await sendMsg(chatId,
      `📋 Nu ai alerte active.\n\nMergi pe <a href="${SITE_URL}">${SITE_URL}</a> și apasă <b>🔔 Alertă de preț</b> pe un produs.`
    )
    return
  }

  const list = rows.map(r => {
    const target = parseFloat(r.target_price).toLocaleString('ro-RO', { minimumFractionDigits: 2 })
    const current = parseFloat(r.current_price).toLocaleString('ro-RO', { minimumFractionDigits: 2 })
    return `<b>${r.id}.</b> ${r.name}\n   Sub: ${target} RON (acum: ${current} RON)`
  }).join('\n\n')

  await sendMsg(chatId,
    `📋 <b>Alertele tale active:</b>\n\n${list}\n\n/sterge &lt;id&gt; — pentru a șterge o alertă`
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
    await sendMsg(chatId, '✅ Alertă ștearsă.')
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

  const price = parseFloat(text.replace(',', '.'))
  if (isNaN(price) || price <= 0 || price > 100000) {
    await sendMsg(chatId, '❌ Preț invalid. Trimite o sumă în RON, ex: <code>800</code>')
    return
  }

  const userId = await getOrCreateUser(chatId)
  await pool.query(
    `INSERT INTO price_alerts (telegram_user_id, offer_id, target_price)
     VALUES ($1, $2, $3)`,
    [userId, pending.offerId, price]
  )
  pendingAlerts.delete(chatId)

  const formatted = price.toLocaleString('ro-RO', { minimumFractionDigits: 2 })
  await sendMsg(chatId,
    `✅ <b>Alertă salvată!</b>\n\n${pending.productName}\nTe anunțăm când prețul scade sub <b>${formatted} RON</b>.\n\n/alertele_mele — toate alertele tale`
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
  } else if (/^[\d.,]+$/.test(text)) {
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
