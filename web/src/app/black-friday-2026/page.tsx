import type { Metadata } from 'next'
import { EventTrackerPage, eventMetadata } from '@/components/event/EventTrackerPage'

// Trackerul Black Friday 2026 (migrația 036, design: docs/plans/2026-10-21-observator-repozitionare-design.md §2).
// URL permanent: după eveniment pagina rămâne arhivă; anul viitor `/black-friday-2027` = un rând
// nou în price_events + o copie a acestui fișier.
//
// De ce force-dynamic și nu ISR la nivel de pagină: la `next build` (imaginea Docker) baza de date
// nu e accesibilă, iar o pagină statică s-ar fi prerandat fără date și ar fi fost servită goală până la
// prima regenerare. Cache-ul de o oră stă pe date (unstable_cache, 3600 s, în
// lib/event-tracker-queries.ts) — același efect ca ISR 3600 s, fără pagina goală după deploy.
export const dynamic = 'force-dynamic'

const SLUG = 'black-friday-2026'

export function generateMetadata(): Promise<Metadata> {
  return eventMetadata(SLUG)
}

export default function BlackFriday2026() {
  return <EventTrackerPage slug={SLUG} />
}
