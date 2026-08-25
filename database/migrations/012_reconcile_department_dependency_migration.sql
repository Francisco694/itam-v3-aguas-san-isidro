-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 012 - Reconciliación del registro de migración 009
-- ============================================================

BEGIN;

SET search_path TO itam, public;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'itam'
          AND table_name = 'departamentos'
          AND column_name = 'dependencia_id'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'itam.departamentos'::regclass
          AND conname = 'fk_departamentos_dependencia'
    ) OR NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'itam.departamentos'::regclass
          AND conname = 'chk_departamentos_dependencia_propia'
    ) THEN
        RAISE EXCEPTION 'La estructura esperada de la migración 009 no está completa';
    END IF;
END $$;

INSERT INTO schema_migrations(version, nombre)
VALUES ('009', 'department_dependencies')
ON CONFLICT (version) DO NOTHING;

INSERT INTO schema_migrations(version, nombre)
VALUES ('012', 'reconcile_department_dependency_migration');

COMMIT;
