// Teste pentru emailurile de alerta: configurare, sabloane si trimiterea SMTP (catre un server
// SMTP in memorie — nu pleaca niciun email real). Rulare: cd worker && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emailConfig } from './config.js'
import { createMailer, sendEmail } from './send.js'
import { emailLinks, renderConfirmEmail, renderDigestEmail, renderManageLinkEmail, shortName } from './templates.js'
import { startFakeSmtp } from './fake-smtp.js'

const BASE_ENV = { SMTP_HOST: 'smtp.exemplu.ro', EMAIL_FROM: 'superieftin.ro <alerte@superieftin.ro>', ALERT_TOKEN_SECRET: 's', SITE_URL: 'https://www.superieftin.ro' }
const links = emailLinks('https://www.superieftin.ro/', { manage: 'm.1.x.y', unsubscribe: 'u.1.0.z' })

test('config: dezactivat curat daca lipseste oricare dintre SMTP_HOST, EMAIL_FROM, ALERT_TOKEN_SECRET', () => {
  assert.equal(emailConfig({}), null)
  for (const k of ['SMTP_HOST', 'EMAIL_FROM', 'ALERT_TOKEN_SECRET'] as const) {
    assert.equal(emailConfig({ ...BASE_ENV, [k]: '' }), null, k)
  }
  const c = emailConfig(BASE_ENV)!
  assert.equal(c.port, 587)
  assert.equal(c.secure, false)
  assert.equal(c.minIntervalHours, 24)
  assert.equal(emailConfig({ ...BASE_ENV, SMTP_PORT: '465' })!.secure, true)
  assert.equal(emailConfig({ ...BASE_ENV, EMAIL_ALERT_MIN_INTERVAL_HOURS: '12' })!.minIntervalHours, 12)
})

test('digest: toate produsele intr-un singur email, linkuri /p/ cu utm_medium=email, fara promisiuni', () => {
  const mail = renderDigestEmail({
    links,
    items: [
      { productName: 'Laptop <Pro> & Co', productSlug: 'laptop-pro', retailerName: 'eMAG', price: 3499.9, targetPrice: 3500, rearmPrice: 3605 },
      { productName: 'Telefon X', productSlug: 'telefon-x', retailerName: 'evomag', price: 999, targetPrice: 1000, rearmPrice: 1030 },
    ],
  })
  assert.match(mail.subject, /2 produse/)
  assert.match(mail.html, /Laptop &lt;Pro&gt; &amp; Co/)
  assert.match(mail.html, /3\.499,90 RON<\/strong> la eMAG/)
  assert.match(mail.html, /href="https:\/\/www\.superieftin\.ro\/p\/laptop-pro\?utm_source=alerta&amp;utm_medium=email&amp;utm_campaign=alerta_pret"/)
  assert.match(mail.text, /https:\/\/www\.superieftin\.ro\/p\/telefon-x\?utm_source=alerta&utm_medium=email/)
  assert.match(mail.html, /alerte\/dezabonare\?t=u\.1\.0\.z/)
  assert.match(mail.html, /alerte\/gestionare\?t=m\.1\.x\.y/)
  assert.equal(mail.unsubscribeUrl, 'https://www.superieftin.ro/api/alerte-email/dezabonare?t=u.1.0.z')
  // Regula 9: fara „reducere”, procente sau garantii (in HTML, „%” apare legitim in CSS: width:100%)
  for (const t of [mail.subject, mail.text]) assert.doesNotMatch(t, /reducere|%|garant|\/go\//i)
  assert.doesNotMatch(mail.html, /reducere|garant|\/go\/|\d\s?%\s*sub/i)
  assert.throws(() => renderDigestEmail({ links, items: [] }))
  // re-armare: alertele raman active, cu pragul de re-armare si link de oprire (Alertele mele)
  assert.match(mail.text, /Alertele rămân active/)
  assert.match(mail.text, /urcă peste 3\.605,00 RON/)
  assert.match(mail.html, /Oprește alerta/)
})

test('confirmare si link de gestionare: au link de dezabonare si nu promit reduceri', () => {
  const c = renderConfirmEmail({ productName: 'Televizor LG', targetPrice: 1610, confirmUrl: 'https://www.superieftin.ro/alerte/confirmare?t=c.1.2.3', links })
  assert.match(c.html, /Confirmă alerta/)
  assert.match(c.text, /alerte\/confirmare\?t=c\.1\.2\.3/)
  assert.match(c.text, /alerte\/dezabonare/)
  const m = renderManageLinkEmail({ links })
  assert.match(m.text, /alerte\/gestionare/)
  for (const t of [c.text, m.text, c.subject]) assert.doesNotMatch(t, /reducere|%/i)
  for (const t of [c.html, m.html]) assert.doesNotMatch(t, /reducere/i)
})

test('subiect scurt pentru nume lungi de produs', () => {
  const s = shortName('Laptop Lenovo IdeaPad Slim 5 15ARP10 cu procesor AMD Ryzen 7 7735HS pana la 4.75GHz, 15.1" WQXGA OLED')
  assert.ok(s.length <= 61 && s.endsWith('…'), s)
  assert.equal(shortName('Scurt'), 'Scurt')
})

test('trimitere SMTP (server in memorie): HTML + text, List-Unsubscribe si List-Unsubscribe-Post', async () => {
  const smtp = await startFakeSmtp()
  try {
    const cfg = { ...emailConfig({ ...BASE_ENV, SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port) })!, secure: false }
    const mailer = createMailer(cfg)
    const mail = renderDigestEmail({ links, items: [{ productName: 'Ceas', productSlug: 'ceas', retailerName: 'ForIT', price: 199, targetPrice: 200, rearmPrice: 206 }] })
    await sendEmail(mailer, cfg, 'abonat@exemplu.ro', mail)
    assert.equal(smtp.messages.length, 1)
    // headerele lungi sunt „pliate” pe mai multe randuri (RFC 5322) — le despliem
    const raw = smtp.messages[0].data.replace(/\r\n[ \t]+/g, ' ')
    assert.match(smtp.messages[0].to[0], /abonat@exemplu\.ro/)
    assert.match(raw, /^List-Unsubscribe: <https:\/\/www\.superieftin\.ro\/api\/alerte-email\/dezabonare\?t=u\.1\.0\.z>/m)
    assert.match(raw, /^List-Unsubscribe-Post: List-Unsubscribe=One-Click/m)
    assert.match(raw, /multipart\/alternative/)
    assert.match(raw, /text\/plain/)
    assert.match(raw, /text\/html/)
    mailer.close()
  } finally {
    await smtp.close()
  }
})
