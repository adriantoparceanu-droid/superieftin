// Fisa de verificare a ciornelor scrise de AI (guides.review_notes, migratia 024).
//
// INTERN: nu se afiseaza niciodata public (pagina ghidului, JSON-LD, llms.txt, sitemap).
// Importul: worker/src/scripts/import-guide-drafts.ts (formatul: content/ghiduri/README.md).

export interface ReviewFact {
  claim: string
  source_type: 'db' | 'web'
  source: string
  status: 'confirmat' | 'de_verificat'
  note?: string
}

export interface ReviewNotes {
  facts: ReviewFact[]
  checklist: string[]
  warnings: string[]
}

// Locurile nesigure din text sunt marcate de AI cu „[DE VERIFICAT: …]”. Cat timp exista vreunul
// in titlu / meta / rezumat / corp / FAQ, ghidul NU se poate publica (verificat si pe server).
export const UNVERIFIED_MARK = '[DE VERIFICAT'

export function countUnverified(text: string | null | undefined): number {
  return text ? text.split(UNVERIFIED_MARK).length - 1 : 0
}

// Campurile care mai contin marcaje, cu numarul lor — pentru mesaje clare („corp (3), FAQ (1)”).
export function unverifiedFields(fields: Record<string, string | null | undefined>): { field: string; count: number }[] {
  return Object.entries(fields)
    .map(([field, text]) => ({ field, count: countUnverified(text) }))
    .filter((f) => f.count > 0)
}

// Evidentiaza (galben) marcajele in HTML-ul deja randat de markdown-it. Sigur: textul din HTML e
// deja escapat (html: false) si expresia nu trece peste „<”, deci nu poate rupe etichete.
// Folosit doar in previzualizarea din admin.
export function highlightUnverified(html: string): string {
  return html.replace(/\[DE VERIFICAT[^\]<]*\]/g, (m) =>
    `<mark style="background:#fde047;padding:0 2px;border-radius:2px">${m}</mark>`)
}

export function isHttpUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim())
}
