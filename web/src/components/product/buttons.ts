// Clasele butoanelor de pe /p/ (macheta direcției B): 'primary' = roșu plin, DOAR pentru
// „Vezi oferta” (un singur buton roșu pe ecran — design §3); 'secondary' = contur.
// Mărimea e separată (nu suprascriem clase Tailwind între ele: ordinea din CSS ar decide, nu
// ordinea din atribut).

const common = 'inline-flex items-center justify-center gap-2 font-display font-extrabold focus-visible:outline-none'
const kinds = {
  primary: 'bg-red text-white shadow-[0_1px_0_rgba(0,0,0,.12),0_6px_16px_-6px_rgba(212,43,43,.6)] transition-colors hover:bg-red-hover focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2',
  secondary: 'bg-surface text-ink ring-[1.5px] ring-inset ring-line-2 transition-shadow hover:ring-ink focus-visible:ring-2 focus-visible:ring-ink',
}
const sizes = {
  lg: 'min-h-12 rounded-xl px-5 text-[16.5px]',
  sm: 'min-h-10 rounded-[10px] px-3.5 text-[14.5px]',
}

export function btn(kind: keyof typeof kinds, size: keyof typeof sizes = 'lg'): string {
  return `${common} ${kinds[kind]} ${sizes[size]}`
}
