// Teste pentru consimtamant: „Publicitate” include reclamele personalizate (ad_personalization),
// dar DOAR pentru acordurile salvate cu textul nou (marcajul `personalization` din cookie);
// cookie-urile v2 vechi (fara marcaj) raman cu personalizarea refuzata.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import {
  parseConsentCookie, toGtagConsent, saveConsent, CONSENT_DEFAULT_SCRIPT, CONSENT_VERSION,
} from './consent'

const enc = (o: unknown) => encodeURIComponent(JSON.stringify(o))

test('cookie v2 vechi (fără câmpul personalization) → personalizare refuzată, restul neschimbat', () => {
  const c = parseConsentCookie(enc({ v: CONSENT_VERSION, analytics: true, ads: true, ts: 1 }))
  assert.deepEqual(c, { v: CONSENT_VERSION, analytics: true, ads: true, personalization: false, ts: 1 })
  assert.equal(toGtagConsent(c!).ad_personalization, 'denied')
  assert.equal(toGtagConsent(c!).ad_storage, 'granted')
})

test('acord nou „Publicitate” → toate trei granted; refuz → toate denied', () => {
  const g = toGtagConsent(parseConsentCookie(enc({ v: CONSENT_VERSION, analytics: false, ads: true, personalization: true, ts: 1 }))!)
  assert.deepEqual(g, { analytics_storage: 'denied', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' })
  const d = toGtagConsent(parseConsentCookie(enc({ v: CONSENT_VERSION, analytics: true, ads: false, personalization: true, ts: 1 }))!)
  assert.deepEqual(d, { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' })
})

test('valori care nu sunt exact true nu acordă nimic', () => {
  const c = parseConsentCookie(enc({ v: CONSENT_VERSION, analytics: 'true', ads: true, personalization: 1, ts: 1 }))!
  assert.equal(c.analytics, false)
  assert.equal(c.personalization, false)
  assert.equal(parseConsentCookie(enc({ v: 1, analytics: true, ads: true, personalization: true })), null)
  assert.equal(parseConsentCookie('nu-e-json'), null)
})

test('saveConsent: marcajul de personalizare urmează „Publicitate” (acord dat cu textul nou)', () => {
  const g = globalThis as Record<string, unknown>
  const calls: unknown[][] = []
  const doc = { cookie: '' }
  Object.assign(g, {
    document: doc, location: { protocol: 'http:' },
    window: { gtag: (...a: unknown[]) => calls.push(a), dispatchEvent: () => true },
  })   // CustomEvent exista nativ in Node ≥ 19
  try {
    for (const [ads, want] of [[true, 'granted'], [false, 'denied']] as const) {
      saveConsent({ analytics: false, ads })
      const saved = parseConsentCookie(doc.cookie.split(';')[0].split('=')[1])!
      assert.equal(saved.personalization, ads)
      const upd = calls.pop()![2] as Record<string, string>
      assert.equal(upd.ad_personalization, want)
      assert.equal(upd.ad_storage, want)
      assert.equal(upd.ad_user_data, want)
    }
  } finally {
    for (const k of ['document', 'location', 'window']) delete g[k]
  }
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
