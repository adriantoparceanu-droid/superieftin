import { NextRequest, NextResponse } from 'next/server'
import { alertTokenSecret, verifyAlertToken } from '@/lib/alert-token'
import { deleteSubscriber } from '@/lib/email-alerts-db'

// Dezabonarea totala dintr-un click.
//
// POST /api/alerte-email/dezabonare?t=<token u>
//   - din headerul List-Unsubscribe (Gmail/Yahoo/Apple Mail trimit singure, fara sa deschida
//     pagina, corpul `List-Unsubscribe=One-Click` — RFC 8058) → 200 text;
//   - din formularul paginii /alerte/dezabonare → 303 spre pagina „Te-ai dezabonat”.
// GET (unii clienti deschid linkul din header in browser) → trimitem la pagina /alerte/dezabonare,
// care NU sterge nimic fara un POST (scanerele de linkuri din emailuri fac GET-uri automate).
//
// Dezabonare = stergere completa: abonatul + toate alertele lui. Raspunsul e acelasi si cand
// abonatul nu (mai) exista.

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t')
  const secret = alertTokenSecret()
  const id = secret ? verifyAlertToken(secret, 'u', token) : null
  if (id != null) await deleteSubscriber(id)

  const fromForm = (req.headers.get('content-type') ?? '').includes('application/x-www-form-urlencoded')
    && !(await req.clone().text()).includes('List-Unsubscribe=One-Click')
  if (fromForm) {
    return seeOther(id != null ? '/alerte/dezabonare?gata=1' : '/alerte/dezabonare?invalid=1')
  }
  return new NextResponse(id != null ? 'Dezabonare efectuată.' : 'Link invalid.', { status: id != null ? 200 : 400, headers: { ...NO_STORE, 'Content-Type': 'text/plain; charset=utf-8' } })
}

export async function GET(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t')
  return seeOther(`/alerte/dezabonare${t ? `?t=${encodeURIComponent(t)}` : ''}`)
}

// Redirect relativ (Location: /cale): in spatele Nginx, req.nextUrl poate avea host-ul intern
// (localhost:3000), iar NEXT_PUBLIC_SITE_URL e alt domeniu local in dezvoltare.
function seeOther(path: string) {
  return new NextResponse(null, { status: 303, headers: { ...NO_STORE, Location: path } })
}
