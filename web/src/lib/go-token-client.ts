// Partea din browser a tokenului /go/ (vezi lib/go-token.ts pentru de ce exista).
//
// Tokenul se cere de la POST /api/go-token cand vizitatorul se pregateste sa dea click (mouse
// peste buton, atingere pe ecran, focus din tastatura) si se lipeste pe link: /go/123?t=<token>.
// Cand apasa efectiv, linkul are deja tokenul → redirect direct spre magazin. Daca tokenul n-a
// apucat sa vina (conexiune lenta), linkul simplu duce pe pagina intermediara, care il obtine
// singura si continua — clickul nu se pierde.
//
// Tokenurile stau DOAR in memoria paginii (nimic in cookie/localStorage) si se reutilizeaza
// pentru aceeasi oferta cat mai au cel putin un minut de valabilitate.

interface Cached { token: string; expiresAt: number }

const cache = new Map<string, Cached>()
const pending = new Map<string, Promise<Cached | null>>()
const MIN_REMAINING_MS = 60_000

export function goHref(offerId: string, token?: string | null): string {
  return token ? `/go/${offerId}?t=${encodeURIComponent(token)}` : `/go/${offerId}`
}

// Tokenul valabil din memorie, fara cerere noua (pentru click — trebuie sa fie sincron)
export function cachedGoToken(offerId: string, now = Date.now()): string | null {
  const c = cache.get(offerId)
  return c && c.expiresAt - now > MIN_REMAINING_MS ? c.token : null
}

export function fetchGoToken(offerId: string): Promise<Cached | null> {
  const cached = cachedGoToken(offerId)
  if (cached) return Promise.resolve(cache.get(offerId)!)
  const inFlight = pending.get(offerId)
  if (inFlight) return inFlight
  const p = fetch('/api/go-token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ offerId: Number(offerId) }),
    credentials: 'same-origin',
    cache: 'no-store',
  })
    .then(r => (r.ok ? r.json() : null))
    .then((d: Cached | null) => {
      if (d && typeof d.token === 'string' && typeof d.expiresAt === 'number') {
        cache.set(offerId, d)
        return d
      }
      return null
    })
    // Eroare de retea / limita atinsa: ramane linkul simplu (pagina intermediara se descurca)
    .catch(() => null)
    .finally(() => pending.delete(offerId))
  pending.set(offerId, p)
  return p
}
