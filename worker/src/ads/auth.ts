import { createServer } from 'http'
import { randomBytes, createHash } from 'crypto'
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execFile } from 'child_process'

// Genereaza GOOGLE_ADS_REFRESH_TOKEN si il scrie direct in .env (nu il afiseaza niciodata).
// Rulare: cd worker && npm run ads:auth
//
// Cum functioneaza (fluxul OAuth „Desktop app”, recomandat de Google):
// 1. pornim un mic server local pe 127.0.0.1, pe un port liber;
// 2. deschidem browserul pe pagina de login Google; te loghezi cu contul Google care are
//    acces la contul de reclame si aprobi accesul la Google Ads;
// 3. Google te trimite inapoi pe serverul local cu un cod; il schimbam pe refresh token.
// PKCE + `state` protejeaza schimbul (nimeni altcineva nu poate folosi codul).

const ENV_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.env')
const SCOPE = 'https://www.googleapis.com/auth/adwords'

function readEnv(key: string): string {
  const line = readFileSync(ENV_PATH, 'utf8').split('\n').find((l) => l.startsWith(key + '='))
  return line ? line.slice(key.length + 1).trim() : ''
}

// Inlocuieste (sau adauga) KEY=valoare in .env, pastrand restul fisierului neatins
function writeEnv(key: string, value: string): void {
  const lines = readFileSync(ENV_PATH, 'utf8').split('\n')
  const i = lines.findIndex((l) => l.startsWith(key + '='))
  if (i >= 0) lines[i] = `${key}=${value}`
  else lines.push(`${key}=${value}`)
  writeFileSync(ENV_PATH, lines.join('\n'))
}

const b64url = (buf: Buffer) => buf.toString('base64url')

async function main() {
  const clientId = readEnv('GOOGLE_ADS_CLIENT_ID')
  const clientSecret = readEnv('GOOGLE_ADS_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    console.error('Lipsesc GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET din .env')
    process.exit(1)
  }

  const verifier = b64url(randomBytes(32))
  const challenge = b64url(createHash('sha256').update(verifier).digest())
  const state = b64url(randomBytes(16))

  const server = createServer()
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok))
  const port = (server.address() as { port: number }).port
  const redirectUri = `http://127.0.0.1:${port}`

  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',   // cerem refresh token (acces de durata)
    prompt: 'consent',        // forteaza emiterea unui refresh token nou
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  })

  const code = await new Promise<string>((ok, fail) => {
    const timer = setTimeout(() => fail(new Error('Timp expirat (5 min) — rulează din nou.')), 5 * 60_000)
    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', redirectUri)
      const err = url.searchParams.get('error')
      const got = url.searchParams.get('code')
      if (!err && !got) { res.writeHead(404).end(); return }   // ex. /favicon.ico
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      if (err || url.searchParams.get('state') !== state) {
        res.end('<h2>Autorizare eșuată.</h2><p>Poți închide fereastra și reveni în terminal.</p>')
        clearTimeout(timer)
        fail(new Error(err ? `Google a răspuns: ${err}` : 'Parametrul state nu se potrivește'))
        return
      }
      res.end('<h2>Gata ✓</h2><p>Accesul a fost acordat. Poți închide fereastra și reveni în terminal.</p>')
      clearTimeout(timer)
      ok(got!)
    })
    console.log('Se deschide browserul pentru login Google...')
    console.log('Dacă nu se deschide singur, copiază adresa de mai jos în browser:\n')
    console.log(authUrl + '\n')
    execFile('open', [authUrl], () => {})   // macOS
  }).finally(() => server.close())

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId, client_secret: clientSecret,
      redirect_uri: redirectUri, grant_type: 'authorization_code', code_verifier: verifier,
    }),
  })
  const data = await res.json() as { refresh_token?: string; scope?: string; error?: string; error_description?: string }
  if (!res.ok || !data.refresh_token) {
    throw new Error(`Schimbul codului a eșuat: ${data.error ?? res.status} ${data.error_description ?? ''}`.trim())
  }
  if (!data.scope?.includes(SCOPE)) throw new Error('Tokenul nu include accesul la Google Ads (scope adwords)')

  writeEnv('GOOGLE_ADS_REFRESH_TOKEN', data.refresh_token)
  console.log('✓ GOOGLE_ADS_REFRESH_TOKEN a fost salvat în .env (nu se afișează).')
  console.log('  Următorul pas: npm run ads:check')
}

main().catch((err) => {
  console.error('✗', err.message)
  process.exit(1)
})
