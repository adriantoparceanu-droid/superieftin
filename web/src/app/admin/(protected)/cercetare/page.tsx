import type { Metadata } from 'next'
import Link from 'next/link'
import { getResearchCandidates, getResearchThemes } from '@/lib/admin/research'
import {
  parseResearchParams, researchHref, RESEARCH_PAGE_SIZE, RESEARCH_SORTS, SORT_LABELS, isRealDiscount,
} from '@/lib/admin/research-filters'
import { totalPages } from '@/lib/admin/alerts-format'
import { CopyText } from '@/components/admin/CopyText'

// Admin → Cercetare: candidatii pentru articole (unealta INTERNA — istoricul de pret nu mai e
// public, docs/plans/2026-11-20-reorganizare-blog-design.md §3). Formular GET real (merge si
// fara JS); pagina e dinamica (layout-ul protejat citeste cookies()), citeste direct din DB.

export const metadata: Metadata = { title: 'Cercetare', robots: { index: false, follow: false } }

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> }

const lei = (n: number | null) =>
  n == null ? '—' : `${n.toLocaleString('ro-RO', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} lei`
const int = (n: number) => n.toLocaleString('ro-RO')

function Pct({ pct }: { pct: number | null }) {
  if (pct == null) return <span className="text-muted">—</span>
  const label = `${pct > 0 ? '−' : '+'}${Math.abs(pct).toLocaleString('ro-RO', { maximumFractionDigits: 1 })}%`
  return <span className={pct < 0 ? 'text-muted' : ''}>{label}</span>
}

export default async function CercetarePage({ searchParams }: Props) {
  const cur = parseResearchParams(await searchParams)
  const [themes, { rows, total }] = await Promise.all([getResearchThemes(), getResearchCandidates(cur)])
  const pages = totalPages(total, RESEARCH_PAGE_SIZE)
  const input = 'border border-line rounded-lg px-3 py-1.5 text-sm bg-white'
  const pagerCls = 'px-3 py-1 rounded-lg border border-line bg-white text-sm hover:border-brand'

  return (
    <div className="max-w-[1400px]">
      <h1 className="text-2xl font-bold mb-2">Cercetare pentru articole</h1>
      <p className="text-sm text-muted mb-5 max-w-4xl">
        Produse disponibile acum la magazine partenere (cu link afiliat). Din Sănătate &amp; Naturale și
        farmacie veterinară: pe blog DOAR produse ne-medicale (marcate „doar ne-medical”); cele care par
        suplimente/medicamente sunt ascunse — „Arată și medicalele” le afișează marcate, dar în ghiduri sunt
        refuzate. „Cel mai bun preț” = cea mai ieftină ofertă disponibilă cu link afiliat (la
        egalitate, cea confirmată mai recent); mediana și min./max. pe 30 de zile sunt ale acelei oferte.
        Reducere reală = preț sub mediana pe 30 de zile × 0,95. Slug-ul se folosește în marcaje:{' '}
        <code className="text-xs">{'{{oferte:<slug>}}'}</code>.
      </p>

      <form method="get" action="/admin/cercetare" className="bg-white border border-line rounded-xl p-4 mb-5 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Temă</span>
          <select name="tema" defaultValue={cur.tema ?? ''} className={input}>
            <option value="">Toate temele</option>
            {themes.map((t) => (
              <optgroup key={t.id} label={t.name}>
                <option value={t.slug}>{t.name} — toată tema{t.is_visible ? '' : ' (ascunsă)'}{t.health ? ' (doar ne-medical)' : ''}</option>
                {t.children.map((c) => (
                  <option key={c.id} value={c.slug}>{c.name}{c.is_visible ? '' : ' (ascunsă)'}{c.health ? ' (doar ne-medical)' : ''}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Buget maxim (lei)</span>
          <input name="buget" inputMode="decimal" defaultValue={cur.buget ?? ''} placeholder="ex. 3000" className={`${input} w-32`} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Sortare</span>
          <select name="sort" defaultValue={cur.sort} className={input}>
            {RESEARCH_SORTS.map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm pb-2">
          <input type="checkbox" name="reale" value="1" defaultChecked={cur.reale} />
          Doar reduceri reale
        </label>
        <label className="flex items-center gap-2 text-sm pb-2" title="Produsele din Sănătate & Naturale / farmacie veterinară care par suplimente sau medicamente — refuzate în ghiduri">
          <input type="checkbox" name="toate" value="1" defaultChecked={cur.toate} />
          Arată și medicalele (marcate)
        </label>
        <button type="submit" className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold">Aplică</button>
        {(cur.tema || cur.buget != null || cur.reale || cur.toate) && (
          <Link href="/admin/cercetare" className="text-sm text-muted hover:text-brand pb-2">Resetează</Link>
        )}
      </form>

      <p className="text-sm text-muted mb-2">
        {total > 0
          ? <>{int(total)} produse · pagina {cur.pagina} din {pages}</>
          : cur.pagina > 1
            ? <>Pagina nu există. <Link href={researchHref(cur, { pagina: 1 })} className="text-brand hover:underline">Înapoi la pagina 1</Link></>
            : 'Niciun produs pentru filtrele alese.'}
      </p>

      {rows.length > 0 && (
        <div className="bg-white border border-line rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-muted">
              <tr>
                <th className="px-3 py-2">Produs</th>
                <th className="px-3 py-2">Marcă</th>
                <th className="px-3 py-2 text-right">Cel mai bun preț</th>
                <th className="px-3 py-2 text-right" title="Mediana pe 30 de zile a ofertei alese și diferența față de ea">Mediana 30 z</th>
                <th className="px-3 py-2 text-right">Min. / max. 30 z</th>
                <th className="px-3 py-2 text-right" title="Magazine distincte cu ofertă disponibilă și link afiliat">Magazine</th>
                <th className="px-3 py-2 text-right" title="Schimbări de preț în 60 de zile, adunate pe ofertele de mai sus">Schimbări 60 z</th>
                <th className="px-3 py-2">Slug</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.product_id} className="border-t border-line align-top">
                  <td className="px-3 py-2 max-w-[420px]">
                    <Link href={`/admin/cercetare/${encodeURIComponent(r.slug)}`} className="font-medium hover:text-brand hover:underline">
                      {r.name}
                    </Link>
                    {r.category_name && <div className="text-xs text-muted">{r.category_name}</div>}
                    {r.medical_terms.length > 0 ? (
                      <div className="text-xs font-semibold text-red-ink" title={r.medical_terms.join(', ')}>
                        Medical/supliment — nu se recomandă pe blog ({r.medical_terms.join(', ')})
                      </div>
                    ) : r.health_tree && (
                      <div className="text-xs text-amber-700">Doar ne-medical: fără afirmații de sănătate</div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{r.brand ?? <span className="text-muted">—</span>}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <div className="font-semibold tabular-nums">{lei(r.best_price)}</div>
                    <div className="text-xs text-muted">{r.best_retailer}</div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                    <div>{lei(r.median_30d)}</div>
                    <div className="text-xs">
                      <Pct pct={r.discount_pct} />
                      {isRealDiscount(r.best_price, r.median_30d) && <span className="ml-1 text-red-ink font-semibold">reală</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-xs">
                    {lei(r.min_30d)}<br />{lei(r.max_30d)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{int(r.stores)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{int(r.price_changes_60d)}</td>
                  <td className="px-3 py-2">
                    <code className="block text-xs break-all select-all max-w-[260px]">{r.slug}</code>
                    <span className="flex gap-3 mt-0.5">
                      <CopyText text={r.slug} />
                      <CopyText text={`{{oferte:${r.slug}}}`} label="marcaj" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav className="flex items-center gap-2 mt-3 text-sm" aria-label="Paginare">
          {cur.pagina > 1
            ? <Link href={researchHref(cur, { pagina: cur.pagina - 1 })} className={pagerCls}>← Înapoi</Link>
            : <span className={`${pagerCls} opacity-40`}>← Înapoi</span>}
          <span className="text-muted">Pagina {cur.pagina} din {pages}</span>
          {cur.pagina < pages
            ? <Link href={researchHref(cur, { pagina: cur.pagina + 1 })} className={pagerCls}>Înainte →</Link>
            : <span className={`${pagerCls} opacity-40`}>Înainte →</span>}
        </nav>
      )}
    </div>
  )
}
