import pool from '../db.js'
import { extractDomain } from './domain.js'
import type { AffiliateProvider, AffiliateAdvertiser, ResolvedAffiliate } from './types.js'

// Rezolverul de afiliere: tine o harta domeniu -> advertiseri (din toate retelele) si,
// pentru un URL de produs, alege candidatul cu comisionul cel mai mare si construieste
// linkul afiliat. Fara candidat -> null (produsul ramane neafiliat).
export class AffiliateResolver {
  private byDomain = new Map<string, AffiliateAdvertiser[]>()
  private providers = new Map<string, AffiliateProvider>()
  private priority: string[]

  constructor(providers: AffiliateProvider[], priorityOrder?: string[]) {
    for (const p of providers) this.providers.set(p.network, p)
    this.priority = priorityOrder ?? ['profitshare', '2performant']
  }

  // Incarca harta direct dintr-o lista (folosit in teste si dupa citirea din DB).
  setAdvertisers(advertisers: AffiliateAdvertiser[]): void {
    const map = new Map<string, AffiliateAdvertiser[]>()
    for (const adv of advertisers) {
      if (adv.status !== 'active' || !adv.domain) continue
      const list = map.get(adv.domain) ?? []
      list.push(adv)
      map.set(adv.domain, list)
    }
    this.byDomain = map
  }

  // Reincarca harta din affiliate_advertisers.
  async refresh(): Promise<void> {
    const { rows } = await pool.query<{
      network: string; external_id: string; name: string | null; domain: string | null
      advertiser_hash: string | null; affiliate_hash: string | null
      commission: string | null; status: string
    }>(`
      SELECT network, external_id, name, domain, advertiser_hash, affiliate_hash, commission, status
      FROM affiliate_advertisers WHERE status = 'active'
    `)
    this.setAdvertisers(rows.map((r) => ({
      network: r.network,
      externalId: r.external_id,
      name: r.name ?? '',
      domain: r.domain,
      advertiserHash: r.advertiser_hash,
      affiliateHash: r.affiliate_hash,
      commission: r.commission !== null ? parseFloat(r.commission) : null,
      status: r.status,
    })))
  }

  // Alege cel mai bun candidat pentru un domeniu: comision maxim, tie-break pe prioritate.
  private pickBest(candidates: AffiliateAdvertiser[]): AffiliateAdvertiser | null {
    const usable = candidates.filter((c) => this.providers.has(c.network))
    if (!usable.length) return null
    return usable.reduce((best, c) => {
      const bc = best.commission ?? -1
      const cc = c.commission ?? -1
      if (cc !== bc) return cc > bc ? c : best
      // Comision egal/necunoscut -> ordinea de prioritate (index mai mic = mai prioritar)
      const bi = this.priority.indexOf(best.network)
      const ci = this.priority.indexOf(c.network)
      return (ci !== -1 && (bi === -1 || ci < bi)) ? c : best
    })
  }

  resolve(productUrl: string): ResolvedAffiliate | null {
    const domain = extractDomain(productUrl)
    if (!domain) return null
    const best = this.pickBest(this.byDomain.get(domain) ?? [])
    if (!best) return null
    try {
      return {
        affiliateUrl: this.providers.get(best.network)!.buildLink(productUrl, best),
        network: best.network,
        commission: best.commission,
      }
    } catch {
      return null
    }
  }
}
