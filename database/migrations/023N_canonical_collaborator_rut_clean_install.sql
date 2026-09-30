-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 023N - RUT canónico para instalación nueva
--
-- Esta variante sustituye exclusivamente a la conciliación histórica 023
-- cuando la base está vacía. No crea colaboradores ficticios, no ejecuta la
-- conciliación de los IDs históricos 1/392 y no registra la versión 023.
-- ============================================================

BEGIN;

SET search_path TO itam, public;

DO $$
BEGIN
    IF to_regclass('itam.colaboradores') IS NULL
       OR to_regclass('itam.schema_migrations') IS NULL THEN
        RAISE EXCEPTION
            '023N requiere que las migraciones iniciales hayan creado colaboradores y schema_migrations';
    END IF;

    IF EXISTS (SELECT 1 FROM colaboradores) THEN
        RAISE EXCEPTION
            '023N solo puede ejecutarse en una instalación nueva sin colaboradores';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM schema_migrations
        WHERE version IN ('023', '023N')
    ) THEN
        RAISE EXCEPTION
            'La etapa de RUT ya está registrada como 023 o 023N';
    END IF;
END;
$$;

-- 001 creó una restricción UNIQUE sobre rut. Se reemplaza por la regla
-- canónica que se utilizará en instalaciones nuevas.
ALTER TABLE colaboradores
    DROP CONSTRAINT IF EXISTS colaboradores_rut_key;

ALTER TABLE colaboradores
    ALTER COLUMN rut TYPE TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'itam.colaboradores'::regclass
          AND conname = 'chk_colaboradores_rut_canonico'
    ) THEN
        ALTER TABLE colaboradores
            ADD CONSTRAINT chk_colaboradores_rut_canonico
            CHECK (
                rut ~ '^[0-9]+[0-9K]$'
                AND rut = UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g'))
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'itam.colaboradores'::regclass
          AND conname = 'uq_colaboradores_rut_canonico'
    ) THEN
        ALTER TABLE colaboradores
            ADD CONSTRAINT uq_colaboradores_rut_canonico UNIQUE (rut);
    END IF;
END;
$$;

COMMENT ON COLUMN colaboradores.rut IS
'RUT canónico sin puntos, guion ni espacios; dígitos y dígito verificador K en mayúscula.';

-- Se registra la variante aplicada, nunca la conciliación histórica 023.
INSERT INTO schema_migrations (version, nombre)
VALUES ('023N', 'canonical_collaborator_rut_clean_install');

COMMIT;
