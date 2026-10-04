import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/LegalPage'
import { RequestManageLinkForm } from '@/components/EmailAlertForm'
import { alertTokenSecret, verifyAlertToken } from '@/lib/alert-token'
import { alertRearmPct, emailAlertsEnabled, rearmThreshold } from '@/lib/email-alerts'
import { getSubscriber, listSubscriberAlerts } from '@/lib/email-alerts-db'
import { formatPrice } from '@/lib/discount'
import { formatLeiInput, MAX_TARGET_PRICE } from '@/lib/alert-threshold'
import { OUTLINE_BUTTON } from '@/components/article'
import { ThresholdForm } from './ThresholdForm'
import { deleteAlertAction, unsubscribeAllAction, updateTargetAction } from '../actions'

// „Alertele mele” — fara cont: accesul vine din linkul semnat din emailuri (valabil 60 de zile).
// Lista alertelor, schimbarea pragului, stergerea unei alerte, dezabonarea totala.

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Alertele mele de preț',
  robots: { index: false, follow: false },
  // Tokenul e in URL: nu-l trimitem mai departe in headerul Referer
  referrer: 'no-referrer',
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const MESAJE: Record<string, string> = {
  confirmata: 'Alerta e confirmată și activă.',
  prag: 'Pragul a fost salvat.',
  stearsa: 'Alerta a fost oprită și ștearsă.',
}
const ERORI: Record<string, string> = {
  // Același format ca mesajele câmpului (lib/alert-threshold.ts): orice sumă între 1 și plafon
  prag: `Scrie o sumă în lei (între 1 și ${formatLeiInput(MAX_TARGET_PRICE)}), de exemplu 1.610.`,
  alerta: 'Alerta nu mai există.',
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', timeZone: 'Europe/Bucharest' }).format(new Date(iso))

export default async function GestionarePage({ searchParams }: Props) {
  const sp = await searchParams
  const token = typeof sp.t === 'string' ? sp.t : ''
  const secret = alertTokenSecret()
  const subscriberId = secret && token ? verifyAlertToken(secret, 'm', token) : null
  const subscriber = subscriberId != null ? await getSubscriber(subscriberId) : null

  if (!subscriber) {
    return (
      <LegalPage title="Alertele mele de preț">
        <p>
          Linkul a expirat (e valabil 60 de zile) sau nu mai există alerte pentru această adresă.
          Folosește linkul din cel mai recent email primit de la noi sau cere unul nou.
        </p>
        {emailAlertsEnabled() && <RequestManageLinkForm />}
      </LegalPage>
    )
  }

  const alerts = await listSubscriberAlerts(subscriber.id)
  const rearmPct = alertRearmPct()
  const mesaj = typeof sp.mesaj === 'string' ? MESAJE[sp.mesaj] : undefined
  const eroare = typeof sp.eroare === 'string' ? ERORI[sp.eroare] : undefined

  return (
    <LegalPage title="Alertele mele de preț">
      <p className="text-sm text-ink-3">Adresa: <strong className="text-ink">{subscriber.email}</strong></p>
      {mesaj && <p role="status" className="rounded-xl border border-success-ink/30 bg-success-tint px-3.5 py-2.5 text-sm font-semibold text-success-ink">{mesaj}</p>}
      {eroare && <p role="alert" className="rounded-xl border border-red-ink/30 bg-red-tint px-3.5 py-2.5 text-sm font-semibold text-red-ink">{eroare}</p>}

      {alerts.length === 0 ? (
        <p>Nu ai nicio alertă activă. Poți seta una de pe pagina oricărui produs.</p>
      ) : (
        <ul className="!list-none !space-y-3 !pl-0">
          {alerts.map((a) => (
            <li key={a.id} className="!pl-0 rounded-2xl border border-line bg-surface p-3.5 text-[15px] sm:p-4">
              <Link href={`/p/${a.productSlug}`} className="font-display text-[17px] font-extrabold leading-snug !text-ink !no-underline hover:!text-red-ink">{a.productName}</Link>
              <p className="mt-1 text-sm text-ink-3">
                Cel mai mic preț acum:{' '}
                {a.bestPrice != null ? <strong className="font-display font-extrabold tabular-nums">{formatPrice(a.bestPrice)}</strong> : 'indisponibil'}
              </p>
              {/* Starea (re-armare): activa = asteapta scaderea; trimisa = asteapta ca pretul sa urce
                  peste prag + marja, apoi anuntam din nou la urmatoarea scadere */}
              <p className="mt-1.5 text-sm">
                {a.armed ? (
                  <span className="inline-flex items-start gap-1.5 text-success-ink">
                    <i aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-current" />
                    <span>Activă — te anunțăm când prețul ajunge la prag.</span>
                  </span>
                ) : (
                  <span className="inline-flex items-start gap-1.5 text-ink-2">
                    <i aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-ink-3" />
                    <span>
                      Trimisă{a.triggerPrice != null ? `: ${formatPrice(a.triggerPrice)}` : ''}
                      {a.triggerRetailer ? ` la ${a.triggerRetailer}` : ''}{a.triggeredAt ? `, pe ${fmtDate(a.triggeredAt)}` : ''}.
                      {' '}Te anunțăm din nou după ce prețul urcă peste {formatPrice(rearmThreshold(a.targetPrice, rearmPct))} și scade iar la prag.
                    </span>
                  </span>
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-t border-line pt-3">
                <ThresholdForm action={updateTargetAction} token={token} alertId={a.id} target={a.targetPrice} today={a.bestPrice} />
                <form action={deleteAlertAction}>
                  <input type="hidden" name="t" value={token} />
                  <input type="hidden" name="alertId" value={a.id} />
                  <button type="submit" className="min-h-10 rounded-[10px] px-2 text-[14px] font-semibold text-ink-3 underline-offset-2 hover:text-red-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink">
                    Oprește alerta
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2>Dezabonare</h2>
      <p className="text-sm">
        Ștergem adresa ta de email și toate alertele. Nu mai primești niciun email de la noi.
      </p>
      <form action={unsubscribeAllAction}>
        <input type="hidden" name="t" value={token} />
        <button type="submit" className={`${OUTLINE_BUTTON} !text-red-ink`}>
          Dezabonează-mă de la toate alertele
        </button>
      </form>
    </LegalPage>
  )
}
