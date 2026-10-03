// Numele actiunii de conversie principale (comisioanele din TOATE retelele de afiliere:
// Profitshare + 2Performant). Modul separat (fara efecte la import) ca sa-l poata folosi si
// planul campaniilor, si scriptul ads:conversion-action.
//
// Google Ads identifica actiunea dupa ID (GOOGLE_ADS_CONVERSION_ACTION_ID = 7799099014, si
// conversion_action_id din YAML-uri), NU dupa nume — numele e doar o eticheta.
// Redenumirea „Comision Profitshare” → „Comision afiliere” a fost aprobata de proprietar pe
// 2026-10-03 si se face MANUAL in interfata (Obiective → Conversii). Pana atunci contul are
// numele vechi: codul il accepta (LEGACY_ACTION_NAMES) si doar avertizeaza.
export const ACTION_NAME = 'Comision afiliere'
export const LEGACY_ACTION_NAMES: readonly string[] = ['Comision Profitshare']

export function isKnownActionName(name: string): boolean {
  return name === ACTION_NAME || LEGACY_ACTION_NAMES.includes(name)
}
