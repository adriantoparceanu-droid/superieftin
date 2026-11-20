import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/LegalPage'
import { OUTLINE_BUTTON } from '@/components/article'
import { alertTokenSecret, verifyAlertToken } from '@/lib/alert-token'
import { getSubscriber } from '@/lib/email-alerts-db'
import { unsubscribeAllAction } from '../actions'

// „Alertele mele” — linkul din emailurile vechi. Alertele de pret s-au inchis pe 20 nov. 2026:
// pagina spune doar asta si ca datele se sterg. Cine nu vrea sa astepte isi poate sterge datele
// imediat (aceeasi stergere ca la dezabonare: adresa + toate alertele).

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Alertele de preț s-au închis',
  robots: { index: false, follow: false },
  // Tokenul e in URL: nu-l trimitem mai departe in headerul Referer
  referrer: 'no-referrer',
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function GestionarePage({ searchParams }: Props) {
  const sp = await searchParams
  const token = typeof sp.t === 'string' ? sp.t : ''
  const secret = alertTokenSecret()
  const subscriberId = secret && token ? verifyAlertToken(secret, 'm', token) : null
  const subscriber = subscriberId != null ? await getSubscriber(subscriberId) : null

  return (
    <LegalPage title="Alertele de preț s-au închis">
      <p>
        Nu mai trimitem alerte de preț și nu mai putem crea alerte noi: superieftin.ro e acum un blog
        de recomandări, cu articole despre ce merită cumpărat.
      </p>
      <p>
        Adresele de email și alertele salvate se șterg automat. Nu trebuie să faci nimic. Detalii în{' '}
        <Link href="/confidentialitate">Politica de confidențialitate</Link>.
      </p>
      {subscriber && (
        <>
          <p className="text-sm">
            Nu vrei să aștepți? Ștergem acum adresa <strong>{subscriber.email}</strong> și toate
            alertele ei.
          </p>
          <form action={unsubscribeAllAction}>
            <input type="hidden" name="t" value={token} />
            <button type="submit" className={`${OUTLINE_BUTTON} !text-red-ink`}>
              Șterge-mi datele acum
            </button>
          </form>
        </>
      )}
      <p><Link href="/">Înapoi la superieftin.ro</Link></p>
    </LegalPage>
  )
}
