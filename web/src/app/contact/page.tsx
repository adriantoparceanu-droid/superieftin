import type { Metadata } from 'next'
import { LegalPage, Todo } from '@/components/LegalPage'
import { COMPANY } from '@/lib/company'

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Datele de contact și de identificare ale operatorului superieftin.ro.',
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return (
    <LegalPage title="Contact">
      <p>Pentru întrebări, sesizări despre prețuri sau colaborări, ne poți scrie oricând.</p>

      <table>
        <tbody>
          <tr><th scope="row">Email</th><td>{COMPANY.email
            ? <a href={`mailto:${COMPANY.email}`}>{COMPANY.email}</a>
            : <Todo>email</Todo>}</td></tr>
          <tr><th scope="row">Firmă</th><td>{COMPANY.name ?? <Todo>denumire firmă</Todo>}</td></tr>
          <tr><th scope="row">CUI</th><td>{COMPANY.cui ?? <Todo>CUI</Todo>}</td></tr>
          <tr><th scope="row">Nr. Reg. Com.</th><td>{COMPANY.regCom ?? <Todo>nr. Registrul Comerțului</Todo>}</td></tr>
          <tr><th scope="row">Sediu</th><td>{COMPANY.address ?? <Todo>adresa sediului</Todo>}</td></tr>
        </tbody>
      </table>

      <p className="text-muted text-sm">
        superieftin.ro nu vinde produse. Pentru comenzi, livrări sau retururi contactează
        magazinul de la care ai cumpărat.
      </p>
    </LegalPage>
  )
}
