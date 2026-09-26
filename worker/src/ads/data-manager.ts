import { accessToken, errorCodes, AdsApiError, type AdsConfig } from './google-ads.js'

// Upload de conversii offline prin Google Data Manager API (datamanager.googleapis.com).
//
// De ce NU Google Ads API (customers:uploadClickConversions): din 15 iunie 2026 serviciul acela
// e rezervat integrarilor care au mai trimis conversii inainte. Testat pe contul nostru pe
// 2026-09-26 (validate_only): raspuns CUSTOMER_NOT_ALLOWLISTED_FOR_THIS_FEATURE — „New
// integrations for uploading click conversions should use the Data Manager API”.
// Retragerile (uploadConversionAdjustments) raman pe Google Ads API — acolo functioneaza.
//
// Acelasi client OAuth si acelasi refresh token, dar tokenul trebuie sa includa si scope-ul
// https://www.googleapis.com/auth/datamanager (npm run ads:auth il cere din Faza 2), iar
// „Data Manager API” trebuie activat in proiectul Google Cloud.

const ENDPOINT = 'https://datamanager.googleapis.com/v1/events:ingest'

export interface ClickIds { gclid?: string | null; gbraid?: string | null; wbraid?: string | null }

export interface ConversionEventInput {
  ids: ClickIds
  value: number                 // RON, comisionul nostru (nu valoarea comenzii)
  eventTimestamp: string        // RFC 3339 cu offset, ex. 2026-09-25T12:00:00+03:00
  transactionId: string         // order_id Profitshare → Google deduplica dupa el
}

// Un singur identificator per eveniment (Google cere exact unul): gclid are prioritate —
// gbraid/wbraid apar doar pe iOS, cand gclid lipseste.
export function pickAdIdentifier(ids: ClickIds): Record<string, string> | null {
  if (ids.gclid) return { gclid: ids.gclid }
  if (ids.gbraid) return { gbraid: ids.gbraid }
  if (ids.wbraid) return { wbraid: ids.wbraid }
  return null
}

// Corpul cererii events:ingest — fara date personale (fara email/telefon/IP): doar
// identificatorul clickului, valoarea, ora si ID-ul comenzii. Consimtamantul e declarat
// explicit: trimitem DOAR clickuri cu acordul „Publicitate” → adUserData GRANTED (masurarea
// conversiei). adPersonalization e MEREU DENIED: bannerul nu cere acord pentru reclame
// personalizate (remarketing), iar pentru masurare nici nu e necesar (GDPR, Poarta 2 — B2).
export function buildIngestBody(cfg: AdsConfig, conversionActionId: string, ev: ConversionEventInput, validateOnly: boolean) {
  const adIdentifiers = pickAdIdentifier(ev.ids)
  if (!adIdentifiers) throw new Error('Conversie fără gclid/gbraid/wbraid — nu se poate trimite')
  return {
    destinations: [{
      operatingAccount: { accountType: 'GOOGLE_ADS', accountId: cfg.customerId },
      ...(cfg.loginCustomerId ? { loginAccount: { accountType: 'GOOGLE_ADS', accountId: cfg.loginCustomerId } } : {}),
      productDestinationId: conversionActionId,
    }],
    consent: { adUserData: 'CONSENT_GRANTED', adPersonalization: 'CONSENT_DENIED' },
    validateOnly,
    events: [{
      adIdentifiers,
      conversionValue: ev.value,
      currency: 'RON',
      eventTimestamp: ev.eventTimestamp,
      transactionId: ev.transactionId,
      eventSource: 'WEB',
    }],
  }
}

// Trimite UN eveniment per cerere: volumul e mic (cateva comenzi pe luna), iar o eroare se
// leaga fara ambiguitate de comanda ei. In ADS_ENV=test pleaca OBLIGATORIU cu validateOnly.
export async function ingestConversion(cfg: AdsConfig, conversionActionId: string, ev: ConversionEventInput, opts: { validateOnly?: boolean } = {}) {
  const validateOnly = cfg.env === 'test' ? true : opts.validateOnly ?? false
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await accessToken(cfg)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildIngestBody(cfg, conversionActionId, ev, validateOnly)),
  })
  const text = await res.text()
  let data: any
  try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text.slice(0, 300) } }
  if (!res.ok) throw new AdsApiError(res.status, errorCodes(data), data?.error?.message ?? `HTTP ${res.status}`, data)
  return { validateOnly, requestId: data.requestId as string | undefined, warnings: (data.fieldWarnings ?? []) as unknown[] }
}
