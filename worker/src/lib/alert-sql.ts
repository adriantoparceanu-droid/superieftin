// Fragmente SQL comune pentru alertele de pret (Telegram + email). Separat de price-alert.ts,
// care ramane fara dependente (testat fara baza de date).
import { OFFER_STALE_DAYS } from './stale.js'

// „Oferta disponibila” = aceeasi regula ca OFFER_AVAILABLE_SQL din web/src/lib/availability.ts:
// in stoc, confirmata in ultimele OFFER_STALE_DAYS zile, magazin nepus pe pauza. Altfel alerta
// ar trimite pe o pagina unde pretul anuntat nu exista.
export const ALERT_OFFER_AVAILABLE_SQL =
  `(o.in_stock = true AND o.last_checked >= now() - INTERVAL '${OFFER_STALE_DAYS} days' AND r.paused_at IS NULL)`

// Coloana `offers` (JSON) pentru o alerta `pa`: TOATE ofertele cu pret ale produsului, fiecare cu
// `available`. Din ele: cel mai mic pret disponibil (re-armare, lib/alert-rearm.ts) si oferta care
// declanseaza (cea mai ieftina disponibila <= prag, pickTriggerOffer) — ambele testate.
export const ALERT_OFFERS_JSON_SQL = `(
  SELECT json_agg(json_build_object(
    'offerId', o.id, 'price', o.current_price::float, 'retailerName', r.name,
    'available', ${ALERT_OFFER_AVAILABLE_SQL}))
  FROM offers o JOIN retailers r ON r.id = o.retailer_id
  WHERE o.product_id = pa.product_id AND o.current_price IS NOT NULL
)`

// Filtru ieftin pentru WHERE: exista macar o oferta disponibila la sau sub prag
export const ALERT_HAS_TRIGGER_SQL = `EXISTS (
  SELECT 1 FROM offers o JOIN retailers r ON r.id = o.retailer_id
  WHERE o.product_id = pa.product_id AND o.current_price IS NOT NULL AND o.current_price <= pa.target_price
    AND ${ALERT_OFFER_AVAILABLE_SQL}
)`

// Cel mai mic pret disponibil acum al produsului `p` (pentru mesajele botului / validarea pragului)
export const PRODUCT_BEST_PRICE_SQL = `(
  SELECT MIN(o.current_price)::float FROM offers o JOIN retailers r ON r.id = o.retailer_id
  WHERE o.product_id = p.id AND o.current_price IS NOT NULL AND ${ALERT_OFFER_AVAILABLE_SQL}
)`
