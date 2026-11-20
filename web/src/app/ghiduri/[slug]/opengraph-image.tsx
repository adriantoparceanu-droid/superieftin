import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getPublishedGuide, getGuideProductIds, refsKey, getGuideTheme } from '@/lib/guides/queries'
import { collectRefs, splitGuideBody } from '@/lib/guides/markers'

// Imaginea Open Graph a articolului (1200×630, PNG): titlul, tema si logo-ul text. Apare la
// distribuirea linkului (Facebook, WhatsApp, X, LinkedIn) si e aceeasi cu BlogPosting.image din
// JSON-LD (lib/guides/jsonld.ts → articleImageUrl). Fara imagini externe: doar text + forme.
//
// Fontul: Archivo (fontul titlurilor de pe site), fisiere TTF locale in web/assets/fonts (licenta
// OFL, alaturi). Satori (motorul ImageResponse) nu citeste woff2, deci nu putem refolosi fontul
// descarcat de next/font. Daca fisierele lipsesc, imaginea se face cu fontul implicit — nu pica.

export const alt = 'Articol superieftin.ro'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
// Ca pagina: regenerata cel mult o data pe ora (titlul se schimba rar)
export const revalidate = 3600

// Culorile site-ului (web/src/app/globals.css, tema luminoasa)
const C = { bg: '#F4F5F7', surface: '#FFFFFF', ink: '#14161A', ink3: '#6A707C', red: '#D42B2B', redInk: '#B91C22', line: '#E1E4E9' }

async function loadFonts() {
  try {
    const dir = join(process.cwd(), 'assets', 'fonts')
    const [bold, medium] = await Promise.all([
      readFile(join(dir, 'Archivo-ExtraBold.ttf')),
      readFile(join(dir, 'Archivo-Medium.ttf')),
    ])
    return [
      { name: 'Archivo', data: bold, weight: 800 as const, style: 'normal' as const },
      { name: 'Archivo', data: medium, weight: 500 as const, style: 'normal' as const },
    ]
  } catch {
    return undefined
  }
}

// Titlu lung → litere mai mici, ca sa incapa in 3–4 randuri
function titleSize(title: string): number {
  const n = [...title].length
  if (n <= 45) return 72
  if (n <= 70) return 62
  if (n <= 100) return 52
  return 44
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = await getPublishedGuide(slug)
  if (!guide) return new Response('Not found', { status: 404 })

  const linkedIds = await getGuideProductIds(guide.id)
  const theme = await getGuideTheme(guide.id, guide.category_slug, refsKey([...collectRefs(splitGuideBody(guide.body_md)), ...linkedIds]))
  const fonts = await loadFonts()
  const title = [...guide.title].length > 140 ? `${[...guide.title].slice(0, 137).join('')}…` : guide.title

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: C.bg, padding: 48, fontFamily: 'Archivo' }}>
        <div
          style={{
            flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            background: C.surface, borderRadius: 32, padding: '56px 64px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Accentul rosu al site-ului (bara scurta deasupra temei) */}
            <div style={{ display: 'flex', width: 96, height: 10, borderRadius: 5, background: C.red, marginBottom: 28 }} />
            {theme && (
              <div style={{ display: 'flex', fontSize: 28, fontWeight: 800, letterSpacing: 2, color: C.redInk, textTransform: 'uppercase' }}>
                {theme.name}
              </div>
            )}
            <div style={{ display: 'flex', marginTop: 20, fontSize: titleSize(title), fontWeight: 800, lineHeight: 1.08, color: C.ink, letterSpacing: -1 }}>
              {title}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `2px solid ${C.line}`, paddingTop: 28 }}>
            {/* Logo: simbolul din app/icon.svg (pretul in trepte sub mediana) + numele */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <svg width="56" height="56" viewBox="0 0 32 32">
                <rect width="32" height="32" rx="8" fill={C.red} />
                <path d="M5.5 14.5h21" stroke="#fff" strokeWidth="1.6" strokeDasharray="2.2 2.2" strokeLinecap="round" opacity=".7" />
                <path d="M5.5 9.5h6v3.5h5.5v9h9.5" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="26" cy="22" r="2.6" fill="#fff" />
              </svg>
              <div style={{ display: 'flex', marginLeft: 18, fontSize: 38, fontWeight: 800, color: C.ink }}>superieftin.ro</div>
            </div>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 500, color: C.ink3 }}>Blog de recomandări</div>
          </div>
        </div>
      </div>
    ),
    { ...size, ...(fonts ? { fonts } : {}) },
  )
}
