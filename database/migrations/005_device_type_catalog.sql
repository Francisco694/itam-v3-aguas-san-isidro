-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 005 - Catálogo normalizado de tipos de dispositivo
--
-- - Conserva todos los tipos textuales existentes.
-- - Vincula cada dispositivo a un tipo por FK.
-- - Relaciona opcionalmente un tipo con su familia de código.
-- - Mantiene tipo_dispositivo como espejo temporal de compatibilidad.
-- ============================================================

BEGIN;

SET search_path TO itam, public;

CREATE TABLE tipos_dispositivo (
    id                            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre                        VARCHAR(80) NOT NULL,
    descripcion                   TEXT,
    familia_codigo_inventario_id  BIGINT,
    activo                        BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en                TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_tipo_dispositivo_nombre
        CHECK (BTRIM(nombre) <> ''),
    CONSTRAINT fk_tipo_dispositivo_familia
        FOREIGN KEY (familia_codigo_inventario_id)
        REFERENCES familias_codigo_inventario(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);

CREATE UNIQUE INDEX uq_tipo_dispositivo_nombre_normalizado
    ON tipos_dispositivo (LOWER(BTRIM(nombre)));

COMMENT ON TABLE tipos_dispositivo IS
'Catálogo administrable y normalizado de tipos de dispositivo.';

COMMENT ON COLUMN tipos_dispositivo.familia_codigo_inventario_id IS
'Familia que permite generar el código físico al crear un dispositivo de este tipo.';

-- Tipos mínimos necesarios para los flujos solicitados.
INSERT INTO tipos_dispositivo (
    nombre,
    descripcion,
    familia_codigo_inventario_id
)
SELECT
    'Smartphone',
    'Teléfono inteligente administrado como dispositivo ITAM.',
    familia.id
FROM familias_codigo_inventario AS familia
WHERE familia.tipo_entidad = 'DISPOSITIVO'
  AND familia.tipo_activo_normalizado = 'SMARTPHONE'
ON CONFLICT DO NOTHING;

INSERT INTO tipos_dispositivo (nombre, descripcion)
VALUES (
    'Notebook',
    'Equipo portátil. Requiere configurar una familia de código antes de crear activos.'
)
ON CONFLICT DO NOTHING;

-- Conserva sin reinterpretar todos los tipos presentes en producción.
INSERT INTO tipos_dispositivo (nombre)
SELECT DISTINCT BTRIM(dispositivo.tipo_dispositivo)
FROM dispositivos AS dispositivo
WHERE BTRIM(dispositivo.tipo_dispositivo) <> ''
ON CONFLICT DO NOTHING;

ALTER TABLE dispositivos
    ADD COLUMN tipo_dispositivo_id BIGINT;

UPDATE dispositivos AS dispositivo
SET tipo_dispositivo_id = tipo.id
FROM tipos_dispositivo AS tipo
WHERE LOWER(BTRIM(tipo.nombre)) =
      LOWER(BTRIM(dispositivo.tipo_dispositivo));

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM dispositivos
        WHERE tipo_dispositivo_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'No fue posible relacionar todos los dispositivos con el catálogo de tipos.';
    END IF;
END;
$$;

ALTER TABLE dispositivos
    ALTER COLUMN tipo_dispositivo_id SET NOT NULL,
    ADD CONSTRAINT fk_dispositivo_tipo_dispositivo
        FOREIGN KEY (tipo_dispositivo_id)
        REFERENCES tipos_dispositivo(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT;

CREATE INDEX idx_dispositivos_tipo_dispositivo_id
    ON dispositivos (tipo_dispositivo_id);

CREATE OR REPLACE FUNCTION fn_sincronizar_tipo_dispositivo_legacy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    SELECT tipo.nombre
    INTO NEW.tipo_dispositivo
    FROM tipos_dispositivo AS tipo
    WHERE tipo.id = NEW.tipo_dispositivo_id;

    IF NEW.tipo_dispositivo IS NULL THEN
        RAISE EXCEPTION 'El tipo de dispositivo seleccionado no existe.'
            USING ERRCODE = '23503';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dispositivo_sincronizar_tipo_legacy
BEFORE INSERT OR UPDATE OF tipo_dispositivo_id
ON dispositivos
FOR EACH ROW
EXECUTE FUNCTION fn_sincronizar_tipo_dispositivo_legacy();

CREATE OR REPLACE FUNCTION fn_sincronizar_nombre_tipo_legacy()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE dispositivos
    SET tipo_dispositivo = NEW.nombre
    WHERE tipo_dispositivo_id = NEW.id;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tipo_dispositivo_sincronizar_nombre_legacy
AFTER UPDATE OF nombre
ON tipos_dispositivo
FOR EACH ROW
WHEN (NEW.nombre IS DISTINCT FROM OLD.nombre)
EXECUTE FUNCTION fn_sincronizar_nombre_tipo_legacy();

CREATE TRIGGER trg_tipo_dispositivo_actualizado_en
BEFORE UPDATE
ON tipos_dispositivo
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_timestamp();

COMMENT ON COLUMN dispositivos.tipo_dispositivo IS
'Campo legado mantenido como espejo por compatibilidad. La fuente de verdad es tipo_dispositivo_id.';

INSERT INTO schema_migrations (version, nombre)
VALUES ('005', 'device_type_catalog');

COMMIT;

-- Reversión manual y controlada:
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_dispositivo_sincronizar_tipo_legacy ON dispositivos;
-- DROP TRIGGER IF EXISTS trg_tipo_dispositivo_sincronizar_nombre_legacy ON tipos_dispositivo;
-- DROP TRIGGER IF EXISTS trg_tipo_dispositivo_actualizado_en ON tipos_dispositivo;
-- DROP FUNCTION IF EXISTS fn_sincronizar_tipo_dispositivo_legacy();
-- DROP FUNCTION IF EXISTS fn_sincronizar_nombre_tipo_legacy();
-- ALTER TABLE dispositivos DROP CONSTRAINT IF EXISTS fk_dispositivo_tipo_dispositivo;
-- DROP INDEX IF EXISTS idx_dispositivos_tipo_dispositivo_id;
-- ALTER TABLE dispositivos DROP COLUMN IF EXISTS tipo_dispositivo_id;
-- DROP TABLE IF EXISTS tipos_dispositivo;
-- DELETE FROM schema_migrations WHERE version = '005';
-- COMMIT;
