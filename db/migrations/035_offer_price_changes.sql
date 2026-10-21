-- 035: „are poveste” — schimbările de preț pe 60 de zile + canonical pe variante (21 oct. 2026).
--
-- De ce: planul „Observatorul reducerilor reale” (docs/plans/2026-10-21-observator-repozitionare-*.md,
-- Pista A). După retrogradarea din August 2026 Spam Update păstrăm în index doar paginile /p/
-- care au o poveste proprie, nu doar o copie a feed-ului: produsul se vinde în cel puțin
-- 2 magazine (comparația are sens) SAU prețul s-a mișcat de cel puțin 3 ori în 60 de zile
-- (istoricul are sens). Regula e în web/src/lib/seo/product-index.ts.
--
-- 1. offer_price_stats.price_changes_60d = de câte ori s-a schimbat prețul între două puncte
--    CONSECUTIVE din price_history, ambele în ultimele 60 de zile, pentru oferta respectivă.
--    Snapshot-ul zilnic scrie un punct pe zi pe ofertă (runPriceSnapshot), plus punctele din
--    feed-sync / price-check — deci două puncte la același preț NU sunt o schimbare.
--    Precalculat de worker în același upsert cu mediana (worker/src/lib/price-stats.ts):
--    regula din CLAUDE.md — site-ul NU agregă price_history la cerere.
--
-- 2. products.canonical_product_id = pagina principală a grupului de variante aproape identice
--    (aceeași categorie + marcă + denumire, diferă doar culoarea). NULL = produsul e propria lui
--    pagină (principala grupului sau fără variante). Scris de worker după recalcularea
--    statisticilor (worker/src/lib/product-variants.ts) — gruparea după denumire e în TypeScript
--    (testată), nu în SQL. Până la prima rulare a workerului coloana e NULL peste tot = nimic
--    nu se schimbă pe site (fallback curat). Site-ul pune canonical spre principală doar dacă
--    principala e ea însăși indexabilă (verificat la cerere, pe un singur produs).
--
-- Idempotentă (IF NOT EXISTS). Completarea inițială rulează o singură dată (doar rândurile încă
-- la 0) și citește doar partițiile din ultimele 60 de zile.

ALTER TABLE offer_price_stats
    ADD COLUMN IF NOT EXISTS price_changes_60d INT NOT NULL DEFAULT 0;  -- schimbări de preț între puncte consecutive, ultimele 60 de zile

UPDATE offer_price_stats s
SET price_changes_60d = c.changes
FROM (
    SELECT offer_id, COUNT(*) FILTER (WHERE prev IS NOT NULL AND price <> prev)::int AS changes
    FROM (
        SELECT offer_id, price,
               LAG(price) OVER (PARTITION BY offer_id ORDER BY recorded_at) AS prev
        FROM price_history
        WHERE recorded_at >= now() - INTERVAL '60 days'
    ) w
    GROUP BY offer_id
) c
WHERE c.offer_id = s.offer_id
  AND s.price_changes_60d = 0
  AND c.changes > 0;

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS canonical_product_id BIGINT REFERENCES products(id) ON DELETE SET NULL;  -- principala grupului de variante; NULL = pagină proprie

-- Sitemap-ul și pagina citesc doar rândurile cu canonical (o minoritate) → index parțial
CREATE INDEX IF NOT EXISTS idx_products_canonical_product_id
    ON products (canonical_product_id) WHERE canonical_product_id IS NOT NULL;
