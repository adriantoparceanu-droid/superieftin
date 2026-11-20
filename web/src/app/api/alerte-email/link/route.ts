import { NextResponse } from 'next/server'
import { ALERTS_CLOSED_MESSAGE } from '@/lib/email-alerts'

// POST /api/alerte-email/link → 410 Gone. Alertele s-au inchis (20 nov. 2026): nu mai trimitem
// linkuri „Alertele mele”. Datele abonatilor se sterg; dezabonarea imediata ramane in fiecare email.

const NO_STORE = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }

export async function POST() {
  return NextResponse.json({ error: ALERTS_CLOSED_MESSAGE }, { status: 410, headers: NO_STORE })
}
