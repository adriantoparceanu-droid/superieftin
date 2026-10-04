// Tipografia de articol (redesign, design §3–§4 „Restul”) — folosită de ghiduri (corpul Markdown,
// „Pe scurt”) și de paginile de încredere (LegalPage: Despre, Contact, Confidențialitate, Termeni,
// Cookies, Metodologie, alerte). Un singur loc, ca ghidurile și politicile să arate la fel.
//
// De ce clase pe elementele-copil ([&_h2]…) și nu pluginul Tailwind Typography: nu adăugăm
// librării, iar Markdown-ul ghidurilor vine ca HTML gata făcut (nu putem pune clase pe fiecare tag).
// Totul e pe tokeni (text-ink, border-line, bg-surface-2…) → corect și în modul întunecat.
//
// Lățimea de citire (~65–72 de caractere pe rând) o dă containerul (ARTICLE_CARD), nu textul:
// blocurile live din ghiduri (oferte, grafic, tabel) stau în aceeași coloană.
export const ARTICLE_PROSE = `text-[16px] leading-[1.65] text-ink-2 sm:text-[17px] space-y-4 [&>*:first-child]:mt-0
  [&_strong]:font-semibold [&_strong]:text-ink
  [&_h2]:mt-9 [&_h2]:text-[21px] [&_h2]:leading-tight [&_h2]:text-ink sm:[&_h2]:text-[24px]
  [&_h3]:mt-7 [&_h3]:text-[18px] [&_h3]:leading-snug [&_h3]:text-ink sm:[&_h3]:text-[19px]
  [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5
  [&_li]:pl-0.5 [&_li]:marker:text-ink-3
  [&_a]:text-red-ink [&_a]:underline [&_a]:decoration-1 [&_a]:underline-offset-[3px] [&_a:hover]:decoration-2
  [&_blockquote]:rounded-r-lg [&_blockquote]:border-l-[3px] [&_blockquote]:border-line-2 [&_blockquote]:bg-surface-2 [&_blockquote]:px-4 [&_blockquote]:py-2.5 [&_blockquote]:text-ink-2
  [&_code]:rounded [&_code]:bg-surface-2 [&_code]:px-1 [&_code]:text-[.9em] [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-2 [&_pre]:p-3
  [&_hr]:border-line
  [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-xl
  [&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-[14px] [&_table]:leading-normal
  [&_thead_th]:bg-surface-2 [&_thead_th]:text-[13px] [&_thead_th]:font-bold [&_thead_th]:text-ink-2
  [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:align-top [&_th]:font-semibold [&_th]:text-ink
  [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top [&_tr]:border-b [&_tr]:border-line`
// Tabelul are `display:block` + `overflow-x:auto`: pe telefon un tabel lat se derulează în
// interiorul lui, fără să lățească pagina (scroll orizontal pe tot site-ul).

// Cardul care ține articolul: aceeași formă ca pe /p/ (rounded-2xl, umbră), lățime de citire.
export const ARTICLE_CARD = 'mx-auto max-w-[46rem] rounded-2xl bg-surface p-4 shadow-card sm:p-8'

// Titlul paginii (H1): Archivo semi-condensat (stratul base din globals.css), mare și strâns
export const ARTICLE_H1 = 'text-[26px] font-extrabold leading-[1.1] text-ink sm:text-[34px]'

// Butonul de acțiune de pe paginile fără ofertă (confirmare alertă, căutare 404…): plin, dar
// CĂRBUNE, nu roșu — pe ecran singurul buton roșu plin e „Vezi oferta” (design §3).
export const INK_BUTTON = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 font-display text-[16px] font-extrabold text-[var(--bg)] transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2'

// Butonul contur (acțiuni secundare: „Salvează”, „Setări cookies”…)
export const OUTLINE_BUTTON = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] bg-surface px-3.5 text-[14.5px] font-bold text-ink ring-[1.5px] ring-inset ring-line-2 transition-shadow hover:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink'
