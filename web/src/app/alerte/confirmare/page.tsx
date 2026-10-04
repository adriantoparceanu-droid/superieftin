import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/LegalPage'
import { INK_BUTTON } from '@/components/article'
import { alertTokenSecret, verifyAlertToken } from '@/lib/alert-token'
import { getEmailAlert } from '@/lib/email-alerts-db'
import { formatPrice } from '@/lib/discount'
import { confirmAlertAction } from '../actions'

// Pagina deschisa din emailul de confirmare. Confirmarea se face DOAR la apasarea butonului (POST):
// programele care scaneaza linkurile din emailuri deschid pagina automat, iar un GET nu trebuie
// sa porneasca alerta in numele cuiva (double opt-in real).

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Confirmă alerta de preț',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function ConfirmarePage({ searchParams }: Props) {
  const sp = await searchParams
  const token = typeof sp.t === 'string' ? sp.t : ''
  const secret = alertTokenSecret()
  const alertId = secret && token ? verifyAlertToken(secret, 'c', token) : null
  const alert = alertId != null ? await getEmailAlert(alertId) : null

  if (sp.invalid || !alert || !alert.active) {
    return (
      <LegalPage title="Linkul nu mai e valabil">
        <p>
          Linkul de confirmare a expirat (e valabil 3 zile) sau alerta a fost ștearsă. Poți cere o
          alertă nouă de pe pagina produsului.
        </p>
        <p><Link href="/">Înapoi la superieftin.ro</Link></p>
      </LegalPage>
    )
  }

  if (alert.confirmed) {
    return (
      <LegalPage title="Alerta e deja activă">
        <p>
          Alerta pentru <strong>{alert.productName}</strong> e confirmată. Linkul către toate
          alertele tale e în fiecare email de la noi.
        </p>
        <p><Link href={`/p/${alert.productSlug}`}>Vezi produsul</Link></p>
      </LegalPage>
    )
  }

  return (
    <LegalPage title="Confirmă alerta de preț">
      <p>
        Te anunțăm pe email când prețul pentru <strong>{alert.productName}</strong>, la oricare
        dintre magazinele monitorizate, ajunge la <strong>{formatPrice(alert.targetPrice)}</strong> sau
        mai puțin.
      </p>
      <form action={confirmAlertAction}>
        <input type="hidden" name="t" value={token} />
        <button
          type="submit"
          className={INK_BUTTON}
        >
          Confirmă alerta
        </button>
      </form>
      <p className="text-sm text-ink-3">
        Primești cel mult un email de alerte pe zi, cu toate produsele care au ajuns la prag. După
        anunț, alerta rămâne activă: te anunțăm din nou la fiecare scădere nouă sub prag, până o
        oprești. Te poți dezabona oricând, dintr-un link aflat în fiecare email. Detalii în{' '}
        <Link href="/confidentialitate">Politica de confidențialitate</Link>.
      </p>
    </LegalPage>
  )
}
