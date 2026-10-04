import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/LegalPage'
import { INK_BUTTON } from '@/components/article'
import { alertTokenSecret, verifyAlertToken } from '@/lib/alert-token'

// Dezabonarea din linkul aflat in corpul emailurilor. Stergerea se face la apasarea butonului
// (POST spre /api/alerte-email/dezabonare): scanerele de linkuri din emailuri deschid automat
// paginile, iar un GET nu trebuie sa stearga alertele cuiva. Dezabonarea intr-un singur click,
// fara pagina, o fac clientii de email prin headerul List-Unsubscribe (acelasi endpoint).

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Dezabonare de la alertele de preț',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

export default async function DezabonarePage({ searchParams }: Props) {
  const sp = await searchParams
  if (sp.gata) {
    return (
      <LegalPage title="Te-ai dezabonat">
        <p>
          Am șters adresa ta de email și toate alertele de preț asociate. Nu mai primești emailuri
          de la noi.
        </p>
        <p><Link href="/">Înapoi la superieftin.ro</Link></p>
      </LegalPage>
    )
  }

  const token = typeof sp.t === 'string' ? sp.t : ''
  const secret = alertTokenSecret()
  const valid = Boolean(secret && token && verifyAlertToken(secret, 'u', token) != null)
  if (sp.invalid || !valid) {
    return (
      <LegalPage title="Link invalid">
        <p>
          Linkul de dezabonare nu e valid. Folosește linkul din cel mai recent email primit de la noi
          sau scrie-ne din pagina <Link href="/contact">Contact</Link> și te ștergem manual.
        </p>
      </LegalPage>
    )
  }

  return (
    <LegalPage title="Dezabonare de la alertele de preț">
      <p>
        Apasă butonul ca să ștergem adresa ta de email și <strong>toate</strong> alertele de preț
        asociate. Nu mai primești niciun email de la noi.
      </p>
      <form method="post" action={`/api/alerte-email/dezabonare?t=${encodeURIComponent(token)}`}>
        <button
          type="submit"
          className={INK_BUTTON}
        >
          Dezabonează-mă de la toate alertele
        </button>
      </form>
    </LegalPage>
  )
}
