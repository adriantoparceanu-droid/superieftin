import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/LegalPage'
import { RequestManageLinkForm } from '@/components/EmailAlertForm'
import { alertTokenSecret, verifyAlertToken } from '@/lib/alert-token'
import { alertRearmPct, emailAlertsEnabled, rearmThreshold } from '@/lib/email-alerts'
import { getSubscriber, listSubscriberAlerts } from '@/lib/email-alerts-db'
import { formatPrice } from '@/lib/discount'
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
  prag: 'Scrie pragul în lei, de exemplu 1610.',
  'peste-pret': 'Pragul trebuie să fie sub prețul de acum, altfel alerta ar pleca imediat.',
  alerta: 'Alerta nu mai există.',
}

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('ro-RO', { day: 'numeric', month: 'long', timeZone: 'Europe/Bucharest' }).format(new Date(iso))

const btn = 'text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2'

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
      <p className="text-sm text-muted">Adresa: <strong className="text-[var(--color-text)]">{subscriber.email}</strong></p>
      {mesaj && <p role="status" className="rounded-lg bg-green-50 border border-green-200 text-green-900 px-3 py-2 text-sm">{mesaj}</p>}
      {eroare && <p role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-900 px-3 py-2 text-sm">{eroare}</p>}

      {alerts.length === 0 ? (
        <p>Nu ai nicio alertă activă. Poți seta una de pe pagina oricărui produs.</p>
      ) : (
        <ul className="!list-none !pl-0 space-y-3">
          {alerts.map((a) => (
            <li key={a.id} className="rounded-lg border border-line p-3 sm:p-4">
              <Link href={`/p/${a.productSlug}`} className="font-semibold !no-underline !text-[var(--color-text)] hover:!underline">{a.productName}</Link>
              <p className="text-sm text-muted mt-1">
                Cel mai mic preț acum: {a.bestPrice != null ? formatPrice(a.bestPrice) : 'indisponibil'}
              </p>
              {/* Starea (re-armare): activa = asteapta scaderea; trimisa = asteapta ca pretul sa urce
                  peste prag + marja, apoi anuntam din nou la urmatoarea scadere */}
              <p className="text-sm mt-1">
                {a.armed ? (
                  <span className="text-green-800">● Activă — te anunțăm când prețul ajunge la prag.</span>
                ) : (
                  <span className="text-[var(--color-text)]">
                    ● Trimisă{a.triggerPrice != null ? `: ${formatPrice(a.triggerPrice)}` : ''}
                    {a.triggerRetailer ? ` la ${a.triggerRetailer}` : ''}{a.triggeredAt ? `, pe ${fmtDate(a.triggeredAt)}` : ''}.
                    {' '}Te anunțăm din nou după ce prețul urcă peste {formatPrice(rearmThreshold(a.targetPrice, rearmPct))} și scade iar la prag.
                  </span>
                )}
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <form action={updateTargetAction} className="flex items-end gap-2">
                  <input type="hidden" name="t" value={token} />
                  <input type="hidden" name="alertId" value={a.id} />
                  <label className="text-sm">
                    <span className="block text-xs text-muted">Prag (lei)</span>
                    <input
                      name="target"
                      inputMode="decimal"
                      defaultValue={String(a.targetPrice).replace('.', ',')}
                      className="w-28 border border-line rounded-lg px-2 py-1.5 text-sm tabular-nums"
                      required
                    />
                  </label>
                  <button type="submit" className={`${btn} border border-line hover:border-brand hover:text-brand`}>Salvează</button>
                </form>
                <form action={deleteAlertAction}>
                  <input type="hidden" name="t" value={token} />
                  <input type="hidden" name="alertId" value={a.id} />
                  <button type="submit" className={`${btn} text-muted hover:text-brand`}>Oprește alerta</button>
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
        <button type="submit" className={`${btn} border border-brand text-brand hover:bg-brand-light`}>
          Dezabonează-mă de la toate alertele
        </button>
      </form>
    </LegalPage>
  )
}
