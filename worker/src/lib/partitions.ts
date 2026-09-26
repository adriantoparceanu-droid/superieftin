import pool from './db.js'

// Creeaza partitiile lunare lipsa pentru price_history (luna curenta + urmatoarele 2).
// Migratia 002 le creeaza doar la instalare. Se apeleaza din snapshot-ul zilnic (prod) SI la
// fiecare scanare (local): pe iMac nu ruleaza feed-sync-ul, iar fara partitia lunii curente
// fiecare upsert esua cu „no partition of relation price_history” (eMAG, sep 2026).
export async function ensurePriceHistoryPartitions(): Promise<void> {
  await pool.query(`
    DO $$
    DECLARE start_date DATE; end_date DATE; partition_name TEXT; i INT;
    BEGIN
      FOR i IN 0..2 LOOP
        start_date := date_trunc('month', now() + (i || ' months')::INTERVAL)::DATE;
        end_date   := (start_date + INTERVAL '1 month')::DATE;
        partition_name := 'price_history_' || to_char(start_date, 'YYYY_MM');
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relname = partition_name AND n.nspname = 'public'
        ) THEN
          EXECUTE format('CREATE TABLE %I PARTITION OF price_history FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date);
        END IF;
      END LOOP;
    END $$;
  `)
}
