// Teste pentru limita de viteza de pe /go/ (lib/go-rate-limit.ts). Rulare: cd web && npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkRateLimit, goRateLimits, hashIp, type RateLimitRedis } from './go-rate-limit'

// Redis fals, in memorie, cu acelasi contract ca MULTI/EXEC din ioredis
function fakeRedis(opts: { fail?: 'throw' | 'hang' | 'error-reply'; status?: string } = {}) {
  const store = new Map<string, number>()
  const ttl = new Map<string, number>()
  const r: RateLimitRedis & { store: Map<string, number>; ttl: Map<string, number> } = {
    store, ttl, status: opts.status ?? 'ready',
    multi() {
      const ops: Array<() => [Error | null, unknown]> = []
      const m = {
        incr(k: string) { ops.push(() => { const v = (store.get(k) ?? 0) + 1; store.set(k, v); return [null, v] }); return m },
        expire(k: string, s: number) { ops.push(() => { ttl.set(k, s); return [null, 1] }); return m },
        exec() {
          if (opts.fail === 'throw') return Promise.reject(new Error('ECONNREFUSED'))
          if (opts.fail === 'hang') return new Promise<never>(() => {})
          if (opts.fail === 'error-reply') return Promise.resolve(ops.map(() => [new Error('OOM'), null] as [Error, null]))
          return Promise.resolve(ops.map(op => op()))
        },
      }
      return m
    },
  }
  return r
}

const L = { perMinute: 3, perHour: 5, timeoutMs: 50 }
const T0 = Date.UTC(2026, 9, 3, 12, 0, 0)

test('sub limita trece, peste limita pe minut e oprit', async () => {
  const r = fakeRedis()
  for (let i = 0; i < 3; i++) assert.deepEqual(await checkRateLimit(r, 'go', '1.2.3.4', L, 's', T0 + i), { allowed: true, reason: 'ok' })
  assert.deepEqual(await checkRateLimit(r, 'go', '1.2.3.4', L, 's', T0 + 10), { allowed: false, reason: 'minute' })
  // alt IP are contorul lui
  assert.equal((await checkRateLimit(r, 'go', '5.6.7.8', L, 's', T0 + 10)).allowed, true)
})

test('minutul urmator reporneste contorul, plafonul pe ora ramane', async () => {
  const r = fakeRedis()
  for (let i = 0; i < 3; i++) await checkRateLimit(r, 'go', '1.2.3.4', L, 's', T0)
  assert.equal((await checkRateLimit(r, 'go', '1.2.3.4', L, 's', T0 + 60_000)).allowed, true)   // 4 pe ora
  assert.equal((await checkRateLimit(r, 'go', '1.2.3.4', L, 's', T0 + 60_001)).allowed, true)   // 5 pe ora
  assert.deepEqual(await checkRateLimit(r, 'go', '1.2.3.4', L, 's', T0 + 60_002), { allowed: false, reason: 'hour' })
})

test('cheile: IP hash-uit (nu apare in clar), TTL scurt, scope separat', async () => {
  const r = fakeRedis()
  await checkRateLimit(r, 'go', '203.0.113.9', L, 's', T0)
  await checkRateLimit(r, 'tok', '203.0.113.9', L, 's', T0)
  const keys = [...r.store.keys()]
  assert.equal(keys.length, 4)
  for (const k of keys) assert.ok(!k.includes('203.0.113.9'), k)
  assert.ok(keys.some(k => k.startsWith('rl:go:m:')) && keys.some(k => k.startsWith('rl:tok:m:')))
  for (const [k, s] of r.ttl) assert.ok(s <= 3_660, `${k} ${s}`)
  assert.notEqual(hashIp('1.1.1.1', 'a'), hashIp('1.1.1.1', 'b'))
})

test('fail-open: Redis arunca eroare, nu raspunde sau e deconectat → cererea trece', async () => {
  assert.deepEqual(await checkRateLimit(fakeRedis({ fail: 'throw' }), 'go', '1.2.3.4', L, 's', T0), { allowed: true, reason: 'fail_open' })
  const t = Date.now()
  assert.deepEqual(await checkRateLimit(fakeRedis({ fail: 'hang' }), 'go', '1.2.3.4', L, 's', T0), { allowed: true, reason: 'fail_open' })
  assert.ok(Date.now() - t < 1000, 'timeout-ul trebuie respectat')
  assert.deepEqual(await checkRateLimit(fakeRedis({ fail: 'error-reply' }), 'go', '1.2.3.4', L, 's', T0), { allowed: true, reason: 'fail_open' })
  assert.deepEqual(await checkRateLimit(fakeRedis({ status: 'reconnecting' }), 'go', '1.2.3.4', L, 's', T0), { allowed: true, reason: 'fail_open' })
})

test('fara IP cunoscut nu se aplica o limita comuna', async () => {
  const r = fakeRedis()
  for (let i = 0; i < 10; i++) assert.equal((await checkRateLimit(r, 'go', 'necunoscut', L, 's', T0)).allowed, true)
  assert.equal(r.store.size, 0)
})

test('praguri din env, cu valori implicite', () => {
  assert.deepEqual(goRateLimits({}), { perMinute: 20, perHour: 120, timeoutMs: 150 })
  assert.deepEqual(goRateLimits({ GO_RATE_PER_MIN: '5', GO_RATE_PER_HOUR: '50' }), { perMinute: 5, perHour: 50, timeoutMs: 150 })
  assert.equal(goRateLimits({ GO_RATE_PER_MIN: 'abc' }).perMinute, 20)
  assert.equal(goRateLimits({ GO_RATE_PER_MIN: '0' }).perMinute, 20)
})
