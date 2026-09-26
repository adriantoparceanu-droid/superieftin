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

export function renderMarkdown(text: string): string {
  return md.render(text)
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
