import MarkdownIt from 'markdown-it'

// Randarea Markdown a ghidurilor — SIGURA prin configurare, nu prin curatare ulterioara:
// - html: false → orice HTML scris in Markdown (<script>, <iframe>, onclick=…) apare ca text,
//   nu se executa. Nu avem nevoie de sanitizer separat pentru ca nu lasam HTML sa intre deloc.
// - validateLink (implicit in markdown-it) respinge linkurile javascript:, vbscript:, file:, data:.
// De ce markdown-it: mic (5 dependente), matur, fara HTML brut cand html=false.
const md = new MarkdownIt({
  html: false,
  linkify: true,     // URL-urile scrise simplu devin linkuri
  typographer: false, // nu schimbam ghilimelele / liniutele din textul autorului
  breaks: false,
})

// Titlul articolului e singurul H1 al paginii → „# Titlu” din corp devine H2
md.renderer.rules.heading_open = (tokens, idx, options, _env, self) => {
  if (tokens[idx].tag === 'h1') tokens[idx].tag = 'h2'
  return self.renderToken(tokens, idx, options)
}
md.renderer.rules.heading_close = (tokens, idx, options, _env, self) => {
  if (tokens[idx].tag === 'h1') tokens[idx].tag = 'h2'
  return self.renderToken(tokens, idx, options)
}

// --- Ancore pe titlurile H2 (cuprinsul articolului) ---------------------------------------------
//
// Fiecare H2 din corp primeste un id stabil, facut din textul titlului, fara diacritice:
// „Cum alegi un laptop” → id="cum-alegi-un-laptop". Cuprinsul de sub „Pe scurt” leaga spre ele,
// iar Google poate afisa salturi direct la sectiune. Id-urile se pun pe tokeni (atribut, scapat de
// renderer) — HTML-ul brut ramane dezactivat.
//
// Activ DOAR cand apelantul trimite un `env` cu `headingIds` (corpul ghidului); „Pe scurt” si
// paginile fara cuprins raman neschimbate. Acelasi env pe toate bucatile Markdown ale unui articol
// = id-uri unice in toata pagina (un al doilea „Pret” devine „pret-2”).

export interface HeadingEnv {
  headingIds: Set<string>          // id-urile deja folosite in pagina (si cele rezervate)
  toc?: { id: string; text: string }[]   // completat cu H2-urile gasite, in ordine
}

// Id-uri folosite deja de pagina articolului (sectiunile fixe) — un titlu din corp nu le poate lua
export const RESERVED_HEADING_IDS = ['pe-scurt', 'cuprins', 'faq', 'produse', 'articole-inrudite']

export function newHeadingEnv(): HeadingEnv {
  return { headingIds: new Set(RESERVED_HEADING_IDS), toc: [] }
}

// Textul titlului → id: litere mici, fara diacritice (ș/ț cu virgula sau sedila), doar a-z 0-9 si „-”
export function headingSlug(text: string): string {
  const base = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '')
  if (!base) return 'sectiune'
  // „produs-…” e rezervat ancorelor cardurilor de produs (#produs-<slug>)
  return base.startsWith('produs-') ? `sectiune-${base}` : base
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`
  used.add(id)
  return id
}

md.core.ruler.push('heading_ids', (state) => {
  const env = state.env as Partial<HeadingEnv> | undefined
  if (!env?.headingIds) return
  const tokens = state.tokens
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    // h1 din corp se randeaza ca h2 (vezi mai sus) → intra si el in cuprins
    if (t.type !== 'heading_open' || (t.tag !== 'h1' && t.tag !== 'h2')) continue
    const inline = tokens[i + 1]
    const text = (inline?.children ?? [])
      .filter((c) => c.type === 'text' || c.type === 'code_inline')
      .map((c) => c.content)
      .join('')
      .trim()
    const id = uniqueId(headingSlug(text), env.headingIds)
    t.attrSet('id', id)
    env.toc?.push({ id, text })
  }
})

const SITE_HOSTS = ['superieftin.ro', 'www.superieftin.ro']

// Linkurile externe scrise de mana in text: se deschid in tab nou si NU transmit autoritate
// (nofollow). Linkurile spre magazine trebuie facute prin blocurile live ({{oferte:…}}), care
// trec prin /go/ (click_id + verificarea disponibilitatii) — nu prin linkuri directe.
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  const href = token.attrGet('href') ?? ''
  let external = false
  if (/^https?:\/\//i.test(href)) {
    try {
      external = !SITE_HOSTS.includes(new URL(href).hostname.toLowerCase())
    } catch {
      external = true
    }
  }
  if (external) {
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'nofollow noopener noreferrer')
  }
  return self.renderToken(tokens, idx, options)
}

// Imaginile din text: lazy, ca sa nu incetineasca incarcarea paginii
const defaultImage = md.renderer.rules.image!
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('loading', 'lazy')
  tokens[idx].attrSet('decoding', 'async')
  // regula implicita completeaza textul alternativ (alt) din Markdown
  return defaultImage(tokens, idx, options, env, self)
}

// env (optional) = ancorele H2 + cuprinsul; fara el, titlurile raman fara id
export function renderMarkdown(text: string, env?: HeadingEnv): string {
  return md.render(text, env ?? {})
}

// Doar cuprinsul (fara HTML): aceleasi id-uri ca la randare daca bucatile vin in aceeasi ordine
export function collectHeadings(texts: string[], env: HeadingEnv = newHeadingEnv()): { id: string; text: string }[] {
  env.toc = env.toc ?? []
  for (const t of texts) md.parse(t, env)
  return env.toc
}

// Text simplu (fara marcaje Markdown) — pentru descrieri scurte si llms.txt
export function stripMarkdown(text: string): string {
  return text
    .replace(/\{\{[^{}]*\}\}/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
