import pino from 'pino'

// Mesaj Telegram catre proprietar (TELEGRAM_ADMIN_CHAT_ID), prin botul site-ului.
// Folosit de starea magazinelor (retailer-status.ts) si de garda campaniilor (ads/campaigns/guard.ts).
// Fara token/chat configurat → doar avertizare in log (nu opreste jobul).

const logger = pino({ level: 'info' })

export const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Intoarce true daca Telegram a acceptat mesajul.
export async function notifyAdmin(text: string, what = 'avertizarea'): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!token || !chatId) {
    logger.warn(`TELEGRAM_ADMIN_CHAT_ID lipsește — ${what} nu s-a trimis`)
    return false
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    signal: AbortSignal.timeout(15000),
  }).catch((err) => { logger.error({ err }, 'Avertizare Telegram eșuată'); return null })
  if (res && !res.ok) logger.error({ status: res.status }, 'Avertizare Telegram respinsă')
  return !!res?.ok
}
