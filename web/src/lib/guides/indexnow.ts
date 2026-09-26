// IndexNow (Bing, Yandex, Seznam…): anunta motoarele de cautare ca o pagina s-a schimbat,
// ca sa fie recitita repede. Google NU foloseste IndexNow (el citeste sitemap-ul).
//
// Optional si inofensiv: fara INDEXNOW_KEY in .env nu face nimic. Cheia se genereaza o data
// (ex. `openssl rand -hex 16`) si se publica la /indexnow-key.txt (route handler), ca Bing sa
// poata verifica faptul ca domeniul ne apartine.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.superieftin.ro'

export function indexNowKey(): string | null {
  const key = process.env.INDEXNOW_KEY?.trim()
  // Formatul cerut de protocol: 8–128 caractere, litere, cifre si „-”
  return key && /^[a-zA-Z0-9-]{8,128}$/.test(key) ? key : null
}

export async function pingIndexNow(paths: string[]): Promise<void> {
  const key = indexNowKey()
  if (!key || !paths.length) return
  const host = new URL(SITE_URL).host
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${SITE_URL}/indexnow-key.txt`,
        urlList: [...new Set(paths)].map((p) => `${SITE_URL}${p}`),
      }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok && res.status !== 202) console.error('IndexNow a raspuns', res.status)
  } catch (err) {
    // Non-critic: pagina e oricum in sitemap
    console.error('IndexNow esuat', err)
  }
}
