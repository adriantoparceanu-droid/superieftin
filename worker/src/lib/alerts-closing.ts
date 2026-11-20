// Inchiderea alertelor de pret (20 nov. 2026: site-ul devine blog de recomandari).
//
// AICI stau, intr-un singur loc, TEXTELE de ramas-bun (Telegram + email) si raspunsul botului dupa
// inchidere — ca proprietarul sa le aprobe dintr-o privire. `npm run alerte:ramas-bun` (modul PLAN)
// le afiseaza exact cum pleaca. Regula 9: fara promisiuni, fara reduceri; spunem doar ce se intampla.
//
// Comutatorul PRICE_ALERTS_ENABLED (implicit OPRIT): cu el oprit, nu se mai verifica si nu se mai
// trimit alerte (Telegram + digestul pe email), botul nu mai creeaza alerte, iar curatenia GDPR
// existenta (abonari neconfirmate, alerte vechi) ruleaza in continuare cat timp mai exista date.

type Env = Partial<Record<string, string>>

export function priceAlertsEnabled(env: Env = process.env): boolean {
  return env.PRICE_ALERTS_ENABLED?.trim() === '1'
}

// In cate zile stergem datele dupa mesajul de ramas-bun (npm run alerte:ramas-bun -- --purge --confirm)
export const FAREWELL_DELETE_DAYS = 7

export type FarewellMedium = 'telegram' | 'email'

// Linkul spre homepage din mesaje: utm ca sa vedem in GA4 cine revine din ramas-bun
export function farewellHomeUrl(site: string, medium: FarewellMedium): string {
  const qs = new URLSearchParams({ utm_source: 'alerta', utm_medium: medium, utm_campaign: 'inchidere_alerte' })
  return `${site.replace(/\/+$/, '')}/?${qs}`
}

const escHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------- 1. Mesajul de ramas-bun pe Telegram (UN mesaj per conversatie) ----------
// parse_mode HTML (ca restul mesajelor botului)
export function farewellTelegramText(site: string): string {
  const url = farewellHomeUrl(site, 'telegram')
  return [
    '<b>Închidem alertele de preț pe superieftin.ro</b>',
    '',
    'De azi nu mai trimitem alerte de preț și nu mai putem crea alerte noi. superieftin.ro devine un blog de recomandări: articole despre ce merită cumpărat, cu prețul găsit azi la magazinele partenere.',
    '',
    `Alertele tale și datele tale din acest bot (ID-ul conversației, numele de utilizator și prenumele) se șterg în ${FAREWELL_DELETE_DAYS} zile. Nu trebuie să faci nimic.`,
    '',
    `Mulțumim că ai folosit alertele! Ne găsești în continuare pe <a href="${escHtml(url)}">superieftin.ro</a>.`,
  ].join('\n')
}

// ---------- 2. Emailul de ramas-bun (UN email per abonat confirmat) ----------
// Sablonul HTML (stiluri inline) e in lib/email/templates.ts → renderFarewellEmail; textele sunt aici.
export const FAREWELL_EMAIL = {
  subject: 'Închidem alertele de preț pe superieftin.ro',
  preheader: `Nu mai trimitem alerte de preț. Datele tale se șterg în ${FAREWELL_DELETE_DAYS} zile.`,
  paragraphs: [
    'Bună,',
    'Îți scriem pentru că ai alerte de preț pe superieftin.ro cu această adresă de email.',
    'Închidem alertele de preț: de azi nu mai trimitem emailuri cu alerte și nu mai putem crea alerte noi. superieftin.ro devine un blog de recomandări: articole despre ce merită cumpărat, cu prețul găsit azi la magazinele partenere.',
    `Adresa ta de email și alertele tale se șterg în ${FAREWELL_DELETE_DAYS} zile. Nu trebuie să faci nimic. Acesta este ultimul email pe care ți-l trimitem.`,
  ],
  button: 'Vezi superieftin.ro',
  closing: 'Mulțumim că ai folosit alertele!',
  why: 'Primești acest email pentru că ai cerut și confirmat alerte de preț pe superieftin.ro.',
  deleteNowLabel: 'Șterge-mi datele acum',
}

// ---------- 3. Raspunsul botului dupa inchidere (orice mesaj, inclusiv /start prod_… / offer_…) ----------
export function closedBotReply(site: string): string {
  const url = farewellHomeUrl(site, 'telegram')
  return [
    'Alertele de preț pe superieftin.ro s-au închis: nu mai creăm alerte noi și nu mai trimitem alerte.',
    '',
    `superieftin.ro e acum un blog de recomandări — articolele le găsești pe <a href="${escHtml(url)}">superieftin.ro</a>.`,
    '',
    'Datele alertelor vechi se șterg; nu trebuie să faci nimic.',
  ].join('\n')
}
