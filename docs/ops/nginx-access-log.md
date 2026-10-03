# Nginx pe VPS: IP-ul real al vizitatorului + jurnal de acces pentru /go/

> Pentru proprietar. Comenzile se rulează pe VPS (`ssh superieftin@13.140.163.156`), cu `sudo`.
> Nimic din acest fișier nu se aplică automat la deploy. Context: protecția anti-roboți de pe
> `/go/` (limită per IP + token JS, `web/src/app/go/[offerId]/route.ts`), după valul de
> ~19.900 de clickuri automate din 1 oct. 2026 (00–06 UTC), pe care nu l-am putut analiza
> pentru că jurnalul nginx era practic oprit (access.log gol din iunie).

## Drumul unei cereri și de unde ia aplicația IP-ul

```
vizitator → Cloudflare → nginx (CloudPanel, pe VPS) → containerul web (127.0.0.1:3000)
```

Aplicația (`clientIp()` din `web/src/lib/rate-limit.ts`) ia IP-ul, în ordine, din:

1. `CF-Connecting-IP` — pus de Cloudflare cu IP-ul real (suprascrie orice trimite clientul);
2. **ultimul** element din `X-Forwarded-For` — adăugat de nginx (`$proxy_add_x_forwarded_for`
   = ce a venit + `$remote_addr`); clientul poate scrie doar elementele din fața lui;
3. altfel „necunoscut” → **limita de viteză NU se aplică** (o cheie comună i-ar bloca pe toți
   vizitatorii între ei). Protecția prin token rămâne activă.

`X-Real-IP` NU e folosit intenționat: dacă nginx nu-l suprascrie, îl poate inventa clientul la
fiecare cerere și limita n-ar mai prinde nimic.

**Ce trebuie să existe în nginx** (CloudPanel le pune de regulă în vhost-ul de reverse proxy —
verifică la pasul 1): în blocul `location /` care face `proxy_pass` spre `127.0.0.1:3000`:

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
# NU pune „proxy_set_header CF-Connecting-IP ...” și nu șterge headerul — aplicația are nevoie de el.
```

**Limită cunoscută:** cine ocolește Cloudflare și lovește direct IP-ul VPS-ului poate trimite un
`CF-Connecting-IP` fals (și ocoli limita). Remediul e pe server: porturile 80/443 deschise doar
pentru IP-urile Cloudflare (https://www.cloudflare.com/ips/) — din firewall-ul furnizorului
de VPS sau din CloudPanel (Security), dacă oferă opțiunea. Atenție să nu blochezi SSH (22) și
alte site-uri de pe același VPS. Tokenul JS rămâne oricum
obligatoriu și pentru acești roboți.

## Jurnalul de acces: doar pentru /go/ și /api/go-token

**Decizie: jurnal DOAR pentru `/go/` și `/api/go-token`, nu pentru tot site-ul.** De ce:
- e exact traficul care ne costă (clickuri de afiliere) și pe care trebuie să-l putem analiza
  la un nou val (IP, ritm, user-agent, status);
- minimizarea datelor (GDPR): nu păstrăm IP-urile tuturor vizitatorilor paginilor obișnuite;
  pentru restul traficului există statisticile Cloudflare și GA4;
- volum mic pe disc (un rând per click, nu per imagine/fișier JS).

Ce se scrie pe rând: ora (ISO), IP-ul real (`CF-Connecting-IP`), IP-ul conexiunii (`$remote_addr`,
de obicei un nod Cloudflare), metoda, calea **fără query string** (`$uri` — tokenul `?t=` nu se
scrie), statusul (200 = pagina intermediară, 302/303 = spre magazin sau înapoi pe produs),
user-agentul, referer-ul, ID-ul Cloudflare `CF-Ray`, durata. Păstrare: **7 zile** (rotație zilnică).
Politica de confidențialitate spune deja „jurnale tehnice … de regulă câteva săptămâni, doar
pentru securitate” — 7 zile se încadrează.

### Pasul 1 — vezi configurația actuală (doar citire)

```bash
sudo nginx -T 2>/dev/null | grep -nE 'server_name|access_log|log_format|proxy_pass|X-Forwarded-For|X-Real-IP|include .*conf\.d' | grep -iE 'superieftin|access_log|log_format|proxy|X-|conf\.d'
```

Notează: (a) dacă `http {}` include `/etc/nginx/conf.d/*.conf` (implicit da); (b) unde e vhost-ul
`superieftin.ro` (CloudPanel: `/etc/nginx/sites-enabled/www.superieftin.ro.conf` sau similar) și
dacă are `access_log off;` sau un `access_log` în `location /`.

### Pasul 2 — formatul și filtrul (context `http`, fișier nou)

```bash
sudo tee /etc/nginx/conf.d/superieftin-go-log.conf >/dev/null <<'NGINX'
# superieftin.ro — jurnal de acces DOAR pentru /go/ și /api/go-token (docs/ops/nginx-access-log.md)
map $uri $superieftin_log_go {
    ~^/go/           1;
    ~^/api/go-token  1;
    default          0;
}
log_format superieftin_go '$time_iso8601 ip=$http_cf_connecting_ip remote=$remote_addr '
                          '"$request_method $uri" $status ua="$http_user_agent" '
                          'ref="$http_referer" ray=$http_cf_ray rt=$request_time';
NGINX
sudo mkdir -p /var/log/nginx-superieftin
sudo chmod 750 /var/log/nginx-superieftin
```

Directorul e separat de `/var/log/nginx/` intenționat: regula logrotate implicită a nginx
(`/var/log/nginx/*.log`, de obicei 14–52 de zile) s-ar suprapune cu cea de 7 zile de mai jos.

### Pasul 3 — activează jurnalul în vhost-ul superieftin.ro

În CloudPanel: Sites → superieftin.ro → **Vhost** (editează acolo, nu direct fișierul — CloudPanel
îl poate rescrie). Adaugă în blocul `server { ... }` care are `server_name www.superieftin.ro`
(cel cu `listen 443`), la nivelul `server`, NU într-un `location`:

```nginx
    access_log /var/log/nginx-superieftin/go.access.log superieftin_go if=$superieftin_log_go;
```

Atenție: dacă `location /` (cel cu `proxy_pass`) are propriul `access_log` sau `access_log off;`,
directiva de la nivelul `server` NU se moștenește în acel `location` — atunci pune linia de mai sus
**în interiorul** `location /`, lângă `proxy_pass`. (Mai multe `access_log` la același nivel se
cumulează; `access_log off;` la același nivel le anulează pe toate — scoate-l doar dacă e în același
bloc.)

### Pasul 4 — test și reîncărcare

```bash
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` trebuie să spună `syntax is ok` și `test is successful`. Dacă dă eroare, NU rula
reload — corectează (sau șterge `/etc/nginx/conf.d/superieftin-go-log.conf` și linia din vhost)
și repetă. `reload` nu întrerupe conexiunile existente.

Verificare (deschide un produs pe site și apasă „Cumpără la …” o dată, din browserul tău):

```bash
sudo tail -n 5 /var/log/nginx-superieftin/go.access.log
```

### Pasul 5 — rotație, păstrare 7 zile

```bash
sudo tee /etc/logrotate.d/superieftin-go >/dev/null <<'ROT'
/var/log/nginx-superieftin/*.log {
    daily
    rotate 7
    maxage 7
    missingok
    notifempty
    compress
    delaycompress
    create 0640 root adm
    sharedscripts
    postrotate
        [ -s /run/nginx.pid ] && kill -USR1 "$(cat /run/nginx.pid)" || true
    endscript
}
ROT
sudo logrotate --debug /etc/logrotate.d/superieftin-go   # simulare, nu modifică nimic
```

(Dacă PID-ul nginx e în altă parte: `sudo nginx -T 2>/dev/null | grep -m1 '^pid'`.)

### Analiză rapidă la un val de roboți

```bash
L=/var/log/nginx-superieftin/go.access.log
# cereri /go/ pe oră
sudo awk '{print substr($1,1,13)}' $L | sort | uniq -c
# top IP-uri
sudo grep -o 'ip=[^ ]*' $L | sort | uniq -c | sort -rn | head -20
# top user-agent
sudo grep -o 'ua="[^"]*"' $L | sort | uniq -c | sort -rn | head -10
# câte au rămas pe pagina intermediară (200) vs. au plecat spre magazin (302/303)
sudo awk '$5 ~ /^\/go\// {print $6}' $L | sort | uniq -c
```

În aplicație nu se scrie niciun IP: limita folosește doar un hash efemer în Redis
(`rl:go:*`, expiră în ≤ 61 de minute).

## Variabile de mediu (în `.env` pe server, apoi `docker compose up -d web`)

| Variabilă | Implicit | Rol |
|---|---|---|
| `GO_TOKEN_SECRET` | derivat din `ADMIN_SESSION_SECRET` | secretul tokenului JS (`openssl rand -hex 32`) |
| `GO_TOKEN_CHECK` | activ | `0` = comutator de urgență: oprește cerința de token (limita rămâne) |
| `GO_TEST_TOKEN` | gol = excepție oprită | header `x-go-test-token` → trece fără limită/token, click marcat intern |
| `GO_RATE_PER_MIN` / `GO_RATE_PER_HOUR` | 20 / 120 | limita per IP pe `/go/` |
| `GO_TOKEN_RATE_PER_MIN` / `GO_TOKEN_RATE_PER_HOUR` | 60 / 600 | limita per IP pe `/api/go-token` |
| `GO_RATE_REDIS_TIMEOUT_MS` | 150 | peste atât, Redis e ignorat (fail-open) |
