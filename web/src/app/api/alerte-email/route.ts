import { NextResponse } from 'next/server'
import { ALERTS_CLOSED_MESSAGE } from '@/lib/email-alerts'

// POST /api/alerte-email → 410 Gone.
//
// Alertele de pret s-au inchis pe 20 nov. 2026 (site-ul devine blog de recomandari): nu mai cream
// alerte si nu mai colectam adrese de email. Formularul de pe /p/ dispare odata cu pagina; un
// formular ramas deschis intr-un tab vechi primeste mesajul de mai jos (EmailAlertForm il afiseaza).
// Dezabonarea (POST /api/alerte-email/dezabonare) ramane functionala pana la stergerea datelor.

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }

export async function POST() {
  return NextResponse.json({ error: ALERTS_CLOSED_MESSAGE }, { status: 410, headers: NO_STORE })
}
