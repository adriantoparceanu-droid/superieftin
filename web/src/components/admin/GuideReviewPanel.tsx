'use client'

import { isHttpUrl, type ReviewNotes } from '@/lib/guides/review'

// „Fișă de verificare” pentru ciornele scrise de AI (guides.review_notes, migratia 024).
// Arata ce afirmatii contine textul si de unde vin, ce avertismente a lasat AI-ul si un checklist.
// Starea casutelor e doar in browser (nu se salveaza): rostul ei e sa te oblige sa treci prin
// fiecare punct inainte de „Publică”, nu sa tina evidenta.
// INTERN: componenta apare doar in /admin — fisa nu ajunge niciodata pe pagina publica.

interface Props {
  notes: ReviewNotes
  generatedBy: string | null
  checked: boolean[]
  onToggle: (i: number) => void
  unverified: { field: string; count: number }[]
}

export function GuideReviewPanel({ notes, generatedBy, checked, onToggle, unverified }: Props) {
  const facts = notes.facts ?? []
  const warnings = notes.warnings ?? []
  const checklist = notes.checklist ?? []
  const todo = facts.filter((f) => f.status !== 'confirmat').length
  const done = checked.filter(Boolean).length

  return (
    <section className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 space-y-4">
      <div>
        <h2 className="font-semibold">Fișă de verificare</h2>
        <p className="text-xs text-amber-900 mt-0.5">
          Ciornă scrisă de AI{generatedBy ? ` (${generatedBy})` : ''}. Verifică afirmațiile marcate ⚠ la sursă,
          șterge fiecare <code className="bg-yellow-200 px-1 rounded">[DE VERIFICAT: …]</code> din text după ce ai verificat,
          apoi bifează checklist-ul. Fișa e internă — nu apare pe site.
        </p>
      </div>

      {facts.length > 0 && (
        <div className="bg-white border border-line rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-muted text-xs">
              <tr>
                <th className="px-3 py-2">Afirmație</th>
                <th className="px-3 py-2">Sursă</th>
                <th className="px-3 py-2 whitespace-nowrap">Status ({todo} de verificat)</th>
              </tr>
            </thead>
            <tbody>
              {facts.map((f, i) => {
                const ok = f.status === 'confirmat'
                return (
                  <tr key={i} className={`border-t border-line align-top ${ok ? '' : 'bg-amber-100'}`}>
                    <td className="px-3 py-2">
                      {f.claim}
                      {f.note && <div className="text-xs text-muted mt-0.5">{f.note}</div>}
                    </td>
                    <td className="px-3 py-2 text-xs break-words max-w-72">
                      <span className="inline-block text-[10px] uppercase tracking-wide text-muted mr-1">
                        {f.source_type === 'db' ? 'baza noastră' : 'web'}
                      </span>
                      {isHttpUrl(f.source) ? (
                        // rel: sursa e externa si scrisa de AI — nu transmitem referrer-ul adminului
                        <a href={f.source} target="_blank" rel="noopener noreferrer nofollow" className="text-brand underline underline-offset-2 break-all">
                          {f.source}
                        </a>
                      ) : (
                        <span>{f.source}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {ok
                        ? <span className="text-green-700 font-semibold">✓ confirmat</span>
                        : <span className="text-amber-800 font-semibold">⚠ de verificat</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {warnings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Avertismente</h3>
          <ul className="list-disc pl-5 text-sm space-y-0.5 text-amber-900">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      {checklist.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-1">Checklist înainte de publicare ({done}/{checklist.length})</h3>
          <ul className="space-y-1">
            {checklist.map((c, i) => (
              <li key={i}>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={!!checked[i]} onChange={() => onToggle(i)} className="mt-0.5 size-4 accent-brand" />
                  <span className={checked[i] ? 'text-muted line-through' : ''}>{c}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className={`text-sm ${unverified.length ? 'text-amber-900 font-semibold' : 'text-green-700'}`}>
        {unverified.length
          ? `Marcaje [DE VERIFICAT] rămase: ${unverified.map((u) => `${u.field} (${u.count})`).join(', ')}.`
          : 'Niciun marcaj [DE VERIFICAT] rămas în text.'}
      </p>
    </section>
  )
}
