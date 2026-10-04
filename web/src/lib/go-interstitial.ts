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
<meta name="color-scheme" content="light dark">
<style>
  /* Culorile = tokenii site-ului (web/src/app/globals.css), copiate aici: pagina nu încarcă CSS-ul site-ului */
  :root{--bg:#F4F5F7;--surface:#FFFFFF;--ink:#14161A;--ink-2:#424854;--ink-3:#6A707C;--line:#E1E4E9;--red:#D42B2B;--red-hover:#B91C22;--red-ink:#B91C22}
  @media (prefers-color-scheme: dark){:root{--bg:#0E0F12;--surface:#17191E;--ink:#F2F3F5;--ink-2:#C3C8D0;--ink-3:#9AA1AD;--line:#2A2E36;--red-hover:#E0322F;--red-ink:#FF6B61}}
  body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--ink);-webkit-font-smoothing:antialiased}
  main{max-width:28rem;margin:12vh auto 0;padding:2rem 1.5rem;background:var(--surface);border:1px solid var(--line);border-radius:16px;text-align:center;box-shadow:0 1px 2px rgba(16,18,24,.06),0 4px 16px rgba(16,18,24,.06)}
  @media (max-width:30rem){main{margin:8vh 1rem 0}}
  h1{font-size:1.2rem;line-height:1.3;margin:0 0 .5rem;font-weight:800;letter-spacing:-.01em}
  p{color:var(--ink-2);margin:.5rem 0 1.25rem;line-height:1.5}
  .note{color:var(--red-ink);font-weight:600}
  button{font:inherit;font-weight:800;font-size:1.05rem;background:var(--red);color:#fff;border:0;border-radius:12px;min-height:48px;padding:.8rem 1.5rem;cursor:pointer;width:100%;box-shadow:0 1px 0 rgba(0,0,0,.12),0 6px 16px -6px rgba(212,43,43,.6)}
  button:hover{background:var(--red-hover)}
  button:focus-visible{outline:2px solid var(--ink);outline-offset:2px}
  a{color:var(--ink-3);font-size:.9rem;text-underline-offset:2px}
  a:hover{color:var(--ink)}
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
