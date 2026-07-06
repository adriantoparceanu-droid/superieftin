// Normalizeaza un URL sau host la domeniul inregistrabil, ca sa potrivim URL-urile de
// produs (scrapate sau din feed) cu advertiserii din retele.
//   'eMAG.ro'                 -> 'emag.ro'
//   'https://www.emag.ro/x'   -> 'emag.ro'
//   'Karcher.com/ro/ro'       -> 'karcher.com'
//   'produs.shop.altex.ro'    -> 'altex.ro'

// Sufixe cu doua nivele (ccTLD de tip al doilea nivel) — pentru ele pastram 3 labels.
const MULTI_LEVEL_TLDS = new Set([
  'com.ro', 'co.uk', 'org.uk', 'com.tr', 'co.nz', 'com.au', 'co.jp', 'com.br',
])

export function extractDomain(input: string): string | null {
  if (!input) return null
  let s = input.trim().toLowerCase()

  // Scoate schema (sau '//') daca exista
  s = s.replace(/^[a-z]+:\/\//, '').replace(/^\/\//, '')
  // Pastreaza doar host-ul (taie path/query/port)
  s = s.split('/')[0].split('?')[0].split('@').pop()!.split(':')[0]
  s = s.replace(/^www\./, '').replace(/\.$/, '')
  if (!s || !s.includes('.')) return null

  const parts = s.split('.').filter(Boolean)
  if (parts.length <= 2) return parts.join('.')

  const lastTwo = parts.slice(-2).join('.')
  const lastThree = parts.slice(-3).join('.')
  return MULTI_LEVEL_TLDS.has(lastTwo) ? lastThree : lastTwo
}
