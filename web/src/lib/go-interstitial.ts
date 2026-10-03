// Pagina intermediara pentru /go/[offerId] cand cererea NU are un token valid (vezi go-token.ts).
//
// Cine ajunge aici:
//   - robotii care nu ruleaza JavaScript → raman aici: niciun click inregistrat, nimic trimis la retea;
//   - vizitatori reali al caror token nu a fost gata la click (link deschis in tab nou inainte sa
//     se incarce tokenul, link vechi / distribuit, middle-click foarte rapid) → scriptul de mai jos
//     cere imediat un token si continua singur spre magazin (o fractiune de secunda);
//   - vizitatori fara JavaScript → apasa „Continua spre magazin”: formularul (POST) trimite tokenul
//     de formular din HTML, valabil dupa GO_FORM_MIN_AGE_S secunde.
//
// HTML minimal, scris de mana (fara layout-ul site-ului): raspuns rapid si ieftin chiar daca un
// robot cere mii de astfel de pagini. noindex: nu are ce cauta in Google.

export interface InterstitialData {
  offerId: number
  productName: string
  retailerName: string
  productSlug: string
  formToken: string | null      // null = fara secret pe server (nu se intampla cand verificarea e activa)
  tooFast?: boolean             // formularul a fost trimis prea repede → rugam sa mai apese o data
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export function renderInterstitial(d: InterstitialData): string {
  const id = String(d.offerId)
  const productUrl = `/p/${encodeURIComponent(d.productSlug)}`
  const note = d.tooFast
    ? '<p class="note">Mai apasă o dată butonul de mai jos.</p>'
    : ''
  return `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Spre magazin — superieftin.ro</title>
<style>
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#F7FAFC;color:#1A202C}
  main{max-width:28rem;margin:12vh auto 0;padding:2rem 1.5rem;background:#fff;border:1px solid #E2E8F0;border-radius:12px;text-align:center}
  h1{font-size:1.15rem;margin:0 0 .5rem}
  p{color:#718096;margin:.5rem 0 1.25rem;line-height:1.5}
  .note{color:#C53030}
  button{font:inherit;font-weight:600;background:#E53E3E;color:#fff;border:0;border-radius:8px;padding:.8rem 1.5rem;cursor:pointer;width:100%}
  button:hover{background:#C53030}
  a{color:#718096;font-size:.9rem}
</style>
</head>
<body>
<main>
  <h1>${esc(d.productName)}</h1>
  <p>Mergi la oferta de la <strong>${esc(d.retailerName)}</strong>.</p>
  ${note}
  <form id="go-form" method="post" action="/go/${id}" data-offer="${id}">
    ${d.formToken ? `<input type="hidden" name="ft" value="${esc(d.formToken)}">` : ''}
    <button type="submit">Continuă spre magazin</button>
  </form>
  <p><a href="${productUrl}">Înapoi la produs</a></p>
</main>
<script>
(function () {
  var form = document.getElementById('go-form');
  var id = form.getAttribute('data-offer');
  var busy = false;
  // Cere un token de la server (doar un browser care ruleaza JS ajunge aici) si continua spre magazin.
  function go(fallbackToForm) {
    if (busy) return;
    busy = true;
    fetch('/api/go-token', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ offerId: Number(id) }),
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) { location.replace('/go/' + id + '?t=' + encodeURIComponent(d.token)); })
      .catch(function () { busy = false; if (fallbackToForm) form.submit(); });
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); go(true); });
  go(false);
})();
</script>
</body>
</html>`
}
