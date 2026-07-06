// Contractele stratului de afiliere agnostic de retea. Fiecare retea (Profitshare,
// 2Performant, ...) implementeaza AffiliateProvider; rezolverul alege, per domeniu,
// candidatul cu comisionul cel mai mare si construieste linkul afiliat.

export interface AffiliateAdvertiser {
  network: string                 // 'profitshare' | '2performant'
  externalId: string              // id-ul advertiserului in reteaua respectiva
  name: string
  domain: string | null           // normalizat: 'emag.ro'
  advertiserHash: string | null   // hash advertiser (Profitshare) / program id (2P)
  affiliateHash: string | null    // hash-ul tau de afiliat
  commission: number | null       // valoare comparabila intre retele (NULL = necunoscut)
  status: string                  // active | pending | inactive
}

export interface ResolvedAffiliate {
  affiliateUrl: string
  network: string
  commission: number | null
}

export interface AffiliateProvider {
  readonly network: string
  // Listeaza advertiserii afiliati ai retelei (cu domeniu + comision) pentru a popula harta.
  syncAdvertisers(): Promise<AffiliateAdvertiser[]>
  // Construieste linkul afiliat pentru un URL de produs, folosind datele advertiserului.
  buildLink(productUrl: string, adv: AffiliateAdvertiser): string
}
