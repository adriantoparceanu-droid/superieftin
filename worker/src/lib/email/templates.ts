// Sabloanele emailurilor de alerta (romana, HTML cu stiluri inline + varianta text).
//
// De ce tabele si stiluri inline: Gmail, Outlook si aplicatiile de mail ignora <style> si CSS-ul
// modern; tabelele cu latime maxima 600px se vad la fel peste tot, inclusiv pe telefon.
//
// Regula 9 (REGULI.md): emailurile spun DOAR pretul constatat, la ce magazin si pragul ales —
// fara „reducere”, procente sau promisiuni. Pretul se poate schimba: o spunem explicit.

import { alertProductUrl, formatRon } from '../price-alert.js'

export interface RenderedEmail {
  subject: string
  html: string
  text: string
  unsubscribeUrl: string     // pentru headerul List-Unsubscribe (endpoint POST „one-click”)
}

export interface EmailLinks {
  siteUrl: string
  manageUrl: string          // /alerte/gestionare?t=… (Alertele mele)
  unsubscribePageUrl: string // /alerte/dezabonare?t=… (linkul din corpul emailului)
  unsubscribePostUrl: string // /api/alerte-email/dezabonare?t=… (headerul List-Unsubscribe)
}

export function emailLinks(siteUrl: string, tokens: { manage: string; unsubscribe: string }): EmailLinks {
  const site = siteUrl.replace(/\/+$/, '')
  return {
    siteUrl: site,
    manageUrl: `${site}/alerte/gestionare?t=${encodeURIComponent(tokens.manage)}`,
    unsubscribePageUrl: `${site}/alerte/dezabonare?t=${encodeURIComponent(tokens.unsubscribe)}`,
    unsubscribePostUrl: `${site}/api/alerte-email/dezabonare?t=${encodeURIComponent(tokens.unsubscribe)}`,
  }
}

// Escapare HTML (inclusiv ghilimele, pentru atribute href)
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const FONT = 'font-family:Arial,Helvetica,sans-serif;'
const C = { brand: '#E53E3E', text: '#1A202C', muted: '#718096', line: '#E2E8F0', bg: '#F5F7FA', yellow: '#FACC15' }

function button(href: string, label: string, kind: 'brand' | 'yellow' = 'brand'): string {
  const style = kind === 'brand'
    ? `background:${C.brand};color:#FFFFFF;`
    : `background:${C.yellow};color:${C.text};`
  return `<a href="${esc(href)}" style="${FONT}${style}display:inline-block;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 20px;border-radius:6px;">${esc(label)}</a>`
}

function layout(o: { title: string; preheader: string; body: string; footer: string }): string {
  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${esc(o.title)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#FFFFFF;border:1px solid ${C.line};border-radius:8px;">
<tr><td style="${FONT}padding:18px 24px;border-bottom:1px solid ${C.line};font-size:22px;font-weight:900;color:${C.brand};">superieftin<span style="color:${C.text};">.ro</span></td></tr>
<tr><td style="${FONT}padding:24px;font-size:15px;line-height:1.5;color:${C.text};">${o.body}</td></tr>
<tr><td style="${FONT}padding:16px 24px;border-top:1px solid ${C.line};font-size:12px;line-height:1.5;color:${C.muted};">${o.footer}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function footerHtml(links: EmailLinks, why: string): string {
  return `${esc(why)}<br>
<a href="${esc(links.manageUrl)}" style="color:${C.muted};">Alertele mele</a> &middot;
<a href="${esc(links.unsubscribePageUrl)}" style="color:${C.muted};">Dezabonare de la toate alertele</a> &middot;
<a href="${esc(links.siteUrl)}/confidentialitate" style="color:${C.muted};">Confidențialitate</a> &middot;
<a href="${esc(links.siteUrl)}/contact" style="color:${C.muted};">Contact</a>`
}

function footerText(links: EmailLinks, why: string): string {
  return `--\n${why}\nAlertele mele: ${links.manageUrl}\nDezabonare de la toate alertele: ${links.unsubscribePageUrl}\nConfidențialitate: ${links.siteUrl}/confidentialitate`
}

// ---------- 1. Confirmarea abonarii (double opt-in) ----------

export function renderConfirmEmail(o: {
  productName: string
  targetPrice: number
  confirmUrl: string
  links: EmailLinks
}): RenderedEmail {
  const subject = `Confirmă alerta de preț pentru ${shortName(o.productName)}`
  const why = 'Primești acest email pentru că cineva (probabil tu) a cerut o alertă de preț pe superieftin.ro cu această adresă. Dacă nu ai cerut-o, ignoră mesajul: fără confirmare nu primești nimic, iar cererea se șterge singură în 7 zile.'
  const body = `<p style="margin:0 0 12px;">Ai cerut o alertă de preț pentru:</p>
<p style="margin:0 0 4px;font-weight:bold;">${esc(o.productName)}</p>
<p style="margin:0 0 20px;">Te anunțăm pe email când prețul, la oricare dintre magazinele monitorizate, ajunge la <strong>${formatRon(o.targetPrice)} RON</strong> sau mai puțin.</p>
<p style="margin:0 0 20px;">${button(o.confirmUrl, 'Confirmă alerta')}</p>
<p style="margin:0;font-size:13px;color:${C.muted};">Linkul e valabil 3 zile. Alerta pornește doar după confirmare. Primești cel mult un email de alerte pe zi, cu toate produsele care au ajuns la prag. După anunț, alerta rămâne activă: te anunțăm din nou la fiecare scădere nouă sub prag, până o oprești.</p>`
  return {
    subject,
    html: layout({ title: subject, preheader: 'Apasă butonul ca să pornești alerta de preț.', body, footer: footerHtml(o.links, why) }),
    text: `Ai cerut o alertă de preț pentru:\n${o.productName}\n\nTe anunțăm pe email când prețul, la oricare dintre magazinele monitorizate, ajunge la ${formatRon(o.targetPrice)} RON sau mai puțin.\n\nConfirmă alerta (link valabil 3 zile):\n${o.confirmUrl}\n\n${footerText(o.links, why)}\n`,
    unsubscribeUrl: o.links.unsubscribePostUrl,
  }
}

// ---------- 2. Link nou pentru „Alertele mele” ----------

export function renderManageLinkEmail(o: { links: EmailLinks }): RenderedEmail {
  const subject = 'Linkul pentru alertele tale de preț'
  const why = 'Primești acest email pentru că s-a cerut pe superieftin.ro un link către alertele de preț ale acestei adrese.'
  const body = `<p style="margin:0 0 20px;">Aici îți vezi alertele de preț: poți schimba pragul, poți șterge o alertă sau te poți dezabona de tot.</p>
<p style="margin:0 0 20px;">${button(o.links.manageUrl, 'Alertele mele')}</p>
<p style="margin:0;font-size:13px;color:${C.muted};">Linkul e valabil 60 de zile. Dacă nu tu l-ai cerut, poți ignora emailul — nu se schimbă nimic.</p>`
  return {
    subject,
    html: layout({ title: subject, preheader: 'Vezi și modifică alertele tale de preț.', body, footer: footerHtml(o.links, why) }),
    text: `Alertele tale de preț (link valabil 60 de zile):\n${o.links.manageUrl}\n\n${footerText(o.links, why)}\n`,
    unsubscribeUrl: o.links.unsubscribePostUrl,
  }
}

// ---------- 3. Emailul cu alerte (digest: toate produsele intr-un singur mesaj) ----------

export interface DigestItem {
  productName: string
  productSlug: string
  retailerName: string
  price: number
  targetPrice: number
  rearmPrice: number      // pragul + marja de re-armare (lib/alert-rearm.ts)
}

export function renderDigestEmail(o: { items: DigestItem[]; links: EmailLinks }): RenderedEmail {
  if (o.items.length === 0) throw new Error('digest fara produse')
  const n = o.items.length
  const subject = n === 1
    ? `Alertă de preț: ${shortName(o.items[0].productName)} — ${formatRon(o.items[0].price)} RON`
    : `Alertă de preț: ${n} produse au ajuns la prețul ales de tine`
  const why = 'Primești acest email pentru că ai cerut și confirmat alerte de preț pe superieftin.ro.'
  const rows = o.items.map((it) => {
    const url = alertProductUrl(o.links.siteUrl, it.productSlug, 'email')
    return `<tr><td style="${FONT}padding:14px 0;border-top:1px solid ${C.line};font-size:15px;line-height:1.45;color:${C.text};">
<a href="${esc(url)}" style="color:${C.text};font-weight:bold;text-decoration:none;">${esc(it.productName)}</a><br>
Preț constatat: <strong>${formatRon(it.price)} RON</strong> la ${esc(it.retailerName)}<br>
<span style="color:${C.muted};font-size:13px;">Pragul tău: ${formatRon(it.targetPrice)} RON. Te anunțăm din nou după ce prețul urcă peste ${formatRon(it.rearmPrice)} RON și scade iar la prag. <a href="${esc(o.links.manageUrl)}" style="color:${C.muted};">Oprește alerta</a></span><br>
<span style="display:inline-block;margin-top:10px;">${button(url, 'Vezi produsul și ofertele', 'yellow')}</span>
</td></tr>`
  }).join('\n')
  const body = `<p style="margin:0 0 12px;">${n === 1 ? 'Am constatat un preț la sau sub pragul ales de tine:' : `Am constatat prețuri la sau sub pragul ales de tine pentru ${n} produse:`}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
<p style="margin:16px 0 0;font-size:13px;color:${C.muted};">Prețurile se pot schimba oricând — verifică oferta pe pagină înainte să cumperi. ${n === 1 ? 'Alerta rămâne activă' : 'Alertele rămân active'}: te anunțăm din nou la următoarea scădere la sau sub prag (cel mult un email pe zi). ${n === 1 ? 'O poți opri' : 'Le poți opri'} oricând din <a href="${esc(o.links.manageUrl)}" style="color:${C.muted};">Alertele mele</a>.</p>`
  const textItems = o.items.map((it) =>
    `- ${it.productName}\n  Preț constatat: ${formatRon(it.price)} RON la ${it.retailerName} (pragul tău: ${formatRon(it.targetPrice)} RON; te anunțăm din nou după ce prețul urcă peste ${formatRon(it.rearmPrice)} RON și scade iar la prag)\n  ${alertProductUrl(o.links.siteUrl, it.productSlug, 'email')}`,
  ).join('\n\n')
  return {
    subject,
    html: layout({ title: subject, preheader: n === 1 ? `${formatRon(o.items[0].price)} RON la ${o.items[0].retailerName}` : `${n} produse au ajuns la pragul tău`, body, footer: footerHtml(o.links, why) }),
    text: `Am constatat prețuri la sau sub pragul ales de tine:\n\n${textItems}\n\nPrețurile se pot schimba oricând — verifică oferta pe pagină înainte să cumperi. Alertele rămân active: te anunțăm din nou la următoarea scădere la sau sub prag (cel mult un email pe zi). Le oprești din Alertele mele: ${o.links.manageUrl}\n\n${footerText(o.links, why)}\n`,
    unsubscribeUrl: o.links.unsubscribePostUrl,
  }
}

// Subiectul nu trebuie sa fie un roman: numele de produse din feed-uri au adesea 150+ caractere
export function shortName(name: string, max = 60): string {
  const n = name.replace(/\s+/g, ' ').trim()
  if (n.length <= max) return n
  const cut = n.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return `${(sp > 30 ? cut.slice(0, sp) : cut).replace(/[,;:\-–]+$/, '')}…`
}
