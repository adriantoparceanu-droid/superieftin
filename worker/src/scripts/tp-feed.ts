import pool from '../lib/db.js'
import { loadFeedRules } from '../lib/feedRules.js'
import { syncExternalFeeds } from '../workers/sync.worker.js'
const res = await syncExternalFeeds(await loadFeedRules())
console.log('RESULT:', res)
const g = await pool.query(`
  SELECT count(*) AS oferte, count(DISTINCT o.product_id) AS produse,
         count(*) FILTER (WHERE o.affiliate_network='2performant') AS afiliate_2p
  FROM offers o JOIN retailers r ON r.id=o.retailer_id WHERE r.slug='evomag'`)
console.log('EVOMAG:', g.rows[0])
const c = await pool.query(`
  SELECT coalesce(p.feed_category,'(fără)') AS feed_cat, count(*) AS n
  FROM products p JOIN offers o ON o.product_id=p.id JOIN retailers r ON r.id=o.retailer_id
  WHERE r.slug='evomag' GROUP BY 1`)
console.log('CATEGORII FEED:', c.rows)
await pool.end()
