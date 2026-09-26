'use client'

import { useActionState, useRef, useState, useTransition, type ReactNode } from 'react'
import Link from 'next/link'
import { saveGuideAction, searchGuideProductsAction, previewGuideAction } from '@/lib/admin/guide-actions'
import { slugify } from '@/lib/guides/format'
import type { AdminGuide, LinkedProduct } from '@/lib/admin/guides'
import type { FaqItem, GuideAuthor } from '@/lib/guides/queries'

interface Props {
  guide: AdminGuide | null
  authors: GuideAuthor[]
  categories: { slug: string; label: string }[]
  // Precompletare la „Creează ghid” din lista de candidati
  initial?: { products: LinkedProduct[]; category_slug: string | null; body_md: string }
}

const input = 'w-full border border-line rounded-lg px-3 py-1.5 text-sm bg-white'
const label = 'block text-xs text-muted mb-1'
const btn = 'text-sm font-semibold rounded-lg px-4 py-1.5 disabled:opacity-50'

// Editorul de ghid: toate campurile sunt controlate (state React), ca sa nu se piarda textul
// cand React reseteaza formularul dupa o actiune de server.
export function GuideEditor({ guide, authors, categories, initial }: Props) {
  const [state, formAction, pending] = useActionState(saveGuideAction, null)
  const [title, setTitle] = useState(guide?.title ?? '')
  const [slug, setSlug] = useState(guide?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(!!guide)
  const [meta, setMeta] = useState(guide?.meta_description ?? '')
  const [kind, setKind] = useState<'produs' | 'categorie'>(guide?.kind ?? 'produs')
  const defaultAuthor = authors.find((a) => a.slug === 'echipa-superieftin')?.id
  const defaultReviewer = authors.find((a) => a.slug === 'adrian')?.id
  const [authorId, setAuthorId] = useState(String(guide ? guide.author_id ?? '' : defaultAuthor ?? ''))
  const [reviewerId, setReviewerId] = useState(String(guide ? guide.reviewer_id ?? '' : defaultReviewer ?? ''))
  const [category, setCategory] = useState(guide?.category_slug ?? initial?.category_slug ?? '')
  const [products, setProducts] = useState<LinkedProduct[]>(guide?.products ?? initial?.products ?? [])
  const [summary, setSummary] = useState(guide?.summary ?? '')
  const [faq, setFaq] = useState<FaqItem[]>(guide?.faq ?? [])
  const [body, setBody] = useState(guide?.body_md ?? initial?.body_md ?? '')

  const [q, setQ] = useState('')
  const [results, setResults] = useState<(LinkedProduct & { offers: number })[]>([])
  const [searching, startSearch] = useTransition()
  const [preview, setPreview] = useState<ReactNode>(null)
  const [previewing, startPreview] = useTransition()
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const published = guide?.status === 'published'
  const effectiveSlug = slugTouched ? slug : slugify(title)

  function runSearch() {
    if (!q.trim()) return
    startSearch(async () => setResults(await searchGuideProductsAction(q)))
  }

  function addProduct(p: LinkedProduct) {
    setProducts((cur) => (cur.some((x) => x.id === p.id) ? cur : [...cur, { id: p.id, name: p.name, slug: p.slug }]))
  }

  function move(i: number, d: -1 | 1) {
    setProducts((cur) => {
      const next = [...cur]
      const j = i + d
      if (j < 0 || j >= next.length) return cur
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  // Insereaza un marcaj la pozitia cursorului din corpul Markdown, pe rand separat
  function insertMarker(marker: string) {
    const el = bodyRef.current
    const pos = el ? el.selectionStart : body.length
    const before = body.slice(0, pos)
    const after = body.slice(pos)
    const text = `${before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''}${marker}\n\n`
    setBody(before + text + after)
    requestAnimationFrame(() => {
      if (!el) return
      el.focus()
      el.selectionStart = el.selectionEnd = before.length + text.length
    })
  }

  function runPreview() {
    startPreview(async () => setPreview(await previewGuideAction(body)))
  }

  // Trimitem formularul manual (onSubmit), nu prin <form action>: dupa o actiune de server
  // React reseteaza formularele cu `action`, iar <select>-urile controlate revin in DOM la prima
  // optiune („—”) → urmatoarea salvare ar fi pierdut autorul, verificatorul si categoria.
  const [, startSave] = useTransition()
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const fd = new FormData(e.currentTarget, submitter)
    startSave(() => formAction(fd))
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {guide && <input type="hidden" name="id" value={guide.id} />}
      <input type="hidden" name="products" value={JSON.stringify(products.map((p) => p.id))} />
      <input type="hidden" name="faq" value={JSON.stringify(faq)} />

      <div className="flex flex-wrap items-center gap-3">
        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
          {published ? 'Publicat' : 'Ciornă'}
        </span>
        {published && guide && (
          <Link href={`/ghiduri/${guide.slug}`} target="_blank" className="text-sm text-brand hover:underline">Vezi pe site ↗</Link>
        )}
        {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
        {state?.message && <p className="text-sm text-green-700">{state.message}</p>}
      </div>

      <section className="bg-white border border-line rounded-xl p-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={label}>Titlu (H1)</label>
          <input name="title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} className={input} />
        </div>
        <div>
          <label className={label}>Slug (URL: /ghiduri/{effectiveSlug || '…'})</label>
          <input
            name="slug"
            value={effectiveSlug}
            onChange={(e) => { setSlug(e.target.value); setSlugTouched(true) }}
            className={input}
          />
          {published && <p className="text-[11px] text-amber-700 mt-1">Schimbarea slug-ului unui ghid publicat face vechiul URL să dea 404.</p>}
        </div>
        <div>
          <label className={label}>Tip</label>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as 'produs' | 'categorie')} className={input}>
            <option value="produs">Pe un produs („Merită X?”, „X vs Y”)</option>
            <option value="categorie">Pe categorie („Cele mai bune … sub N lei”)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Descriere meta ({meta.length}/160 recomandat)</label>
          <textarea name="meta_description" value={meta} onChange={(e) => setMeta(e.target.value)} rows={2} maxLength={300} className={input} />
        </div>
        <div>
          <label className={label}>Autor</label>
          <select name="author_id" value={authorId} onChange={(e) => setAuthorId(e.target.value)} className={input}>
            <option value="">—</option>
            {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Verificat de</label>
          <select name="reviewer_id" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)} className={input}>
            <option value="">—</option>
            {authors.filter((a) => a.kind === 'person').map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>Categorie (legătură spre /c/…, filtrul de pe /ghiduri)</label>
          <select name="category_slug" value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
            <option value="">— fără —</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
          {categories.find((c) => c.slug === category)?.label.startsWith('Sănătate') && (
            <p className="text-[11px] text-amber-700 mt-1">Sănătate & Naturale: fără afirmații de sănătate (vindecă, tratează, detoxifică…) — regula 8. Categoria e exclusă din reclame.</p>
          )}
        </div>
      </section>

      <section className="bg-white border border-line rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-sm">Produse legate</h2>
        <p className="text-xs text-muted">
          Apar în JSON-LD (Product), la finalul articolului și pe pagina lor de produs („Ghiduri despre acest produs”).
          Butoanele de lângă fiecare produs inserează marcaje live în corp, la poziția cursorului.
        </p>
        {products.length > 0 && (
          <ul className="divide-y divide-line border border-line rounded-lg">
            {products.map((p, i) => (
              <li key={p.id} className="p-2 text-sm flex flex-wrap items-center gap-2">
                <span className="flex-1 min-w-48">
                  <span className="text-muted text-xs mr-1">#{p.id}</span>{p.name}
                </span>
                {(['oferte', 'pret', 'reducere', 'istoric-pret'] as const).map((t) => (
                  <button key={t} type="button" onClick={() => insertMarker(`{{${t}:${p.id}}}`)} className="text-[11px] border border-line rounded px-1.5 py-0.5 hover:border-brand">
                    +{t}
                  </button>
                ))}
                <button type="button" onClick={() => move(i, -1)} className="text-xs px-1" aria-label="Mută sus">↑</button>
                <button type="button" onClick={() => move(i, 1)} className="text-xs px-1" aria-label="Mută jos">↓</button>
                <button type="button" onClick={() => setProducts(products.filter((x) => x.id !== p.id))} className="text-xs text-red-600 hover:underline">scoate</button>
              </li>
            ))}
          </ul>
        )}
        {products.length > 1 && (
          <button type="button" onClick={() => insertMarker(`{{comparatie:${products.slice(0, 6).map((p) => p.id).join(',')}}}`)} className="text-xs border border-line rounded px-2 py-1 hover:border-brand">
            + comparație între produsele legate
          </button>
        )}
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch() } }}
            placeholder="Caută produs după nume sau id…"
            className={input}
          />
          <button type="button" onClick={runSearch} disabled={searching} className={`${btn} border border-line bg-white hover:border-brand`}>
            {searching ? '…' : 'Caută'}
          </button>
        </div>
        {results.length > 0 && (
          <ul className="max-h-64 overflow-y-auto divide-y divide-line border border-line rounded-lg">
            {results.map((r) => (
              <li key={r.id} className="p-2 text-sm flex items-center gap-2">
                <span className="flex-1"><span className="text-muted text-xs mr-1">#{r.id}</span>{r.name}</span>
                <span className="text-xs text-muted whitespace-nowrap">{r.offers} oferte disp.</span>
                <button type="button" onClick={() => addProduct(r)} className="text-xs text-brand hover:underline" disabled={products.some((p) => p.id === r.id)}>
                  {products.some((p) => p.id === r.id) ? 'adăugat' : 'adaugă'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border border-line rounded-xl p-4">
        <label className={label}>Pe scurt (Markdown simplu, fără marcaje live) — 2–4 rânduri cu concluzia</label>
        <textarea name="summary" value={summary} onChange={(e) => setSummary(e.target.value)} rows={3} className={input} />
      </section>

      <section className="bg-white border border-line rounded-xl p-4 space-y-3">
        <label className={label}>Corpul articolului (Markdown; HTML-ul scris aici apare ca text, nu se execută)</label>
        <details className="text-xs text-muted">
          <summary className="cursor-pointer">Marcaje live (prețuri actualizate automat)</summary>
          <ul className="mt-1 list-disc pl-5 space-y-0.5">
            <li><code>{'{{oferte:ID}}'}</code> — ofertele disponibile, cu butoane spre magazine</li>
            <li><code>{'{{pret:ID}}'}</code> — cel mai mic preț de acum</li>
            <li><code>{'{{reducere:ID}}'}</code> — verdictul față de mediana 30 de zile</li>
            <li><code>{'{{istoric-pret:ID}}'}</code> — graficul de preț (90 de zile)</li>
            <li><code>{'{{comparatie:ID1,ID2,…}}'}</code> — tabel comparativ (max. 6)</li>
            <li>ID = id-ul produsului (#…) sau slug-ul din /p/…. Pune fiecare marcaj pe rând separat. Nu scrie prețuri sau procente de mână.</li>
          </ul>
        </details>
        <textarea ref={bodyRef} name="body_md" value={body} onChange={(e) => setBody(e.target.value)} rows={22} className={`${input} font-mono`} />
        <div className="flex items-center gap-3">
          <button type="button" onClick={runPreview} disabled={previewing} className={`${btn} border border-line bg-white hover:border-brand`}>
            {previewing ? 'Se randează…' : 'Previzualizează'}
          </button>
          <span className="text-xs text-muted">Randează textul nesalvat, cu prețurile de acum din baza de date.</span>
        </div>
        {preview && (
          <div className="border-2 border-dashed border-line rounded-xl p-5 bg-surface">
            <p className="text-[11px] uppercase tracking-wide text-muted mb-3">Previzualizare</p>
            {preview}
          </div>
        )}
      </section>

      <section className="bg-white border border-line rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm">Întrebări frecvente (FAQ)</h2>
          <button type="button" onClick={() => setFaq([...faq, { q: '', a: '' }])} className="text-xs text-brand hover:underline">+ întrebare</button>
        </div>
        {faq.map((f, i) => (
          <div key={i} className="grid gap-2 border border-line rounded-lg p-3">
            <input
              value={f.q}
              onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
              placeholder="Întrebare"
              className={input}
            />
            <textarea
              value={f.a}
              onChange={(e) => setFaq(faq.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}
              placeholder="Răspuns (text simplu)"
              rows={2}
              className={input}
            />
            <button type="button" onClick={() => setFaq(faq.filter((_, j) => j !== i))} className="justify-self-end text-xs text-red-600 hover:underline">șterge</button>
          </div>
        ))}
        {!faq.length && <p className="text-xs text-muted">Opțional. Întrebările complete apar pe pagină și în JSON-LD (FAQPage).</p>}
      </section>

      <div className="sticky bottom-0 bg-surface/95 backdrop-blur border-t border-line py-3 flex flex-wrap gap-3">
        {published ? (
          <>
            <button type="submit" name="intent" value="save" disabled={pending} className={`${btn} bg-brand text-white hover:opacity-90`}>
              Salvează modificările (live)
            </button>
            <button type="submit" name="intent" value="unpublish" disabled={pending} className={`${btn} border border-red-300 text-red-700 bg-white hover:bg-red-50`}>
              Retrage
            </button>
          </>
        ) : (
          <>
            <button type="submit" name="intent" value="save" disabled={pending} className={`${btn} border border-line bg-white hover:border-brand`}>
              Salvează ciornă
            </button>
            <button type="submit" name="intent" value="publish" disabled={pending} className={`${btn} bg-brand text-white hover:opacity-90`}>
              Publică
            </button>
          </>
        )}
        {pending && <span className="text-sm text-muted self-center">Se salvează…</span>}
      </div>
    </form>
  )
}
