// Aranjarea bannerelor de pe homepage (desktop), în funcție de ce bannere sunt VIZIBILE acum
// (un banner HTML fără acord „Publicitate” sau unul care n-a afișat nimic nu contează).
// Pur, fără React — testat în home-banners.test.ts.
//
//   'grid'        mare + cel puțin un mic: ≥ xl mare stânga + micile suprapuse în dreapta;
//                 lg → xl mare pe toată lățimea, micile pe un rând dedesubt
//   'main-only'   doar mare → pe toată lățimea
//   'smalls-only' doar mici → un rând de 2 (sau unul pe toată lățimea)
//   null          nimic de arătat → blocul (cu eticheta „Publicitate”) nu apare deloc
export type HomeBannerLayout = 'grid' | 'main-only' | 'smalls-only'

export function homeBannerLayout(hasMain: boolean, smallCount: number): HomeBannerLayout | null {
  if (hasMain && smallCount > 0) return 'grid'
  if (hasMain) return 'main-only'
  if (smallCount > 0) return 'smalls-only'
  return null
}

// Înălțimea casetei bannerului mare HTML după raportul iframe-ului: limitată, ca un cod de
// afiliere neobișnuit (ex. un widget de 600 px) să nu împingă pagina în jos.
export const MAIN_BANNER_MIN_H = 90
export const MAIN_BANNER_MAX_H = 360

export function clampMainBannerHeight(reported: number): number {
  return Math.min(MAIN_BANNER_MAX_H, Math.max(MAIN_BANNER_MIN_H, Math.round(reported)))
}
