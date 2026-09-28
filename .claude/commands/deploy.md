# /deploy — Deploy cod pe VPS

Deployezi codul local pe VPS-ul de producție (13.140.163.156), cap-coadă, cu scriptul
`./deploy.sh` din rădăcina proiectului. Rulează DOAR când proprietarul cere explicit (`/deploy`).

Proiectul rulează izolat sub user-ul `superieftin`, în `/home/superieftin/app/`
(stack Docker Compose, proiect `superieftin`, reverse proxy CloudPanel → port 3000).

**Argument opțional:** `$ARGUMENTS` poate fi `web`, `worker`, sau gol (= ambele).

## Pași

1. **Rulează scriptul dintr-o singură comandă** (nu-l compune cu alte comenzi prin `&&` / `;` —
   regula de permisiune se potrivește doar pe comanda simplă):

   ```bash
   ./deploy.sh $ARGUMENTS
   ```

   Scriptul face singur, în ordine, și se oprește la prima eroare:
   - verificări locale: modificări necomise (refuză), teste worker, TypeScript web/worker,
     SSH, variabilele cerute de compose care lipsesc din `.env` pe VPS (doar numele);
   - sincronizare fișiere la căile lor (migrații, compose, Dockerfile-uri, `package*.json`,
     `web/src`, `web/public`, configurări web, `worker/src`);
   - migrații noi: le detectează comparând `db/migrations/` cu `schema_migrations` din producție;
     dacă există, reconstruiește imaginea `migrate` și le rulează ÎNAINTE de codul nou;
   - `docker compose build` + `up -d` pentru țintă;
   - verificare: containere `Up`, site → 200, workerul a pornit, erori în loguri.

   Folosește un timeout mare (build-ul durează câteva minute): `timeout: 600000`.

2. **Dacă scriptul refuză din cauza modificărilor necomise**: spune-i proprietarului ce fișiere
   sunt și întreabă dacă faci commit. NU rula `--allow-dirty` fără acordul lui.

3. **Dacă ai adăugat variabile noi în `.env` local** care trebuie și pe VPS: adaugă-le înainte de
   deploy (fă întâi o copie `.env.bak-<data>` pe server; nu afișa valorile).

4. **Raportează**: ce s-a deploiat, migrațiile aplicate, statusul containerelor, codul HTTP,
   orice avertisment din script. Dacă a eșuat, pasul și ultimele linii de eroare.

Doar verificare, fără nicio modificare pe server: `./deploy.sh --check`.

## De reținut

- **Migrație care schimbă meniul/categoriile FĂRĂ rebuild de cod web**: `revalidateTag` nu
  invalidează fiabil `unstable_cache`. Recreează containerul web pentru cache proaspăt:
  `ssh superieftin@13.140.163.156 'cd /home/superieftin/app && docker compose up -d --force-recreate web'`.
- Dependențe noi: scriptul sincronizează deja `package.json` + `package-lock.json` (rădăcină,
  web, worker) — dar trebuie să fie commit-uite.
