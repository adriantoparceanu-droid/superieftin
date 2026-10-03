// Planificarea emailurilor cu alerte (digest) — logica pura, testata in digest.test.ts.
//
// Cerinta proprietarului (2026-10-03): un abonat NU primeste mai multe emailuri separate cand ii
// scad mai multe produse. Deci:
//   1. toate alertele declansate pentru acelasi abonat intr-o rulare → UN singur email;
//   2. plafon: cel mult un email de alerte la `minIntervalHours` (implicit 24 h = 1 pe zi) per
//      abonat. Ce se declanseaza intre timp ramane ACTIV si intra in urmatorul digest — daca pretul
//      e inca la sau sub prag atunci (altfel n-am mai spune adevarul in email: regula 9).
//
// Rularea (workers/email.worker.ts) recalculeaza candidatii din baza de date la fiecare trecere,
// deci „amanat” inseamna doar „nu trimitem acum”; nimic nu se marcheaza.

export interface DigestCandidate {
  alertId: number
  subscriberId: number
  email: string
  lastDigestAt: string | null   // momentul ultimului email de alerte (text ISO din Postgres)
  productName: string
  productSlug: string
  targetPrice: number
  offerId: number               // oferta care a declansat (cea mai ieftina disponibila <= prag)
  price: number
  retailerName: string
}

export interface DigestBatch {
  subscriberId: number
  email: string
  previousDigestAt: string | null
  items: DigestCandidate[]      // un rand per produs, in email
  alertIds: number[]            // TOATE alertele acoperite de email (se opresc dupa trimitere)
}

export interface DigestPlan {
  batches: DigestBatch[]        // de trimis acum: un email per abonat
  deferred: DigestCandidate[]   // abonatul a primit deja un email in fereastra plafonului
}

export function planDigest(candidates: DigestCandidate[], nowMs: number, minIntervalHours: number): DigestPlan {
  const bySubscriber = new Map<number, DigestCandidate[]>()
  for (const c of candidates) {
    const list = bySubscriber.get(c.subscriberId)
    if (list) list.push(c)
    else bySubscriber.set(c.subscriberId, [c])
  }

  const batches: DigestBatch[] = []
  const deferred: DigestCandidate[] = []
  const windowMs = minIntervalHours * 3600 * 1000
  for (const [subscriberId, list] of bySubscriber) {
    const last = list[0].lastDigestAt ? Date.parse(list[0].lastDigestAt) : NaN
    if (Number.isFinite(last) && nowMs - last < windowMs) {
      deferred.push(...list)
      continue
    }
    // Un singur rand per produs (index unic in DB, dar nu ne bazam orbeste pe el) — pretul cel mai mic
    const byProduct = new Map<string, DigestCandidate>()
    for (const c of list) {
      const prev = byProduct.get(c.productSlug)
      if (!prev || c.price < prev.price) byProduct.set(c.productSlug, c)
    }
    const items = [...byProduct.values()].sort((a, b) => a.productName.localeCompare(b.productName, 'ro'))
    batches.push({
      subscriberId, email: list[0].email, previousDigestAt: list[0].lastDigestAt, items,
      alertIds: list.map((c) => c.alertId),
    })
  }
  return { batches, deferred }
}

// Cand poate primi abonatul urmatorul email (pentru log / „Alertele mele”)
export function nextDigestAllowedAt(lastDigestAt: string | null, minIntervalHours: number): Date | null {
  if (!lastDigestAt) return null
  const t = Date.parse(lastDigestAt)
  return Number.isFinite(t) ? new Date(t + minIntervalHours * 3600 * 1000) : null
}
