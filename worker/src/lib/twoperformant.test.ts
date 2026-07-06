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
