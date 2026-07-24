# /deploy — Deploy cod pe VPS

Deployezi codul local pe VPS-ul de producție (13.140.163.156).

Proiectul rulează izolat sub user-ul `superieftin`, în `/home/superieftin/app/`
(stack Docker Compose, proiect `superieftin`, reverse proxy CloudPanel → port 3000).
Conectarea se face ca `superieftin@13.140.163.156` (cheie SSH, fără parolă; user în grupul `docker`).

**Argument opțional:** `$ARGUMENTS` poate fi `web`, `worker`, sau gol (= ambele).

## Pași

**Pasul 1 — Determină ținta**

Dacă `$ARGUMENTS` este `web`, deploiezi doar containerul web (Next.js).
Dacă `$ARGUMENTS` este `worker`, deploiezi doar containerul worker (scraper + bot Telegram).
Dacă `$ARGUMENTS` este gol sau `all`, deploiezi ambele.

**Pasul 2 — Sincronizează fișierele pe VPS**

> ⚠️ Dockerfile-urile și compose se sincronizează la **căi explicite** — NU le pune
> pe toate într-un rsync către director (ar fi copiate flat și `web/Dockerfile` n-ar
> ajunge la `/home/superieftin/app/web/Dockerfile`).

```bash
DEST=superieftin@13.140.163.156:/home/superieftin/app

# Migrations + compose + Dockerfile-uri (fiecare la calea lui)
rsync -az db/migrations/ $DEST/db/migrations/
rsync -az docker-compose.yml superieftin@13.140.163.156:/home/superieftin/app/docker-compose.yml
rsync -az web/Dockerfile    superieftin@13.140.163.156:/home/superieftin/app/web/Dockerfile
rsync -az worker/Dockerfile superieftin@13.140.163.156:/home/superieftin/app/worker/Dockerfile

# Web (include next.config.ts — controlează NEXT_PUBLIC_SITE_URL / domeniul canonic)
rsync -az web/next.config.ts $DEST/web/next.config.ts
rsync -az --delete --exclude='.next' web/src/ $DEST/web/src/

# Worker
rsync -az --delete --exclude='dist' worker/src/ $DEST/worker/src/
```

**Pasul 3 — Build și restart pe VPS**

SSH la `superieftin@13.140.163.156` și rulează:

```bash
cd /home/superieftin/app
docker compose build <tinta>
docker compose up -d <tinta>
```

> ⚠️ **Dacă ai migrații noi** în `db/migrations/`: migrațiile sunt **baked în imagine**
> (`COPY db ./db` în worker/Dockerfile), iar serviciul `migrate` NU e inclus în
> `docker compose build web worker`. Trebuie reconstruit explicit ÎNAINTE de a rula
> migrațiile, altfel `migrate` folosește o imagine veche și raportează „succes" fără să
> aplice migrațiile noi:
>
> ```bash
> docker compose --profile tools build migrate
> docker compose --profile tools run --rm migrate   # ruleaza migratiile
> ```
>
> Rulează migrațiile ÎNAINTE de `up -d` (codul nou poate depinde de schema/funcțiile noi).
>
> **Migrație care schimbă meniul/categoriile FĂRĂ rebuild de cod web**: `revalidateTag` nu
> invalidează fiabil `unstable_cache`. Recreează containerul web pentru cache proaspăt:
> `docker compose up -d --force-recreate web`.

**Pasul 4 — Verificare**

- Rulează `docker ps` și confirmă că containerele au status `Up`
- Testează cu `curl -sk -o /dev/null -w '%{http_code}' https://www.superieftin.ro/` — trebuie să returneze `200`
- Dacă ai deploiat worker-ul, verifică logurile: `docker logs superieftin-worker-1 --tail 10`

**Pasul 5 — Raportează rezultatul**

Spune utilizatorului ce containere au fost rebuildate, statusul lor și codul HTTP returnat de site.
