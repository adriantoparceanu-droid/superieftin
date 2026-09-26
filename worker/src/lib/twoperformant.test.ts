import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuicklink, programCommission, type TpProgram } from './twoperformant.js'

test('buildQuicklink — format event.2performant cu aff_code + unique + redirect encodat', () => {
  const url = buildQuicklink('https://www.evomag.ro/p?a=1&b=2', 'd4f678b43', 'f775dbeb9')
  assert.equal(
    url,
    'https://event.2performant.com/events/click?ad_type=quicklink&aff_code=f775dbeb9&unique=d4f678b43&redirect_to='
      + encodeURIComponent('https://www.evomag.ro/p?a=1&b=2'),
  )
})

test('programCommission — rata din affrequest are prioritate fata de default', () => {
  const base = { id: 411, name: 'evomag', base_url: 'evomag.ro', main_url: '', unique_code: 'x', status: 'active', currency: 'RON' }
  assert.equal(programCommission({ ...base, affrequest: { status: 'accepted', commission_sale_rate: '3.5' }, default_sale_commission_rate: '1.0' } as TpProgram), 3.5)
  assert.equal(programCommission({ ...base, default_sale_commission_rate: '2.0' } as TpProgram), 2)
  assert.equal(programCommission({ ...base } as TpProgram), null)
})

test('getAcceptedPrograms — la 401 (sesiune expirata) face login din nou si reincearca', async () => {
  process.env.TWOPERFORMANT_EMAIL = 'test@example.com'
  process.env.TWOPERFORMANT_PASSWORD = 'x'
  const { getAcceptedPrograms } = await import('./twoperformant.js')
  const calls: string[] = []
  const realFetch = globalThis.fetch
  let signIns = 0, programCalls = 0
  const farViitor = String(Math.floor(Date.now() / 1000) + 14 * 24 * 3600)
  globalThis.fetch = (async (url: string) => {
    calls.push(String(url).replace('https://api.2performant.com', ''))
    if (String(url).includes('/users/sign_in.json')) {
      signIns++
      return new Response('{"user":{}}', { status: 200, headers: { 'access-token': `tok${signIns}`, client: 'c', uid: 'u', expiry: farViitor } })
    }
    programCalls++
    // Primul apel de programe: sesiune expirata pe server → 401
    if (programCalls === 1) return new Response('{"errors":["Authorized users only."]}', { status: 401 })
    return new Response(JSON.stringify({ programs: [{ id: 1, name: 'evomag', base_url: 'evomag.ro', main_url: '', unique_code: 'x', status: 'active', currency: 'RON' }] }), { status: 200 })
  }) as typeof fetch
  try {
    const programs = await getAcceptedPrograms()
    assert.equal(programs.length, 1)
    assert.equal(signIns, 2, 'trebuie sa refaca login-ul dupa 401')
    assert.equal(programCalls, 2, 'reincearca o singura data')
  } finally {
    globalThis.fetch = realFetch
  }
})
