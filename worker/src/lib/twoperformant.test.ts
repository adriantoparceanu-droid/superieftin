import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildQuicklink, programCommission, parseTpCommission, clickIdFromStatsTags, sanitizeTpCommission, type TpProgram, type TpCommissionRaw } from './twoperformant.js'

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

// --- Comisioane (tracking) — forma reala a raspunsului, verificata live pe 2026-10-03 ---------

// Un rand ca cel intors de API (valorile sunt inventate; structura e cea reala)
const tpRaw = (over: Partial<TpCommissionRaw> = {}): TpCommissionRaw => ({
  id: 9001, user_id: 1, actionid: 2, amount: '3.80', initial_amount: '3.80', status: 'pending', description: 'x',
  created_at: '2026-09-30T10:00:00Z', updated_at: '2026-09-30T10:05:00Z', reason: [], stats_tags: 'abc123def456',
  history: null, currency: 'EUR', working_currency_code: 'RON', program_id: 411, amount_in_working_currency: '20.01',
  actiontype: 'sale', type: 'sale', program: { name: 'evomag.ro ', slug: 'evomag-ro' },
  public_action_data: { created_at: '2026-09-30T09:58:00Z', updated_at: '2026-09-30T09:58:00Z', amount: '400.0', ad_type: 'quicklink', source_ip: '192.0.2.10' },
  public_click_data: { created_at: '2026-09-29T08:00:00Z', source_ip: '192.0.2.10', url: 'https://www.superieftin.ro/p/x', redirect_to: 'https://www.evomag.ro/x', stats_tags: 'abc123def456', device_type: 'Mobile' },
  ...over,
})

test('parseTpCommission — click_id din stats_tags, suma in RON, momentul vanzarii', () => {
  const p = parseTpCommission(tpRaw())
  assert.equal(p.externalId, '9001')
  assert.equal(p.clickId, 'abc123def456')
  assert.equal(p.advertiserId, '411')
  assert.equal(p.status, 'pending')
  assert.equal(p.amount, 20.01, 'amount_in_working_currency (RON), NU amount (EUR)')
  assert.equal(p.orderTime.toISOString(), '2026-09-30T09:58:00.000Z', 'public_action_data.created_at')
  assert.equal(p.unknownStatus, undefined)
  assert.equal(p.currencyIssue, undefined)
})

test('parseTpCommission — statusuri: accepted/paid → approved, rejected → rejected, necunoscut → pending + semnalat', () => {
  assert.equal(parseTpCommission(tpRaw({ status: 'accepted' })).status, 'approved')
  assert.equal(parseTpCommission(tpRaw({ status: 'paid' })).status, 'approved')
  assert.equal(parseTpCommission(tpRaw({ status: 'rejected' })).status, 'rejected')
  const u = parseTpCommission(tpRaw({ status: 'on_hold' }))
  assert.equal(u.status, 'pending')
  assert.equal(u.unknownStatus, 'on_hold')
})

test('parseTpCommission — moneda: RON direct in amount; fara RON deloc → 0 + semnalat', () => {
  assert.equal(parseTpCommission(tpRaw({ currency: 'RON', amount: '12.5', working_currency_code: 'EUR', amount_in_working_currency: '2.5' })).amount, 12.5)
  const e = parseTpCommission(tpRaw({ currency: 'EUR', working_currency_code: 'EUR', amount_in_working_currency: '3.8' }))
  assert.equal(e.amount, 0)
  assert.equal(e.currencyIssue, 'EUR/EUR')
})

test('parseTpCommission — fara stats_tags pe comision → din public_click_data; fallback pe created_at', () => {
  const p = parseTpCommission(tpRaw({ stats_tags: '', public_action_data: null }))
  assert.equal(p.clickId, 'abc123def456')
  assert.equal(p.orderTime.toISOString(), '2026-09-30T10:00:00.000Z')
  assert.equal(parseTpCommission(tpRaw({ stats_tags: '', public_click_data: { stats_tags: '' } })).clickId, null)
  assert.throws(() => parseTpCommission(tpRaw({ created_at: 'ieri', public_action_data: null })), /Dată 2Performant/)
})

test('clickIdFromStatsTags — text, lista, mai multe taguri, gunoi', () => {
  assert.equal(clickIdFromStatsTags('abc123def456'), 'abc123def456')
  assert.equal(clickIdFromStatsTags('PPC campaign,abc123def456'), 'abc123def456', 'tagurile cu spatii nu sunt click_id')
  assert.equal(clickIdFromStatsTags(['abc123def456', 'tag2']), 'abc123def456')
  assert.equal(clickIdFromStatsTags('["abc123def456"]'), 'abc123def456', 'lista serializata ca text')
  assert.equal(clickIdFromStatsTags('ABC123DEF456'), 'abc123def456')
  assert.equal(clickIdFromStatsTags(''), null)
  assert.equal(clickIdFromStatsTags(null), null)
  assert.equal(clickIdFromStatsTags('a-b'), null)
  assert.equal(clickIdFromStatsTags('<script>'), null)
})

test('sanitizeTpCommission — scoate IP-ul cumparatorului, nu modifica originalul', () => {
  const raw = tpRaw()
  const c = sanitizeTpCommission(raw)
  assert.doesNotMatch(JSON.stringify(c), /192\.0\.2\.10|source_ip/)
  assert.equal(raw.public_click_data?.source_ip, '192.0.2.10')
  assert.equal(c.public_click_data?.stats_tags, 'abc123def456')
})

test('getTpCommissions — paginare dupa metadata.pagination.pages, filtru pe data crearii', async () => {
  process.env.TWOPERFORMANT_EMAIL = 'test@example.com'
  process.env.TWOPERFORMANT_PASSWORD = 'x'
  const { getTpCommissions } = await import('./twoperformant.js')
  const realFetch = globalThis.fetch
  const paths: string[] = []
  const farViitor = String(Math.floor(Date.now() / 1000) + 14 * 24 * 3600)
  globalThis.fetch = (async (url: string) => {
    const u = String(url).replace('https://api.2performant.com', '')
    if (u.includes('/users/sign_in.json')) return new Response('{}', { status: 200, headers: { 'access-token': 't', client: 'c', uid: 'u', expiry: farViitor } })
    paths.push(u)
    const page = Number(/page=(\d+)/.exec(u)![1])
    const list = page === 1 ? Array.from({ length: 100 }, (_, i) => tpRaw({ id: i })) : [tpRaw({ id: 100 })]
    return new Response(JSON.stringify({ commissions: list, metadata: { pagination: { results: 101, pages: 2, current_page: page } } }), { status: 200 })
  }) as typeof fetch
  try {
    const all = await getTpCommissions(90, new Date('2026-10-03T12:00:00Z'))
    assert.equal(all.length, 101)
    assert.equal(paths.length, 2)
    assert.match(paths[0], /^\/affiliate\/commissions\.json\?page=1&perpage=100&filter\[start_date\]=2026-07-05&filter\[end_date\]=2026-10-03$/)
  } finally {
    globalThis.fetch = realFetch
  }
})

test('getTpCommissions — fara rezultate (pages: 0) se opreste dupa o cerere', async () => {
  const { getTpCommissions } = await import('./twoperformant.js')
  const realFetch = globalThis.fetch
  let n = 0
  globalThis.fetch = (async () => { n++; return new Response(JSON.stringify({ commissions: [], metadata: { pagination: { results: 0, pages: 0, current_page: 1 } } }), { status: 200 }) }) as typeof fetch
  try {
    assert.deepEqual(await getTpCommissions(), [])
    assert.equal(n, 1)
  } finally {
    globalThis.fetch = realFetch
  }
})
