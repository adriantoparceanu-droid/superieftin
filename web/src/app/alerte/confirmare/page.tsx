import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/LegalPage'

// Linkul de confirmare din emailurile vechi. Alertele de pret s-au inchis pe 20 nov. 2026: nu mai
// confirmam nimic (alerta ramasa neconfirmata se sterge odata cu celelalte date).

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Alertele de preț s-au închis',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

export default function ConfirmarePage() {
  return (
    <LegalPage title="Alertele de preț s-au închis">
      <p>
        Nu mai pornim alerte de preț: superieftin.ro e acum un blog de recomandări, cu articole despre
        ce merită cumpărat. Cererea ta nu a fost confirmată și nu primești alerte.
      </p>
      <p>
        Datele cererilor de alertă (adresa de email și alertele) se șterg automat. Nu trebuie să faci
        nimic. Detalii în <Link href="/confidentialitate">Politica de confidențialitate</Link>.
      </p>
      <p><Link href="/">Înapoi la superieftin.ro</Link></p>
    </LegalPage>
  )
}
