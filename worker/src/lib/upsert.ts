import pool from './db.js'
import type { ImportedProduct } from './types.js'

// Upsert tranzactional: products -> offers -> price_history.
// Unificarea produselor intre retaileri: intai dupa (part_no, brand), apoi fallback pe slug.
export async function upsertProduct(product: ImportedProduct, retailerId: number): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let productId: string | null = null

    // 1) Matching precis dupa cod de produs + brand (acelasi produs la retaileri diferiti)
    if (product.partNo) {
      const match = await client.query<{ id: string }>(`
        SELECT id FROM products
        WHERE part_no = $1 AND lower(coalesce(brand, '')) = lower(coalesce($2, ''))
      `, [product.partNo, product.brand])
      if (match.rows[0]) {
        productId = match.rows[0].id
        await client.query(`
          UPDATE products SET
            image_url = COALESCE(image_url, $2),
            updated_at = now()
          WHERE id = $1
        `, [productId, product.imageUrl])
      }
    }

    // 2) Fallback pe slug (mecanismul istoric) — completeaza part_no daca lipsea
    if (!productId) {
      const result = await client.query<{ id: string }>(`
        INSERT INTO products (name, slug, category, brand, part_no, image_url, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, now())
        ON CONFLICT (slug) DO UPDATE SET
          name = EXCLUDED.name,
          brand = COALESCE(EXCLUDED.brand, products.brand),
          part_no = COALESCE(products.part_no, EXCLUDED.part_no),
          image_url = COALESCE(EXCLUDED.image_url, products.image_url),
          updated_at = now()
        RETURNING id
      `, [product.name, product.slug, product.category, product.brand, product.partNo, product.imageUrl])
      productId = result.rows[0].id
    }

    // Pretul anterior, citit INAINTE de upsert (RETURNING dupa ON CONFLICT DO UPDATE
    // ar intoarce valoarea noua, nu pe cea veche)
    const prev = await client.query<{ current_price: string | null }>(`
      SELECT current_price FROM offers WHERE product_id = $1 AND retailer_id = $2
    `, [productId, retailerId])
    const prevPrice = prev.rows[0]?.current_price ? parseFloat(prev.rows[0].current_price) : null

    const offerResult = await client.query<{ id: string }>(`
      INSERT INTO offers (product_id, retailer_id, url, affiliate_url, current_price, in_stock, last_checked)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (product_id, retailer_id) DO UPDATE SET
        url = EXCLUDED.url,
        affiliate_url = EXCLUDED.affiliate_url,
        current_price = EXCLUDED.current_price,
        in_stock = EXCLUDED.in_stock,
        last_checked = now()
      RETURNING id
    `, [productId, retailerId, product.url, product.affiliateUrl, product.price, product.inStock])

    const offerId = offerResult.rows[0].id

    // Istoric: la schimbare de pret sau cel mult o data pe zi
    const priceChanged = product.price !== null && product.price !== prevPrice
    const lastHistory = await client.query<{ recorded_at: Date }>(`
      SELECT recorded_at FROM price_history
      WHERE offer_id = $1
      ORDER BY recorded_at DESC LIMIT 1
    `, [offerId])

    const lastRecorded = lastHistory.rows[0]?.recorded_at
    const hoursSinceLast = lastRecorded
      ? (Date.now() - new Date(lastRecorded).getTime()) / 3600000
      : Infinity

    if (priceChanged || hoursSinceLast >= 24) {
      await client.query(`
        INSERT INTO price_history (offer_id, price, in_stock, recorded_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT DO NOTHING
      `, [offerId, product.price, product.inStock])
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Actualizare doar de pret (din API-ul Profitshare, care nu raporteaza stocul).
// Creeaza oferta daca retailerul nu vindea inca produsul.
export async function upsertOfferPrice(
  productId: string | number,
  retailerId: number,
  price: number,
  url: string,
  affiliateUrl: string,
): Promise<void> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const prev = await client.query<{ current_price: string | null }>(`
      SELECT current_price FROM offers WHERE product_id = $1 AND retailer_id = $2
    `, [productId, retailerId])
    const prevPrice = prev.rows[0]?.current_price ? parseFloat(prev.rows[0].current_price) : null

    const offerResult = await client.query<{ id: string }>(`
      INSERT INTO offers (product_id, retailer_id, url, affiliate_url, current_price, in_stock, last_checked)
      VALUES ($1, $2, $3, $4, $5, true, now())
      ON CONFLICT (product_id, retailer_id) DO UPDATE SET
        current_price = EXCLUDED.current_price,
        last_checked = now()
      RETURNING id
    `, [productId, retailerId, url, affiliateUrl, price])

    if (price !== prevPrice) {
      await client.query(`
        INSERT INTO price_history (offer_id, price, in_stock, recorded_at)
        VALUES ($1, $2, true, now())
        ON CONFLICT DO NOTHING
      `, [offerResult.rows[0].id, price])
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
