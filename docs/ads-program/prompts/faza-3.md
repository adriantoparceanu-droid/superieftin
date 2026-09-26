# Prompt Faza 3 — în DOI pași

## Pasul A — research (copiază în Claude Code)

---

Citește `docs/ads-program/REGULI.md`. Începem Faza 3. Branch: `ads/faza-3-campanii`.

1. Folosește agentul `ads-builder` doar pentru a crea scripturile `ads:validate`,
   `ads:plan`, `ads:apply` (fără campanii încă). Testează-le pe contul de test cu
   `ads/campaigns/_template.yaml` copiat ca `test-laptopuri.yaml`.
2. Folosește agentul `market-research` pentru un raport de oportunități pe categoriile:
   Laptopuri, Telefoane mobile, Televizoare, Monitoare.
   Context: [ex. pregătire Black Friday / campanie generală].
   Buget total disponibil: [X] RON / zi.

Oprește-te după raport. Aștept să aleg direcțiile.

---

## Pasul B — campaniile (după ce citești raportul)

---

Din raportul `ads/research/[fișier].md` am ales direcțiile: [1, 2, 3].
Ajustări: [opțional].

1. Agentul `ads-builder`: scrie campaniile YAML pentru direcțiile alese.
2. Rulează `ads:validate`.
3. Agentul `policy-reviewer`: verificare completă.
4. Dacă PASS: rulează `ads:plan` pe PROD și arată-mi rezultatul. NU rula apply.

Aștept confirmarea mea pentru `ads:apply --confirm --prod`.
