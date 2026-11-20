import { splitGuideBody, collectRefs, type GuideSegment } from '@/lib/guides/markers'
import { renderMarkdown, newHeadingEnv } from '@/lib/guides/markdown'
import { highlightUnverified } from '@/lib/guides/review'
import { loadLiveProducts, refsKey, type LiveProduct } from '@/lib/guides/queries'
import { getBestOffers, type BestOffer } from '@/lib/best-offer'
import { ARTICLE_PROSE } from '@/components/article'
import { ProductPick } from '@/components/guides/ProductPick'
import { anchorOwners } from '@/lib/guides/anchors'

// Tipografia pentru textul lung al ghidului: cea comuna de articol (components/article.ts, la fel
// ca paginile legale). Exportata si sub numele vechi, folosit de pagina ghidului pentru „Pe scurt”.
export const PROSE_CLASS = ARTICLE_PROSE

// Blocurile live (reorganizarea in blog, varianta A „Revista”): fiecare produs = un card cu UN
// singur buton spre cel mai ieftin magazin partener (ProductPick + lib/best-offer.ts). Fara
// mediana, procente, verdict sau grafic — istoricul de pret e doar intern.

type Offers = Map<string, BestOffer>

// Avertisment vizibil DOAR in previzualizarea din admin (pe pagina publica nu apare nimic)
function PreviewNote({ children }: { children: React.ReactNode }) {
  return <p className="my-4 rounded-lg bg-amber-tint px-3 py-2 text-xs text-amber-ink">Previzualizare: {children}</p>
}

// {{comparatie:A,B}} — tabel fata in fata, cu produsele pe coloane: numele, marca si, pe ultimul
// rand, cate un card compact (pretul + butonul spre magazinul ales). Fara preturi de la mai multe
// magazine. Pe telefon tabelul se deruleaza orizontal in interiorul lui.
function CompareBlock({ products, offers, anchors }: { products: LiveProduct[]; offers: Offers; anchors: Set<string> }) {
  const th = 'w-28 px-3 py-3 text-left align-top text-[12px] font-bold uppercase tracking-[.04em] text-ink-3'
  const hasBrand = products.some((p) => p.brand)
  return (
    // relative: textul sr-only ramane in containerul derulabil (altfel latea pagina pe telefon)
    <div className="relative my-6 overflow-x-auto border-t-[3px] border-ink bg-surface">
      <table className="w-full min-w-[30rem] table-fixed text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className={th}><span className="sr-only">Criteriu</span></th>
            {products.map((p) => (
              <th key={p.id} scope="col" className="px-3 py-3 text-left align-top font-display text-[15px] font-extrabold leading-snug text-ink">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasBrand && (
            <tr className="border-b border-line">
              <th scope="row" className={th}>Marcă</th>
              {products.map((p) => <td key={p.id} className="px-3 py-3 align-top text-ink-2">{p.brand ?? '—'}</td>)}
            </tr>
          )}
          <tr>
            <th scope="row" className={th}>Preț</th>
            {products.map((p) => (
              <td key={p.id} className="px-3 py-3 align-top">
                <ProductPick product={p} offer={offers.get(p.id) ?? null} compact anchor={anchors.has(p.slug)} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// Produsele unui bloc, in ordine, fara dubluri (acelasi produs scris ca id si ca slug = unul)
function blockProducts(seg: Extract<GuideSegment, { kind: 'block' }>, products: Map<string, LiveProduct>): LiveProduct[] {
  const refs = seg.type === 'comparatie' ? seg.refs : seg.refs.slice(0, 1)
  return [...new Map(refs.flatMap((r) => products.get(r) ?? []).map((p) => [p.id, p])).values()]
}

function Block({ seg, index, products, offers, anchors, preview }: {
  index: number
  seg: Extract<GuideSegment, { kind: 'block' }>
  products: Map<string, LiveProduct>
  offers: Offers
  anchors: Set<string>   // slug-urile care primesc ancora in acest bloc
  preview?: boolean
}) {
  const missing = seg.refs.filter((r) => !products.has(r))
  const note = preview && missing.length > 0 && (
    <PreviewNote>produse negăsite în <code>{seg.raw}</code> (id sau slug greșit): {missing.join(', ')}</PreviewNote>
  )

  if (seg.type === 'comparatie') {
    const list = blockProducts(seg, products)
    return (
      <>
        {list.length > 0 && <CompareBlock products={list} offers={offers} anchors={anchors} />}
        {note}
      </>
    )
  }

  // {{oferte:ID}} si {{pret:ID}} → acelasi card. Produs sters/inexistent: public nu aratam nimic
  // (un card fara nume n-ar spune nimic cititorului), in previzualizare — avertisment.
  const p = products.get(seg.refs[0] ?? '')
  if (!p) return note || null
  // pros/cons = {{pro:…}} / {{contra:…}} de sub marcaj (atasate de splitGuideBody)
  return (
    <ProductPick
      product={p}
      offer={offers.get(p.id) ?? null}
      anchor={anchors.has(p.slug)}
      pros={seg.pros}
      cons={seg.cons}
      uid={`b${index}`}
    />
  )
}

// Corpul ghidului: Markdown sigur (fara HTML brut) + blocurile live, in ordinea din text.
// preview = true (doar in admin) arata avertismente pentru marcaje gresite sau scoase.
export async function GuideBody({ body, preview }: { body: string; preview?: boolean }) {
  const segments = splitGuideBody(body)
  // Doua query-uri pe articol, indiferent de numarul de produse: produsele (dupa id/slug), apoi
  // cea mai buna oferta pentru toate odata (fara N+1).
  const products = await loadLiveProducts(refsKey(collectRefs(segments)))
  const offers = await getBestOffers([...new Set([...products.values()].map((p) => p.id))])
  // Ancora #produs-<slug>: pe cardul produsului; doar daca n-are card, pe coloana din comparatie
  const owners = anchorOwners(segments, (ref) => products.get(ref)?.slug)
  // Id-uri pe H2 (cuprinsul paginii, lib/guides/toc.ts): un singur env pe tot corpul → unice in
  // pagina. Bucatile se randeaza in ordinea din text (map sincron), ca in guideToc().
  const headings = newHeadingEnv()
  return (
    // Stilurile de text lung se aplica DOAR bucatilor Markdown, nu blocurilor live
    // (altfel [&_a] ar colora si butoanele spre magazine)
    <div>
      {segments.map((seg, i) => {
        if (seg.kind === 'md') {
          return <div key={i} className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: preview ? highlightUnverified(renderMarkdown(seg.text, headings)) : renderMarkdown(seg.text, headings) }} />
        }
        if (seg.kind === 'removed') {
          // Marcaj scos din setul public (istoricul de pret e intern): public nu se randeaza nimic
          return preview
            ? <PreviewNote key={i}>marcajul <code>{seg.raw}</code> nu mai este permis și nu apare pe site — înlocuiește-l cu {'{{oferte:…}}'} sau șterge-l.</PreviewNote>
            : null
        }
        if (seg.kind === 'orphan-note') {
          // {{pro}}/{{contra}} fara produs deasupra: salvarea il respinge; public nu apare nimic
          return preview
            ? <PreviewNote key={i}>marcajul <code>{seg.raw}</code> nu are un produs deasupra — pune-l imediat sub {'{{oferte:…}}'}.</PreviewNote>
            : null
        }
        return <Block key={i} index={i} seg={seg} products={products} offers={offers} anchors={owners.get(i) ?? new Set()} preview={preview} />
      })}
    </div>
  )
}
