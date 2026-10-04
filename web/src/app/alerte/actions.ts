'use server'

// Actiunile din paginile alertelor pe email (/alerte/confirmare, /alerte/gestionare).
// Nu exista cont: dreptul de a modifica vine DOAR din linkul semnat (token) primit pe email,
// verificat din nou la fiecare actiune (o actiune Next se poate apela direct, fara pagina).

import { redirect } from 'next/navigation'
import { alertTokenSecret, signAlertToken, verifyAlertToken } from '@/lib/alert-token'
import { parseTargetPrice } from '@/lib/email-alerts'
import {
  confirmEmailAlert, deleteSubscriber, deleteSubscriberAlert, getAlertProduct,
  getAlertProductIdForSubscriber, updateAlertTarget,
} from '@/lib/email-alerts-db'

function subscriberFrom(formData: FormData): { id: number; token: string } | null {
  const secret = alertTokenSecret()
  const token = String(formData.get('t') ?? '')
  const id = secret ? verifyAlertToken(secret, 'm', token) : null
  return id != null ? { id, token } : null
}

const manageUrl = (token: string, extra: string) => `/alerte/gestionare?t=${encodeURIComponent(token)}&${extra}`

export async function confirmAlertAction(formData: FormData) {
  const secret = alertTokenSecret()
  const alertId = secret ? verifyAlertToken(secret, 'c', String(formData.get('t') ?? '')) : null
  if (alertId == null || !secret) redirect('/alerte/confirmare?invalid=1')
  const subscriberId = await confirmEmailAlert(alertId)
  if (subscriberId == null) redirect('/alerte/confirmare?invalid=1')
  redirect(manageUrl(signAlertToken(secret, 'm', subscriberId), 'mesaj=confirmata'))
}

export async function updateTargetAction(formData: FormData) {
  const sub = subscriberFrom(formData)
  if (!sub) redirect('/alerte/gestionare?invalid=1')
  const alertId = Number(formData.get('alertId'))
  const target = parseTargetPrice(formData.get('target'))
  if (!Number.isSafeInteger(alertId) || target == null) redirect(manageUrl(sub.token, 'eroare=prag'))
  const productId = await getAlertProductIdForSubscriber(sub.id, alertId)
  const product = productId != null ? await getAlertProduct(productId) : null
  if (!product) redirect(manageUrl(sub.token, 'eroare=alerta'))
  // Orice prag pozitiv e acceptat (si peste pretul de azi — alerta pleaca la urmatoarea verificare)
  const ok = await updateAlertTarget(sub.id, alertId, target)
  redirect(manageUrl(sub.token, ok ? 'mesaj=prag' : 'eroare=alerta'))
}

export async function deleteAlertAction(formData: FormData) {
  const sub = subscriberFrom(formData)
  if (!sub) redirect('/alerte/gestionare?invalid=1')
  const alertId = Number(formData.get('alertId'))
  if (Number.isSafeInteger(alertId)) await deleteSubscriberAlert(sub.id, alertId)
  redirect(manageUrl(sub.token, 'mesaj=stearsa'))
}

// Dezabonare totala = stergem adresa si toate alertele (ON DELETE CASCADE)
export async function unsubscribeAllAction(formData: FormData) {
  const sub = subscriberFrom(formData)
  if (!sub) redirect('/alerte/gestionare?invalid=1')
  await deleteSubscriber(sub.id)
  redirect('/alerte/dezabonare?gata=1')
}
