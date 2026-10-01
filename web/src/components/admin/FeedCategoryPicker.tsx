'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  scanFeedCategoriesAction, saveFeedCategoryFilterAction, createMappingRuleAction,
  createCategoryAndMapFeedAction, createNameRuleFromFeedAction, createCategoryAndNameRuleAction,
} from '@/lib/admin/actions'
import { firstMatchingRule, normalizeName, termsPattern, type NameRuleForMatch } from '@/lib/admin/nameMatch'
import type { FeedScanResult, FeedCategoryInfo } from '@/lib/admin/feed-categories'
import type { CategoryOption } from '@/lib/admin/queries'

// „Alege categoriile” pentru un feed 2Performant (Admin → Surse feed).
// Pasul 1: descarca feed-ul la cerere si arata categoriile lui (cu numarul de produse si
// daca sunt mapate pe o categorie de site). Pasul 2: bifezi ce vrei importat si salvezi —
// workerul importa de la urmatoarea sincronizare doar categoriile bifate.

// Aceeasi normalizare ca la import (worker/src/lib/feed-category-filter.ts)
const norm = (s: string) => s.trim().toLowerCase()
const fmt = (n: number) => n.toLocaleString('ro-RO')

type Parent = { id: number; name: string }

export default function FeedCategoryPicker({
  feedId, categoryOptions, parents,
}: { feedId: number; categoryOptions: CategoryOption[]; parents: Parent[] }) {
  const [result, setResult] = useState<FeedScanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null); setMessage(null)
    try {
      const res = await scanFeedCategoriesAction(feedId)
      if ('error' in res) { setError(res.error); return }
      setResult(res)
      setChecked(new Set(res.categories.filter((c) => c.selected).map((c) => norm(c.name))))
    } catch {
      setError('Eroare neașteptată la descărcarea feed-ului.')
    } finally {
      setLoading(false)
    }
  }

  // Dupa „Mapează” / „Creează categorie” actualizam doar randul respectiv (fara re-descarcare)
  function setMapping(name: string, mapping: FeedCategoryInfo['mapping']) {
    setResult((r) => r && { ...r, categories: r.categories.map((c) => (c.name === name ? { ...c, mapping } : c)) })
  }

  const selectedProducts = useMemo(
    () => result?.categories.filter((c) => checked.has(norm(c.name))).reduce((s, c) => s + c.count, 0) ?? 0,
    [result, checked],
  )

  async function save(mode: 'all' | 'list') {
    if (!result) return
    const names = result.categories.filter((c) => checked.has(norm(c.name))).map((c) => c.name)
    if (mode === 'list' && names.length === 0
      && !confirm('Nicio categorie bifată — feed-ul nu va mai importa nimic. Continui?')) return
    setSaving(true); setMessage(null); setError(null)
    try {
      const res = await saveFeedCategoryFilterAction(feedId, mode, names)
      if ('error' in res) { setError(res.error); return }
      setMessage(mode === 'all'
        ? 'Salvat: se importă toate categoriile (inclusiv cele care apar pe viitor în feed).'
        : `Salvat: ${names.length} ${names.length === 1 ? 'categorie' : 'categorii'} (${fmt(selectedProducts)} produse). Se aplică la următoarea sincronizare.`)
      setResult((r) => r && { ...r, filterMode: mode === 'all' ? 'all' : names.length ? 'list' : 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (!result) {
    return (
      <div>
        <button
          type="button" onClick={load} disabled={loading}
          className="border border-brand text-brand text-xs font-semibold rounded-lg px-3 py-1 hover:bg-brand-light disabled:opacity-60"
        >
          {loading ? 'Se descarcă feed-ul… (poate dura 1–2 minute)' : 'Alege categoriile'}
        </button>
        {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
      </div>
    )
  }

  const all = result.categories
  return (
    <div className="border border-line rounded-xl p-4 bg-page">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="text-sm">
          <strong>{fmt(result.total)} produse</strong> în feed, în {all.filter((c) => c.count > 0).length} categorii
          {' · '}magazin: {result.retailer
            ? <strong>{result.retailer.name}</strong>
            : <span className="text-amber-700">{result.domain ?? 'necunoscut'} (magazin nou)</span>}
          <div className="text-xs text-muted">
            Bifează ce vrei să importe workerul. Categoriile debifate <strong>nu se șterg</strong>: ofertele lor nu mai
            sunt actualizate și devin „fără stoc” singure după 3 zile.
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <button type="button" onClick={() => setChecked(new Set(all.map((c) => norm(c.name))))} className="underline">Bifează tot</button>
          <button type="button" onClick={() => setChecked(new Set())} className="underline">Debifează tot</button>
          <button type="button" onClick={load} disabled={loading} className="underline">{loading ? 'Se descarcă…' : 'Reîncarcă'}</button>
          <button type="button" onClick={() => { setResult(null); setMessage(null) }} className="text-muted">închide ✕</button>
        </div>
      </div>

      <div className="bg-white border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface text-left text-muted text-xs">
            <tr>
              <th className="px-3 py-2 w-8"></th>
              <th className="px-3 py-2">Categorie în feed</th>
              <th className="px-3 py-2 text-right">Produse</th>
              <th className="px-3 py-2">Mapare pe site</th>
            </tr>
          </thead>
          <tbody>
            {all.map((c) => {
              const key = norm(c.name)
              return (
                <tr key={key || '(gol)'} className="border-t border-line align-top">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox" checked={checked.has(key)}
                      onChange={(e) => setChecked((s) => {
                        const n = new Set(s)
                        if (e.target.checked) n.add(key); else n.delete(key)
                        return n
                      })}
                      aria-label={`Importă ${c.name || 'produsele fără categorie'}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {c.name || <span className="italic text-muted">(fără categorie în feed)</span>}
                    {c.count === 0 && <div className="text-xs text-amber-700 font-normal">nu mai apare în feed (rămâne în filtru dacă e bifată)</div>}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmt(c.count)}</td>
                  <td className="px-3 py-2">
                    {!c.name && result.uncategorized ? (
                      <UncategorizedCell
                        titles={result.uncategorized.titles} total={result.uncategorized.total}
                        capped={result.uncategorized.capped} rules={result.nameRules}
                        retailer={result.retailer} categoryOptions={categoryOptions} parents={parents}
                        onRulesChanged={(rules) => setResult((r) => r && { ...r, nameRules: rules })}
                      />
                    ) : (
                      <MappingCell
                        info={c} retailer={result.retailer} categoryOptions={categoryOptions} parents={parents}
                        onMapped={(m) => setMapping(c.name, m)}
                      />
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button
          type="button" onClick={() => save('list')} disabled={saving}
          className="bg-brand text-white text-sm font-semibold rounded-lg px-4 py-1.5 hover:opacity-90 disabled:opacity-60"
        >
          {saving ? 'Se salvează…' : `Salvează (${checked.size} ${checked.size === 1 ? 'categorie' : 'categorii'} · ${fmt(selectedProducts)} produse)`}
        </button>
        <button
          type="button" onClick={() => save('all')} disabled={saving}
          className="border border-line text-sm rounded-lg px-4 py-1.5 bg-white disabled:opacity-60"
          title="Fără filtru: se importă tot feed-ul, inclusiv categoriile noi care apar pe viitor"
        >
          Importă toate categoriile (fără filtru)
        </button>
        {message && <span className="text-sm text-green-700">{message}</span>}
        {error && <span className="text-sm text-red-700">{error}</span>}
      </div>
    </div>
  )
}

// Coloana „Mapare pe site” pentru o categorie din feed
function MappingCell({
  info, retailer, categoryOptions, parents, onMapped,
}: {
  info: FeedCategoryInfo
  retailer: FeedScanResult['retailer']
  categoryOptions: CategoryOption[]
  parents: Parent[]
  onMapped: (m: FeedCategoryInfo['mapping']) => void
}) {
  const [categoryId, setCategoryId] = useState(info.suggestion ? String(info.suggestion.categoryId) : '')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState(info.name)
  const [newParent, setNewParent] = useState(info.suggestion?.parentId ? String(info.suggestion.parentId) : '')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  if (info.mapping) {
    return (
      <div>
        <span className="inline-block rounded-full bg-green-100 text-green-800 text-xs font-semibold px-2 py-0.5">
          Mapată → {info.mapping.label}
        </span>
        {info.mapping.scope === 'global' && <span className="text-xs text-muted ml-1">(regulă globală)</span>}
        {note && <div className="text-xs text-green-700 mt-1">{note}</div>}
      </div>
    )
  }

  // Cate produse din categorie prind regulile „dupa denumire” (Admin → Mapare)
  const byName = (
    <>
      {info.ignoredByName > 0 && (
        <div className="text-xs text-red-700 mt-1">
          {info.ignoredByName === info.count
            ? `Toate cele ${fmt(info.count)} produse sunt ignorate de regulile după denumire — nu se importă oricum.`
            : `${fmt(info.ignoredByName)} din ${fmt(info.count)} produse sunt ignorate de regulile după denumire.`}
        </div>
      )}
      {info.mappedByName > 0 && (
        <div className="text-xs text-muted mt-1">{fmt(info.mappedByName)} din {fmt(info.count)} produse primesc categorie după denumire.</div>
      )}
    </>
  )

  if (!info.name) {
    return (
      <div className="text-xs text-muted">
        Feed-ul nu are categorie pentru aceste produse — se pot mapa doar după denumire (Admin → Mapare categorii).
        {byName}
      </div>
    )
  }

  async function map() {
    if (!retailer || !categoryId) return
    setBusy(true); setErr(null)
    try {
      // Aceeasi actiune ca in Admin → Mapare: regula magazinului + aplicare pe produsele existente
      const fd = new FormData()
      fd.set('feed_category', info.name)
      fd.set('retailer_id', String(retailer.id))
      fd.set('category_id', categoryId)
      await createMappingRuleAction(fd)
      const label = categoryOptions.find((o) => String(o.id) === categoryId)?.label ?? ''
      onMapped({ categoryId: Number(categoryId), label, scope: 'retailer' })
    } catch {
      setErr('Maparea a eșuat.')
    } finally {
      setBusy(false)
    }
  }

  async function createAndMap() {
    if (!retailer || !newName.trim() || !newParent) return
    setBusy(true); setErr(null)
    try {
      const res = await createCategoryAndMapFeedAction({
        feedCategory: info.name, retailerId: retailer.id, name: newName,
        parentId: newParent === 'root' ? null : Number(newParent),
      })
      if ('error' in res) { setErr(res.error); return }
      setNote(res.existed
        ? `Există deja categoria „${res.label}” — am mapat pe ea.`
        : `Categoria „${res.label}” a fost creată (și adăugată în meniu).`)
      onMapped({ categoryId: res.categoryId, label: res.label, scope: 'retailer' })
    } catch {
      setErr('Crearea categoriei a eșuat.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-1">
      <span className="inline-block rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5">Nemapată</span>
      <div className="text-xs text-muted">Produsele ar veni pe site fără categorie — nu apar în meniu până le mapezi.</div>
      {byName}
      {info.suggestion && (
        <div className="text-xs">Poate fi mapată în: <strong>{info.suggestion.label}</strong></div>
      )}
      {!retailer ? (
        <div className="text-xs text-amber-700">Magazin nou — maparea devine disponibilă după primul import.</div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select
              value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className="border border-line rounded-lg px-2 py-1 text-xs max-w-64"
            >
              <option value="">— alege categoria site —</option>
              {categoryOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
            <button
              type="button" onClick={map} disabled={busy || !categoryId}
              className="bg-brand text-white text-xs font-semibold rounded-lg px-3 py-1 disabled:opacity-50"
              title={`Regulă doar pentru ${retailer.name}; se aplică și pe produsele deja importate`}
            >
              Mapează
            </button>
            <button type="button" onClick={() => setCreating((v) => !v)} className="text-xs text-brand underline">
              {creating ? 'renunță' : '+ Creează categorie nouă'}
            </button>
          </div>
          {creating && (
            <div className="border border-line rounded-lg p-2 mt-1 space-y-1 bg-white">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={100}
                  placeholder="Numele categoriei" className="border border-line rounded-lg px-2 py-1 text-xs w-48"
                />
                <ParentSelect value={newParent} onChange={setNewParent} parents={parents} />
                <button
                  type="button" onClick={createAndMap} disabled={busy || !newName.trim() || !newParent}
                  className="bg-brand text-white text-xs font-semibold rounded-lg px-3 py-1 disabled:opacity-50"
                >
                  Creează și mapează
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {busy && <div className="text-xs text-muted">Se salvează…</div>}
      {err && <div className="text-xs text-red-700">{err}</div>}
    </div>
  )
}

// Selectul de parinte pentru „Creează categorie nouă” + atentionarea la categorie principala
function ParentSelect({ value, onChange, parents }: { value: string; onChange: (v: string) => void; parents: Parent[] }) {
  return (
    <>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="border border-line rounded-lg px-2 py-1 text-xs">
        <option value="">— alege părintele din meniu —</option>
        {parents.map((p) => <option key={p.id} value={p.id}>sub {p.name}</option>)}
        <option value="root">fără părinte (categorie principală nouă)</option>
      </select>
      {value === 'root' && (
        <div className="text-xs text-amber-700 w-full">
          Atenție: adaugă încă o categorie principală în meniul de sus (acum sunt {parents.length}).
        </div>
      )}
    </>
  )
}

type Compiled = NameRuleForMatch & { re: RegExp }
const compile = (rules: NameRuleForMatch[]): Compiled[] => rules.map((r) => ({ ...r, re: new RegExp(r.pattern) }))

// Randul „(fără categorie în feed)”: feed-ul nu spune ce e produsul, deci singura cale e
// maparea dupa DENUMIRE (name_category_rules). Aratam ce fac regulile existente cu aceste
// produse si permitem o regula noua, cu previzualizare pe denumirile din feed. Potrivirea e
// aceeasi ca la import (firstMatchingRule = matchNameRule din worker).
function UncategorizedCell({
  titles, total, capped, rules, retailer, categoryOptions, parents, onRulesChanged,
}: {
  titles: string[]; total: number; capped: boolean; rules: NameRuleForMatch[]
  retailer: FeedScanResult['retailer']; categoryOptions: CategoryOption[]; parents: Parent[]
  onRulesChanged: (rules: NameRuleForMatch[]) => void
}) {
  const [terms, setTerms] = useState('')
  const [action, setAction] = useState<'map' | 'ignore'>('map')
  const [target, setTarget] = useState('')            // id categorie | '__new'
  const [newName, setNewName] = useState('')
  const [newParent, setNewParent] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const retailerId = retailer?.id ?? null

  // 1. Ce fac regulile existente cu produsele fara categorie
  const stats = useMemo(() => {
    const compiled = compile(rules)
    let ignored = 0, unmapped = 0
    const byCategory = new Map<string, number>()
    for (const t of titles) {
      const r = firstMatchingRule(compiled, retailerId, t)
      if (!r) unmapped++
      else if (r.action === 'ignore') ignored++
      else {
        const label = r.categoryLabel ?? '?'
        byCategory.set(label, (byCategory.get(label) ?? 0) + 1)
      }
    }
    const mapped = [...byCategory.values()].reduce((a, b) => a + b, 0)
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    return { mapped, ignored, unmapped, top, categories: byCategory.size }
  }, [titles, rules, retailerId])

  // 3. Previzualizarea regulii noi: cate denumiri contin termenii si cate ar prinde EFECTIV
  // (regulile existente cu prioritate mai mare — inclusiv cele mai vechi, la aceeasi
  // prioritate 100 — castiga primele, ca la import)
  const preview = useMemo(() => {
    const pattern = termsPattern(terms)
    if (!pattern || retailerId == null) return null
    const re = new RegExp(pattern)
    const draft: Compiled = { id: -1, retailerId, action, categoryId: null, categoryLabel: null, priority: 100, pattern, re }
    const compiled = compile(rules)
    const at = compiled.findIndex((r) => r.priority > 100)
    const withDraft = at === -1 ? [...compiled, draft] : [...compiled.slice(0, at), draft, ...compiled.slice(at)]
    const matches = titles.filter((t) => re.test(normalizeName(t)))
    const effective = matches.filter((t) => firstMatchingRule(withDraft, retailerId, t) === draft)
    const step = Math.max(1, Math.floor(effective.length / 8))
    return { matches: matches.length, effective: effective.length, examples: effective.filter((_, i) => i % step === 0).slice(0, 8) }
  }, [terms, action, titles, rules, retailerId])

  const canSave = !!preview && preview.effective > 0 && !busy && (action === 'ignore'
    || (target && target !== '__new')
    || (target === '__new' && newName.trim() && newParent))

  async function save() {
    if (!retailer || !preview || !canSave) return
    setBusy(true); setErr(null); setNote(null)
    try {
      let label: string
      let fresh: NameRuleForMatch[]
      if (action === 'map' && target === '__new') {
        const res = await createCategoryAndNameRuleAction({
          terms, retailerId: retailer.id, name: newName, parentId: newParent === 'root' ? null : Number(newParent),
        })
        if ('error' in res) { setErr(res.error); return }
        label = res.existed ? `„${res.label}” (exista deja — am folosit-o)` : `„${res.label}” (categorie nouă, adăugată în meniu)`
        fresh = res.rules
      } else {
        // Aceeasi actiune ca in Admin → Mapare (createNameRuleAction, pe server): regula
        // magazinului, aplicata imediat pe produsele nemapate existente (map) sau
        // ascunzandu-le ofertele (ignore)
        const res = await createNameRuleFromFeedAction({
          terms, action, categoryId: action === 'map' ? Number(target) : null, retailerId: retailer.id,
        })
        if ('error' in res) { setErr(res.error); return }
        label = action === 'ignore' ? 'ignorate' : `„${categoryOptions.find((o) => String(o.id) === target)?.label ?? ''}”`
        fresh = res.rules
      }
      setNote(`Regula „${terms}” salvată → ${label}: prinde ${fmt(preview.effective)} produse din acest feed.`)
      onRulesChanged(fresh)
      setTerms(''); setTarget(''); setNewName(''); setNewParent('')
    } catch {
      setErr('Salvarea regulii a eșuat.')
    } finally {
      setBusy(false)
    }
  }

  const base = titles.length
  return (
    <div className="space-y-1 text-xs">
      <div className="text-muted">
        Feed-ul nu are categorie pentru aceste produse — se mapează doar <strong>după denumire</strong>.
      </div>
      <div>
        Cu regulile după denumire de acum{capped ? ` (calculat pe primele ${fmt(base)} din ${fmt(total)} — plafon atins)` : ''}:{' '}
        <span className="text-green-700 font-semibold">{fmt(stats.mapped)} mapate</span>
        {' · '}<span className="text-red-700 font-semibold">{fmt(stats.ignored)} ignorate</span>
        {' · '}<span className="text-amber-700 font-semibold">{fmt(stats.unmapped)} rămân nemapate</span>
      </div>
      {stats.top.length > 0 && (
        <div className="text-muted">
          Ar ajunge în: {stats.top.map(([l, n]) => `${l} (${fmt(n)})`).join(', ')}
          {stats.categories > stats.top.length ? ` și încă ${stats.categories - stats.top.length}` : ''}
        </div>
      )}
      {retailer ? (
        <Link href={`/admin/mapare?magazin=${retailer.id}#reguli-denumire`} className="text-brand underline">
          Regulile după denumire ale {retailer.name} în Admin → Mapare →
        </Link>
      ) : (
        <div className="text-amber-700">Magazin nou — maparea devine disponibilă după primul import.</div>
      )}
      {note && <div className="text-green-700">{note}</div>}

      {retailer && (
        <div className="border border-line rounded-lg p-2 mt-1 space-y-2 bg-white">
          <div className="font-semibold">Regulă nouă: denumirea conține…</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={500}
              placeholder="ex. cartus, toner (cuvinte întregi, separate prin virgulă)"
              className="border border-line rounded-lg px-2 py-1 text-xs w-72"
            />
            <select value={action} onChange={(e) => setAction(e.target.value as 'map' | 'ignore')} className="border border-line rounded-lg px-2 py-1 text-xs">
              <option value="map">→ mapează în…</option>
              <option value="ignore">→ ignoră (nu le importa)</option>
            </select>
            {action === 'map' && (
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="border border-line rounded-lg px-2 py-1 text-xs max-w-64">
                <option value="">— alege categoria site —</option>
                {categoryOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                <option value="__new">+ Creează categorie nouă…</option>
              </select>
            )}
          </div>
          {action === 'map' && target === '__new' && (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={100}
                placeholder="Numele categoriei noi" className="border border-line rounded-lg px-2 py-1 text-xs w-48"
              />
              <ParentSelect value={newParent} onChange={setNewParent} parents={parents} />
            </div>
          )}
          {terms.trim() && !preview && <div className="text-red-700">Scrie cel puțin un termen.</div>}
          {preview && (
            <div className="rounded bg-page border border-line p-2">
              <div>
                Prinde <strong>{fmt(preview.effective)}</strong> din produsele fără categorie ale acestui feed
                {preview.matches > preview.effective && ` (${fmt(preview.matches)} conțin termenii; ${fmt(preview.matches - preview.effective)} sunt deja prinse de reguli mai vechi, care au prioritate)`}
                {capped && ` — din primele ${fmt(base)}`}.
              </div>
              {preview.examples.length > 0 && (
                <ul className="list-disc pl-5 mt-1 text-muted">
                  {preview.examples.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              )}
              {action === 'ignore' && preview.effective > 0 && (
                <div className="text-amber-700 mt-1">
                  „Ignoră” ascunde imediat și ofertele deja importate (nemapate) ale {retailer.name} care se potrivesc.
                </div>
              )}
            </div>
          )}
          <button
            type="button" onClick={save} disabled={!canSave}
            className="bg-brand text-white text-xs font-semibold rounded-lg px-3 py-1 disabled:opacity-50"
          >
            {busy ? 'Se salvează…' : action === 'ignore' ? 'Salvează regula (ignoră)' : 'Salvează regula și mapează'}
          </button>
          {err && <div className="text-red-700">{err}</div>}
        </div>
      )}
    </div>
  )
}
