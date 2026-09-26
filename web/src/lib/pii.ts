// Mascheaza date personale scrise din greseala in cautare (email, telefon) inainte ca
// termenul sa ajunga in GA4 sau in search_queries. Politica Google interzice trimiterea de
// date personale in Analytics, iar pagina de confidentialitate promite „doar textul cautarii”.
//
// Telefonul: DOAR formatele romanesti (07xx…, +407xx…, 00407xx…), cu separatori optionali.
// Intentionat NU mascam orice sir lung de cifre — oamenii cauta coduri EAN/part number.

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const RO_PHONE = /(?:\+|00)?(?:40[\s.-]?)?0?7\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g

export function maskPII(text: string): string {
  return text.replace(EMAIL, '[email]').replace(RO_PHONE, '[telefon]')
}
