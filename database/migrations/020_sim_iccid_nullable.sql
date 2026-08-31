BEGIN;

SET search_path TO itam, public;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'itam'
          AND table_name = 'sim'
          AND column_name = 'iccid_codigo_fabrica'
          AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE sim
            ALTER COLUMN iccid_codigo_fabrica DROP NOT NULL;
    END IF;
END
$$;

COMMENT ON COLUMN sim.iccid_codigo_fabrica IS
'ICCID físico de la SIM. Puede ser NULL únicamente para registros históricos pendientes de completar; los valores informados continúan siendo únicos.';

INSERT INTO schema_migrations (version, nombre)
VALUES ('020', 'sim_iccid_nullable')
ON CONFLICT (version) DO NOTHING;

COMMIT;
