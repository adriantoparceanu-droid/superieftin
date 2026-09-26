// Limitare de rata minimala, in memorie, per cheie (de obicei IP-ul vizitatorului).
//
// De ce asa de simplu: proiectul nu avea un rate limiter, iar endpoint-urile care il folosesc
// (ex. /api/consent/withdraw) sunt apelate rar de un vizitator normal (o data la retragerea
// acordului). Scopul e doar sa nu poata cineva bombarda baza de date cu UPDATE-uri.
// Limite cunoscute (acceptate): contorul e per proces (containerul web), se reseteaza la
// restart/deploy si nu e partajat intre mai multe instante. Daca va fi nevoie de mai mult,
// se muta in Redis (exista deja in infrastructura).

interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
const MAX_KEYS = 10_000   // plafon de memorie: peste el curatam intrarile expirate

// true = cererea e permisa; false = prea multe cereri in fereastra curenta
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
    if (buckets.size > MAX_KEYS) buckets.clear()   // sub atac: mai bine resetam decat sa crestem nelimitat
  }
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  b.count++
  return b.count <= limit
}

// IP-ul clientului in spatele Cloudflare / reverse proxy. Folosit DOAR ca cheie de limitare,
// in memorie — nu se salveaza si nu se logheaza.
export function clientIp(headers: Headers): string {
  return headers.get('cf-connecting-ip')
    ?? headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? headers.get('x-real-ip')
    ?? 'necunoscut'
}
