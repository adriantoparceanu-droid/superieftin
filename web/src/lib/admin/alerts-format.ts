// Reguli pure pentru Admin → Alerte (fara baza de date, testate in alerts-format.test.ts).

// Adresa de email afisata MASCAT implicit in admin: „adrian@kidsport.ro” → „ad***@kidsport.ro”.
// Din partea locala pastram cel mult 2 caractere (1 la adresele scurte, 0 la cele de un caracter),
// iar „***” are lungime fixa, ca sa nu tradeze lungimea. Domeniul ramane vizibil (ajuta la
// recunoasterea abonarilor de test / a domeniilor de unica folosinta). Adresa intreaga apare doar
// la click pe „arată” (cerere separata la server, doar cu sesiune admin).
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at <= 0 || at === email.length - 1) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const keep = local.length >= 5 ? 2 : local.length >= 2 ? 1 : 0
  return `${local.slice(0, keep)}***@${domain}`
}

// Cat (in %) trebuie sa scada cel mai mic pret disponibil acum ca sa atinga pragul:
// 1000 lei acum, prag 900 → 10. Zero sau negativ = pretul e deja la / sub prag (alerta pleaca
// sau a plecat). null = fara oferta disponibila sau date invalide.
export function distanceToTargetPct(bestPrice: number | null, target: number | null): number | null {
  if (bestPrice == null || target == null || !Number.isFinite(bestPrice) || !Number.isFinite(target)) return null
  if (bestPrice <= 0 || target <= 0) return null
  return ((bestPrice - target) / bestPrice) * 100
}

// Text scurt pentru coloana „distanța până la prag”
export function formatDistance(pct: number | null): string {
  if (pct == null) return '—'
  if (pct <= 0) return 'atins'
  const rounded = Math.round(pct * 10) / 10
  return `−${rounded.toLocaleString('ro-RO', { maximumFractionDigits: 1 })}%`
}

// ---------- Parametrii din URL (lista de abonati, top produse) ----------

export type SubscriberStatus = 'toti' | 'confirmati' | 'neconfirmati'

export function parseSubscriberStatus(v: unknown): SubscriberStatus {
  return v === 'confirmati' || v === 'neconfirmati' ? v : 'toti'
}

// Pagina (1, 2, …) dintr-un parametru de URL; orice altceva → 1. Plafonat ca un URL ciudat
// sa nu ceara un OFFSET urias.
export function parsePage(v: unknown, max = 10_000): number {
  const s = Array.isArray(v) ? v[0] : v
  const n = typeof s === 'string' && /^\d{1,6}$/.test(s) ? parseInt(s, 10) : 1
  return Math.min(Math.max(n, 1), max)
}

// Cautarea dupa adresa: litere mici, fara spatii la capete, max 100 de caractere; gol → null
export function parseSearch(v: unknown): string | null {
  const s = Array.isArray(v) ? v[0] : v
  if (typeof s !== 'string') return null
  const t = s.trim().toLowerCase().slice(0, 100)
  return t || null
}

// Potrivire partiala in ILIKE: %, _ si \ din textul cautat se iau literal (ESCAPE '\')
export function likeContains(term: string): string {
  return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
}

export function totalPages(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage))
}
