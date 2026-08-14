-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 002 - Integrity Rules
--
-- Refuerza reglas de integridad del dominio:
--   - Estados compatibles con cada entidad
--   - Código de inventario globalmente único
--   - Recepción obligatoria en asignación departamental
--   - Actualización automática de timestamps
--
-- ============================================================

BEGIN;

SET search_path TO itam, public;


-- ============================================================
-- 1. VALIDAR ESTADO SEGÚN TIPO DE ENTIDAD
-- ============================================================

CREATE OR REPLACE FUNCTION fn_validar_estado_entidad()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tipo_entidad VARCHAR(20);
    v_activo       BOOLEAN;
BEGIN

    SELECT
        tipo_entidad,
        activo
    INTO
        v_tipo_entidad,
        v_activo
    FROM estados
    WHERE id = NEW.estado_id;


    IF NOT FOUND THEN
        RAISE EXCEPTION
            'El estado con ID % no existe.',
            NEW.estado_id;
    END IF;


    IF v_tipo_entidad <> TG_ARGV[0] THEN
        RAISE EXCEPTION
            'Estado incompatible. Se esperaba un estado de tipo %, pero el estado seleccionado pertenece a %.',
            TG_ARGV[0],
            v_tipo_entidad;
    END IF;


    IF v_activo = FALSE THEN
        RAISE EXCEPTION
            'No se puede utilizar un estado que se encuentra inactivo.';
    END IF;


    RETURN NEW;

END;
$$;


CREATE TRIGGER trg_dispositivo_validar_estado
BEFORE INSERT OR UPDATE OF estado_id
ON dispositivos
FOR EACH ROW
EXECUTE FUNCTION fn_validar_estado_entidad('DISPOSITIVO');


CREATE TRIGGER trg_sim_validar_estado
BEFORE INSERT OR UPDATE OF estado_id
ON sim
FOR EACH ROW
EXECUTE FUNCTION fn_validar_estado_entidad('SIM');


-- ============================================================
-- 2. VALIDAR ESTADOS DEL HISTORIAL
-- ============================================================

CREATE OR REPLACE FUNCTION fn_validar_estado_historial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_tipo VARCHAR(20);
BEGIN

    IF NEW.estado_anterior_id IS NOT NULL THEN

        SELECT tipo_entidad
        INTO v_tipo
        FROM estados
        WHERE id = NEW.estado_anterior_id;


        IF NOT FOUND OR v_tipo <> NEW.tipo_entidad THEN

            RAISE EXCEPTION
                'El estado anterior no corresponde al tipo de entidad %.',

                NEW.tipo_entidad;

        END IF;

    END IF;


    IF NEW.estado_nuevo_id IS NOT NULL THEN

        SELECT tipo_entidad
        INTO v_tipo
        FROM estados
        WHERE id = NEW.estado_nuevo_id;


        IF NOT FOUND OR v_tipo <> NEW.tipo_entidad THEN

            RAISE EXCEPTION
                'El estado nuevo no corresponde al tipo de entidad %.',

                NEW.tipo_entidad;

        END IF;

    END IF;


    RETURN NEW;

END;
$$;


CREATE TRIGGER trg_historial_validar_estado
BEFORE INSERT
ON historial_eventos
FOR EACH ROW
EXECUTE FUNCTION fn_validar_estado_historial();


-- ============================================================
-- 3. CÓDIGO DE INVENTARIO GLOBALMENTE ÚNICO
-- ============================================================

CREATE OR REPLACE FUNCTION fn_validar_codigo_inventario_global()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    -- Evita condiciones de carrera sobre el mismo código.
    PERFORM pg_advisory_xact_lock(
        NEW.codigo_inventario::BIGINT
    );


    IF TG_TABLE_NAME = 'dispositivos' THEN

        IF EXISTS (
            SELECT 1
            FROM sim
            WHERE codigo_inventario =
                  NEW.codigo_inventario
        )
        THEN

            RAISE EXCEPTION
                'El código de inventario % ya está siendo utilizado por una SIM.',
                NEW.codigo_inventario;

        END IF;


    ELSIF TG_TABLE_NAME = 'sim' THEN

        IF EXISTS (
            SELECT 1
            FROM dispositivos
            WHERE codigo_inventario =
                  NEW.codigo_inventario
        )
        THEN

            RAISE EXCEPTION
                'El código de inventario % ya está siendo utilizado por un dispositivo.',
                NEW.codigo_inventario;

        END IF;

    END IF;


    RETURN NEW;

END;
$$;


CREATE TRIGGER trg_dispositivo_codigo_global
BEFORE INSERT OR UPDATE OF codigo_inventario
ON dispositivos
FOR EACH ROW
EXECUTE FUNCTION fn_validar_codigo_inventario_global();


CREATE TRIGGER trg_sim_codigo_global
BEFORE INSERT OR UPDATE OF codigo_inventario
ON sim
FOR EACH ROW
EXECUTE FUNCTION fn_validar_codigo_inventario_global();


-- ============================================================
-- 4. REFORZAR ASIGNACIÓN A DEPARTAMENTO
-- ============================================================

ALTER TABLE dispositivos
ADD CONSTRAINT chk_dispositivo_recepcion_departamento
CHECK (

    (
        departamento_id IS NULL
        AND
        recibido_por_id IS NULL
    )

    OR

    (
        departamento_id IS NOT NULL
        AND
        recibido_por_id IS NOT NULL
    )

);


-- ============================================================
-- 5. ACTUALIZACIÓN AUTOMÁTICA DE FECHAS
-- ============================================================

CREATE OR REPLACE FUNCTION fn_actualizar_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    NEW.actualizado_en := NOW();

    RETURN NEW;

END;
$$;


CREATE TRIGGER trg_departamento_actualizado_en
BEFORE UPDATE
ON departamentos
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_timestamp();


CREATE TRIGGER trg_colaborador_actualizado_en
BEFORE UPDATE
ON colaboradores
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_timestamp();


CREATE TRIGGER trg_dispositivo_actualizado_en
BEFORE UPDATE
ON dispositivos
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_timestamp();


CREATE TRIGGER trg_sim_actualizado_en
BEFORE UPDATE
ON sim
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_timestamp();


-- ============================================================
-- 6. REGISTRAR MIGRACIÓN
-- ============================================================

INSERT INTO schema_migrations (
    version,
    nombre
)
VALUES (
    '002',
    'integrity_rules'
);


COMMIT;