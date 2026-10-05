import { NextRequest } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

// Serveste HTML-ul unui banner ca pagina de sine statatoare, pentru a fi incarcat intr-un
// iframe (vezi RawEmbed). Codurile de afiliere care folosesc document.write (ex. Profitshare
// pe mod sincron) functioneaza doar intr-un document incarcat normal — nu injectat dupa load.
// Pagina isi raporteaza inaltimea continutului catre parinte prin postMessage, ca sa ajustam
// iframe-ul. Imaginile se micsoreaza la latimea iframe-ului (max-width), fara sa fie taiate.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bannerId = Number(id)
  if (!bannerId) return new Response('Not found', { status: 404 })

  const { rows } = await pool.query<{ html: string | null }>(
    "SELECT html FROM banners WHERE id = $1 AND type = 'html' AND is_active = true",
    [bannerId]
  )
  const html = rows[0]?.html
  if (!html) return new Response('Not found', { status: 404 })

  // Shim pentru document.write: scripturile externe de afiliere (ex. Profitshare sincron)
  // ruleaza dupa ce documentul s-a inchis, cand document.write nativ e ignorat. Il inlocuim
  // cu o inserare in DOM (#__b), care functioneaza oricand. Trebuie instalat INAINTE de codul
  // bannerului, iar containerul sa existe deja (pentru getElementById-ul de dupa write).
  // color-scheme „light dark”: fără el, în modul întunecat Chrome pune o pânză ALBĂ opacă sub
  // iframe (schema documentului diferă de a paginii) → margini albe în jurul widgetului.
  // ?fill=1 (bannerul mare de pe homepage): imaginile iau toată lățimea iframe-ului, și peste
  // dimensiunea lor naturală (ex. 1170 px într-o casetă de 1246 px), ca să nu rămână o bandă goală
  const fill = req.nextUrl.searchParams.get('fill') === '1'
  const page = `<!doctype html><html><head><meta charset="utf-8"><meta name="color-scheme" content="light dark">
<style>html,body{margin:0;padding:0;background:transparent}#__b{display:flex;justify-content:center;align-items:center;flex-wrap:wrap}img{max-width:100%;height:auto;vertical-align:top}${fill ? 'img{width:100%}' : ''}</style>
</head><body>
<div id="__b"></div>
<script>
(function(){
  var t = document.getElementById('__b');
  document.write = function(s){ t.insertAdjacentHTML('beforeend', s); };
  document.writeln = function(s){ t.insertAdjacentHTML('beforeend', s + '\\n'); };
})();
</script>
${html}
<script>
(function(){
  // Inaltimea CONTINUTULUI (body), nu a documentului: documentElement.scrollHeight e cel putin
  // cat iframe-ul insusi, deci nu scadea niciodata sub inaltimea initiala (260 px) — de aici
  // golul alb de ~200 px de sub widgeturile Profitshare de 468x60 (masurat pe productie, 5 oct 2026).
  function report(){
    var h = Math.ceil(document.body.getBoundingClientRect().height);
    parent.postMessage({ __banner: ${bannerId}, height: h }, '*');
  }
  window.addEventListener('load', report);
  // Widgeturile isi construiesc continutul tarziu (scripturi externe, imagini) → urmarim schimbarile
  if (window.ResizeObserver) new ResizeObserver(report).observe(document.body);
  var n = 0, t = setInterval(function(){ report(); if(++n > 25) clearInterval(t); }, 400);
})();
</script>
</body></html>`

  return new Response(page, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex',
      'cache-control': 'no-store',
    },
  })
}
