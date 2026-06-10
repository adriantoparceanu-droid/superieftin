import crypto from 'crypto'
import http from 'http'

const API_USER = process.env.PROFITSHARE_API_USER!
const API_KEY = process.env.PROFITSHARE_API_KEY!

function buildQs(params: Record<string, string | number>): string {
  return Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
}

export async function psRequest<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = Object.keys(params).length ? '/?' + buildQs(params) : ''
  const date = new Date().toUTCString().replace('GMT', 'UTC')
  const sigData = 'GET' + path + qs + '/' + API_USER + date
  const sig = crypto.createHmac('sha1', API_KEY).update(sigData).digest('hex')
  const urlQs = Object.keys(params).length ? '/?' + encodeURI(buildQs(params)) : ''

  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: 'api.profitshare.ro',
      path: '/' + path + urlQs,
      headers: { 'Date': date, 'X-PS-Client': API_USER, 'X-PS-Auth': sig, 'X-PS-Accept': 'json' },
    }, (res) => {
      let data = ''
      res.on('data', (d) => (data += d))
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { reject(new Error('Invalid JSON: ' + data.slice(0, 100))) }
      })
    })
    req.on('error', reject)
  })
}

// Construieste URL de afiliere Profitshare pentru un produs eMAG
export function buildAffiliateUrl(productUrl: string, affiliateIdentifier = 'piC', advertiserIdentifier = '9'): string {
  const encoded = encodeURIComponent(productUrl)
  return `https://event.profitshare.ro/click?affiliate_id=${affiliateIdentifier}&advertiser_id=${advertiserIdentifier}&url=${encoded}`
}
