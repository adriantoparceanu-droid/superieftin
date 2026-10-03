// Teste pentru consimtamant: bifa separata „Reclame personalizate” (ad_personalization).
// Regula: 'granted' DOAR cu acord explicit pentru personalizare SI pentru „Publicitate”;
// cookie-urile v2 vechi (fara camp) raman cu personalizarea refuzata.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {
  parseConsentCookie, toGtagConsent, acceptAllSelection, CONSENT_DEFAULT_SCRIPT, CONSENT_VERSION,
  ACCEPT_ALL_INCLUDES_PERSONALIZATION,
} from './consent'

const enc = (o: unknown) => encodeURIComponent(JSON.stringify(o))

test('cookie v2 vechi (fără câmpul personalization) → personalizare refuzată, restul neschimbat', () => {
  const c = parseConsentCookie(enc({ v: CONSENT_VERSION, analytics: true, ads: true, ts: 1 }))
  assert.deepEqual(c, { v: CONSENT_VERSION, analytics: true, ads: true, personalization: false, ts: 1 })
  assert.equal(toGtagConsent(c!).ad_personalization, 'denied')
  assert.equal(toGtagConsent(c!).ad_storage, 'granted')
})

test('personalizarea cere și „Publicitate”', () => {
  assert.equal(parseConsentCookie(enc({ v: CONSENT_VERSION, analytics: true, ads: false, personalization: true, ts: 1 }))!.personalization, false)
  assert.equal(toGtagConsent({ analytics: true, ads: false, personalization: true }).ad_personalization, 'denied')
  assert.equal(toGtagConsent({ analytics: false, ads: true, personalization: true }).ad_personalization, 'granted')
  assert.equal(toGtagConsent({ analytics: true, ads: true, personalization: false }).ad_personalization, 'denied')
})

test('valori care nu sunt exact true nu acordă nimic', () => {
  const c = parseConsentCookie(enc({ v: CONSENT_VERSION, analytics: 'true', ads: true, personalization: 1, ts: 1 }))!
  assert.equal(c.analytics, false)
  assert.equal(c.personalization, false)
  assert.equal(parseConsentCookie(enc({ v: 1, analytics: true, ads: true, personalization: true })), null)
  assert.equal(parseConsentCookie('nu-e-json'), null)
})

test('„Accept toate” urmează comutatorul ACCEPT_ALL_INCLUDES_PERSONALIZATION', () => {
  assert.deepEqual(acceptAllSelection(), { analytics: true, ads: true, personalization: ACCEPT_ALL_INCLUDES_PERSONALIZATION })
})

// Scriptul inline (ruleaza inaintea gtag.js): default totul denied, apoi reaplica alegerea salvata.
function runDefaultScript(cookie: string) {
  const sandbox: Record<string, unknown> = { document: { cookie } }
  sandbox.window = sandbox
  vm.createContext(sandbox)
  vm.runInContext(CONSENT_DEFAULT_SCRIPT, sandbox)
  return (sandbox.dataLayer as IArguments[]).map((a) => Array.from(a))
}

test('scriptul implicit: fără alegere → doar default denied (inclusiv ad_personalization)', () => {
  const calls = runDefaultScript('')
  const def = calls.find((c) => c[0] === 'consent' && c[1] === 'default')!
  assert.equal((def[2] as Record<string, string>).ad_personalization, 'denied')
  assert.ok(!calls.some((c) => c[0] === 'consent' && c[1] === 'update'))
})

test('scriptul implicit: reaplică personalizarea doar dacă e salvată împreună cu „Publicitate”', () => {
  const upd = (cookieVal: object) => runDefaultScript(`x=1; se_consent=${enc(cookieVal)}`)
    .find((c) => c[0] === 'consent' && c[1] === 'update')?.[2] as Record<string, string>
  assert.equal(upd({ v: CONSENT_VERSION, analytics: true, ads: true, personalization: true, ts: 1 }).ad_personalization, 'granted')
  assert.equal(upd({ v: CONSENT_VERSION, analytics: true, ads: true, ts: 1 }).ad_personalization, 'denied')
  assert.equal(upd({ v: CONSENT_VERSION, analytics: true, ads: false, personalization: true, ts: 1 }).ad_personalization, 'denied')
  assert.equal(upd({ v: CONSENT_VERSION, analytics: true, ads: true, personalization: true, ts: 1 }).ad_storage, 'granted')
})
