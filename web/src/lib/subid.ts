import { randomBytes } from 'crypto'

// SubID pe linkurile de afiliere: un click_id unic per click, pe care reteaua il intoarce
// pe comision. Asa legam o comanda de clickul care a adus-o (vezi migratia 017_ad_clicks).

export type AffiliateNetwork = 'profitshare' | '2performant'

// 12 caractere [a-z0-9] (~62 biti) — destul de unic, scurt, sigur in URL, fara date personale.
export function generateClickId(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(12)
  let id = ''
  for (const b of bytes) id += alphabet[b % alphabet.length]
  return id
}

// Reteaua dupa host-ul linkului. Coloana offers.affiliate_network e NULL pe multe oferte
// din feed-uri, deci host-ul e sursa sigura.
export function detectNetwork(affiliateUrl: string): AffiliateNetwork | null {
  let host: string
  try {
    host = new URL(affiliateUrl).hostname.toLowerCase()
  } catch {
    return null
  }
  if (host === 'profitshare.ro' || host.endsWith('.profitshare.ro')) return 'profitshare'
  if (host === '2performant.com' || host.endsWith('.2performant.com')) return '2performant'
  return null
}

// Adauga click_id in linkul afiliat, in parametrul fiecarei retele:
//   Profitshare: &hash=<id>  (lps/...?redirect=X&hash=ID → Profitshare il muta in /l/{id}/ID/,
//                             formatul documentat; testat 2026-09-26)
//   2Performant: &st=<id>    (subtag pe quicklink)
// Lipim parametrul la final ca text (fara URLSearchParams), ca sa nu re-encodam valoarea
// `redirect`/`redirect_to` — altfel URL-ul produsului se poate strica.
export function withSubId(affiliateUrl: string, network: AffiliateNetwork | null, clickId: string): string {
  if (!network) return affiliateUrl
  const param = network === 'profitshare' ? 'hash' : 'st'
  const sep = affiliateUrl.includes('?') ? '&' : '?'
  return `${affiliateUrl}${sep}${param}=${clickId}`
}
