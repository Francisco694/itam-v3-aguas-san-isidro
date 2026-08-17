-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 004 - Inmutabilidad del código físico del activo
--
-- Impide que el identificador impreso de un dispositivo o SIM
-- cambie después de su alta. No modifica códigos existentes.
-- ============================================================

BEGIN;

SET search_path TO itam, public;

CREATE OR REPLACE FUNCTION fn_bloquear_cambio_codigo_inventario()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.codigo_inventario IS DISTINCT FROM OLD.codigo_inventario THEN
        RAISE EXCEPTION 'El código de inventario es inmutable.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dispositivo_codigo_inmutable
BEFORE UPDATE OF codigo_inventario
ON dispositivos
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_cambio_codigo_inventario();

CREATE TRIGGER trg_sim_codigo_inmutable
BEFORE UPDATE OF codigo_inventario
ON sim
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_cambio_codigo_inventario();

INSERT INTO schema_migrations (version, nombre)
VALUES ('004', 'inventory_code_immutability');

COMMIT;

-- Reversión manual:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_dispositivo_codigo_inmutable ON dispositivos;
-- DROP TRIGGER IF EXISTS trg_sim_codigo_inmutable ON sim;
-- DROP FUNCTION IF EXISTS fn_bloquear_cambio_codigo_inventario();
-- DELETE FROM schema_migrations WHERE version = '004';
-- COMMIT;
