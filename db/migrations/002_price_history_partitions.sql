-- Creeaza partitiile lunare pentru price_history
-- Acest script genereaza luna curenta + urmatoarea 2 luni in avans
DO $$
DECLARE
    start_date DATE;
    end_date   DATE;
    partition_name TEXT;
    i INT;
BEGIN
    FOR i IN 0..2 LOOP
        start_date := date_trunc('month', now() + (i || ' months')::INTERVAL)::DATE;
        end_date   := (start_date + INTERVAL '1 month')::DATE;
        partition_name := 'price_history_' || to_char(start_date, 'YYYY_MM');

        IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = partition_name AND n.nspname = 'public'
        ) THEN
            EXECUTE format(
                'CREATE TABLE %I PARTITION OF price_history FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
            RAISE NOTICE 'Created partition: %', partition_name;
        ELSE
            RAISE NOTICE 'Partition already exists: %', partition_name;
        END IF;
    END LOOP;
END;
$$;
