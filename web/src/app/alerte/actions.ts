'use server'

// Actiunea ramasa din paginile alertelor pe email (alertele s-au inchis pe 20 nov. 2026): stergerea
// imediata a datelor din /alerte/gestionare. Nu exista cont: dreptul vine DOAR din linkul semnat
// (token) primit pe email, verificat din nou aici (o actiune Next se poate apela direct, fara pagina).

import { redirect } from 'next/navigation'
import { alertTokenSecret, verifyAlertToken } from '@/lib/alert-token'
import { deleteSubscriber } from '@/lib/email-alerts-db'

// Stergere totala = adresa si toate alertele (ON DELETE CASCADE)
export async function unsubscribeAllAction(formData: FormData) {
  const secret = alertTokenSecret()
  const id = secret ? verifyAlertToken(secret, 'm', String(formData.get('t') ?? '')) : null
  if (id == null) redirect('/alerte/gestionare?invalid=1')
  await deleteSubscriber(id)
  redirect('/alerte/dezabonare?gata=1')
}
