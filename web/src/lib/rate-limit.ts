// Limitare de rata minimala, in memorie, per cheie (de obicei IP-ul vizitatorului).
//
// De ce asa de simplu: proiectul nu avea un rate limiter, iar endpoint-urile care il folosesc
// (ex. /api/consent/withdraw) sunt apelate rar de un vizitator normal (o data la retragerea
// acordului). Scopul e doar sa nu poata cineva bombarda baza de date cu UPDATE-uri.
// Limite cunoscute (acceptate): contorul e per proces (containerul web), se reseteaza la
// restart/deploy si nu e partajat intre mai multe instante. Daca va fi nevoie de mai mult,
// se muta in Redis (exista deja in infrastructura).

import { isIP } from 'node:net'

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

// IP-ul clientului, folosit DOAR ca cheie de limitare, in memorie — nu se salveaza si nu se logheaza.
//
// Drumul unei cereri in productie: vizitator → Cloudflare → Nginx (CloudPanel) → containerul web.
// Containerul asculta doar pe 127.0.0.1:3000 (docker-compose.yml), deci singurul care vorbeste
// direct cu el e Nginx-ul de pe acelasi server.
//
// De ce NU mai citim `x-forwarded-for` de la stanga si nici `x-real-ip` (R5): primul element din
// x-forwarded-for il poate scrie oricine in propria cerere („X-Forwarded-For: 1.2.3.4”), iar
// proxy-urile doar adauga la coada. Cu un IP inventat la fiecare cerere, limita n-ar mai prinde
// nimic. x-real-ip depinde de configurarea Nginx, pe care nu o controlam din cod.
//
// Ordinea aleasa:
//   1. `cf-connecting-ip` — Cloudflare il seteaza el insusi cu IP-ul real si SUPRASCRIE orice
//      valoare trimisa de client. E sursa corecta cat timp traficul trece prin Cloudflare.
//      Limita cunoscuta: cineva care loveste serverul direct (ocolind Cloudflare) poate trimite
//      un cf-connecting-ip fals. Remediul e pe VPS (firewall: portul 443 doar din IP-urile
//      Cloudflare), nu aici — iar miza e mica: endpoint-ul face doar UPDATE-uri pe ID-uri exacte.
//   2. ULTIMUL element din `x-forwarded-for` — il adauga Nginx-ul nostru ($remote_addr, adica
//      adresa de la care a primit efectiv conexiunea TCP); clientul nu-l poate falsifica, doar
//      elementele din fata lui. Fara Cloudflare in fata ar fi IP-ul real; cu Cloudflare ar fi IP-ul
//      nodului Cloudflare — dar atunci exista oricum cf-connecting-ip (pasul 1).
//   3. 'necunoscut' — cheie comuna (ex. `next dev` local, fara proxy). Mai bine o limita comuna,
//      eventual prea stricta, decat o cheie aleasa de client, care ar anula limitarea.
// Orice valoare care nu arata ca o adresa IP e ignorata (antet stricat sau inventat).
export function clientIp(headers: Headers): string {
  const cf = headers.get('cf-connecting-ip')?.trim()
  if (cf && isIP(cf)) return cf
  const lastHop = headers.get('x-forwarded-for')?.split(',').pop()?.trim()
  if (lastHop && isIP(lastHop)) return lastHop
  return 'necunoscut'
}
