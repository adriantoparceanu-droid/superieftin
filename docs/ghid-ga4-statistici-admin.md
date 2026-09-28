# Ghid: conectarea GA4 la /admin/statistici

Durată: ~10 minute. Faci pașii o singură dată. După ei, workerul aduce zilnic statisticile
GA4 în admin. Contul creat aici poate **doar să citească** GA4, nu poate modifica nimic.

## Pasul 1: activează API-ul în Google Cloud

1. Deschide <https://console.cloud.google.com/> și alege **același proiect** în care ai creat
   clientul OAuth pentru Google Ads (selectorul de proiect, sus-stânga).
2. Meniu → **APIs & Services** → **Library**.
3. Caută **Google Analytics Data API** → **Enable**.

## Pasul 2: creează contul de serviciu

1. Meniu → **IAM & Admin** → **Service Accounts** → **+ Create service account**.
2. Nume: `superieftin-ga4-reader` → **Create and continue**.
3. La „Grant this service account access to project”: **nu alege niciun rol** → **Continue** → **Done**.
   (Accesul la date îl dai din GA4, la pasul 3. În Cloud contul nu are nevoie de nimic.)
4. Deschide contul creat → tab-ul **Keys** → **Add key** → **Create new key** → **JSON** → **Create**.
   Se descarcă un fișier `.json`. **Tratează-l ca pe o parolă**: nu-l trimite pe email sau chat
   și nu-l pune în git.
5. Copiază adresa de email a contului (ceva de forma
   `superieftin-ga4-reader@<proiect>.iam.gserviceaccount.com`).

## Pasul 3: dă-i acces de citire în GA4

1. Deschide <https://analytics.google.com/> → proprietatea superieftin.ro.
2. **Admin** (rotița, jos-stânga) → **Gestionarea accesului la proprietate** (Property access management).
3. **+** → **Adaugă utilizatori** → lipește emailul contului de serviciu.
4. Rol: **Viewer** (Cititor). Debifează „Notificați noii utilizatori prin e-mail” → **Adaugă**.
5. Tot în Admin → **Detalii proprietate** (Property details): copiază **ID-ul proprietății**,
   un număr de forma `123456789`. Atenție: **nu** e ID-ul de măsurare `G-…`.

## Pasul 4: pune datele în .env

În terminal, în folderul unde ai descărcat cheia:

```bash
base64 -i superieftin-ga4-reader-xxxx.json | tr -d '\n'
```

Rezultatul e un text lung, pe un singur rând. În `.env` (la rădăcina proiectului):

```
GA4_PROPERTY_ID=123456789
GA4_SERVICE_ACCOUNT_JSON=<textul lung de mai sus>
```

Base64 e recomandat pentru că nu conține ghilimele sau acolade, care se strică ușor în
`docker compose`. Merge și JSON-ul pe un rând, sau calea spre fișier.

## Pasul 5: testează local

```bash
cd worker && npm run ga4:check      # verifică accesul; nu scrie nimic
cd worker && npm run ga4:sync:now   # prima rulare aduce ultimele 90 de zile
```

Apoi deschide <http://localhost:3000/admin/statistici>.

`ga4:check` îți spune și dacă lipsesc dimensiunile personalizate pentru magazin, produs și
categorie (`merchant_name`, `product_id`, `category`). Fără ele, tabelele respective rămân goale.
Le creezi urmând `docs/ads-program/ghid-setari-ga4.md`, **Pasul 2**. GA4 le completează doar
pentru evenimentele de după creare, nu retroactiv.

## Pasul 6: producție

La deploy (`/deploy`), adaugă aceleași două variabile în `.env`-ul de pe VPS. Migrația `025`
se aplică prin serviciul `migrate`. După deploy, pornește prima sincronizare din admin, cu
butonul „Actualizează acum”, sau las-o pentru jobul de la 06:15.

## Dacă ceva nu merge

| Mesaj | Ce faci |
|---|---|
| `PERMISSION_DENIED` / 403 | Contul de serviciu nu e adăugat în GA4 (Pasul 3) sau e pe altă proprietate. |
| `SERVICE_DISABLED` | Google Analytics Data API nu e activat în proiect (Pasul 1). |
| `invalid_grant` | Cheia a fost ștearsă sau e greșită: generează una nouă (Pasul 2.4). |
| `GA4_PROPERTY_ID trebuie să fie numeric` | Ai pus `G-…` în loc de ID-ul proprietății (Pasul 3.5). |

Pentru a retrage accesul oricând: GA4 → Gestionarea accesului → șterge contul de serviciu,
sau în Cloud → Service Accounts → Keys → șterge cheia.
