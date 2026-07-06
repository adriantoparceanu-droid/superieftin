import { NextRequest } from 'next/server'
import pool from '@/lib/db'

export const dynamic = 'force-dynamic'

// Serveste HTML-ul unui banner ca pagina de sine statatoare, pentru a fi incarcat intr-un
// iframe (vezi RawEmbed). Codurile de afiliere care folosesc document.write (ex. Profitshare
// pe mod sincron) functioneaza doar intr-un document incarcat normal — nu injectat dupa load.
// Pagina isi raporteaza inaltimea catre parinte prin postMessage, ca sa ajustam iframe-ul.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const page = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;padding:0}#__b{display:flex;justify-content:center;align-items:center;flex-wrap:wrap}</style>
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
  function report(){
    var h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    parent.postMessage({ __banner: ${bannerId}, height: h }, '*');
  }
  window.addEventListener('load', report);
  var n = 0, t = setInterval(function(){ report(); if(++n > 15) clearInterval(t); }, 400);
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
