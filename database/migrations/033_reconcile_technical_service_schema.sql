-- ============================================================
-- ITAM - Reconciliación del esquema de Servicio Técnico
--
-- Esta migración corrige una instalación donde 030, 031 y 032
-- están registradas, pero 029 quedó fuera de secuencia.
--
-- IMPORTANTE:
--   * No ejecuta ni registra la migración 029.
--   * No rellena tipo_servicio para registros históricos.
--   * No elimina ni reemplaza datos existentes.
-- ============================================================

BEGIN;

SET search_path TO itam, public;

ALTER TABLE ordenes_servicio_tecnico
    ADD COLUMN IF NOT EXISTS tipo_servicio VARCHAR(20),
    ADD COLUMN IF NOT EXISTS accesorios_entregados TEXT;

-- Unifica instalaciones existentes y nuevas. No se rellena ningún registro:
-- una orden histórica puede conservar un tipo de servicio desconocido. Las
-- altas del backend siguen enviando explícitamente un valor permitido.
ALTER TABLE ordenes_servicio_tecnico
    ALTER COLUMN tipo_servicio DROP DEFAULT,
    ALTER COLUMN tipo_servicio DROP NOT NULL;

-- estado_final fue creado por 031 como VARCHAR(50). Si una instalación
-- parcial conserva el VARCHAR(20) de 029, solo se amplía cuando todos los
-- valores existentes caben en VARCHAR(50). Nunca se truncan datos.
DO $$
DECLARE
    v_data_type TEXT;
    v_max_length INTEGER;
    v_longest_value INTEGER;
BEGIN
    SELECT data_type, character_maximum_length
      INTO v_data_type, v_max_length
      FROM information_schema.columns
     WHERE table_schema = 'itam'
       AND table_name = 'ordenes_servicio_tecnico'
       AND column_name = 'estado_final';

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'No se puede reconciliar Servicio Técnico: falta la columna estado_final';
    END IF;

    IF v_data_type = 'character varying'
       AND v_max_length IS NOT DISTINCT FROM 50 THEN
        NULL;
    ELSE
        SELECT COALESCE(MAX(char_length(estado_final)), 0)
          INTO v_longest_value
          FROM ordenes_servicio_tecnico
         WHERE estado_final IS NOT NULL;

        IF v_longest_value > 50 THEN
            RAISE EXCEPTION
                'No se puede normalizar estado_final a VARCHAR(50): existe un valor de % caracteres',
                v_longest_value;
        END IF;

        IF v_data_type IN ('character varying', 'text') THEN
            ALTER TABLE ordenes_servicio_tecnico
                ALTER COLUMN estado_final TYPE VARCHAR(50)
                USING estado_final::VARCHAR(50);
        ELSE
            RAISE EXCEPTION
                'Tipo no compatible para estado_final: %', v_data_type;
        END IF;
    END IF;
END $$;

-- El NULL de tipo_servicio representa una orden histórica cuyo tipo original
-- no puede determinarse. Las órdenes nuevas lo reciben explícitamente desde
-- el backend; no se usa DIAGNOSTICO como valor retroactivo.
DO $$
DECLARE
    v_definition TEXT;
BEGIN
    IF EXISTS (
        SELECT 1
          FROM ordenes_servicio_tecnico
         WHERE tipo_servicio IS NOT NULL
           AND tipo_servicio NOT IN ('GARANTIA', 'REPARACION', 'MANTENCION', 'DIAGNOSTICO')
    ) THEN
        RAISE EXCEPTION
            'Existen valores de tipo_servicio fuera del catálogo permitido';
    END IF;

    SELECT pg_get_constraintdef(oid)
      INTO v_definition
      FROM pg_constraint
     WHERE conrelid = 'itam.ordenes_servicio_tecnico'::regclass
       AND conname = 'chk_orden_servicio_tipo_servicio';

    IF NOT FOUND THEN
        ALTER TABLE ordenes_servicio_tecnico
            ADD CONSTRAINT chk_orden_servicio_tipo_servicio CHECK (
                tipo_servicio IS NULL
                OR tipo_servicio IN ('GARANTIA', 'REPARACION', 'MANTENCION', 'DIAGNOSTICO')
            );
    ELSIF POSITION('IS NULL' IN UPPER(v_definition)) = 0 THEN
        -- 029 usa CHECK (tipo_servicio IN (...)). Se reemplaza la definición
        -- para que el esquema final sea idéntico y admita históricos NULL.
        ALTER TABLE ordenes_servicio_tecnico
            DROP CONSTRAINT chk_orden_servicio_tipo_servicio;
        ALTER TABLE ordenes_servicio_tecnico
            ADD CONSTRAINT chk_orden_servicio_tipo_servicio CHECK (
                tipo_servicio IS NULL
                OR tipo_servicio IN ('GARANTIA', 'REPARACION', 'MANTENCION', 'DIAGNOSTICO')
            );
    END IF;
END $$;

-- 031 ya crea esta restricción en instalaciones nuevas. El bloque permite
-- completar instalaciones parciales sin duplicarla.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'itam.ordenes_servicio_tecnico'::regclass
           AND conname = 'chk_orden_servicio_estado_final'
    ) THEN
        ALTER TABLE ordenes_servicio_tecnico
            ADD CONSTRAINT chk_orden_servicio_estado_final CHECK (
                estado_final IS NULL OR estado_final IN ('OPERATIVO', 'SIN_REPARACION', 'BAJA')
            );
    END IF;
END $$;

-- schema_migrations solo contiene version, nombre y aplicado_en. La fila de
-- 029 permanece ausente deliberadamente; esta migración registra únicamente
-- la reconciliación que sí fue ejecutada.
INSERT INTO schema_migrations (version, nombre)
VALUES ('033', 'reconcile_technical_service_schema')
ON CONFLICT (version) DO NOTHING;

COMMIT;
