-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 006 - Familias configurables y protecciones históricas
-- ============================================================

BEGIN;

SET search_path TO itam, public;

ALTER TABLE familias_codigo_inventario
    ADD COLUMN estrategia_codigo VARCHAR(30) NOT NULL DEFAULT 'REPEAT_PREFIX',
    ADD COLUMN version_esquema SMALLINT NOT NULL DEFAULT 1,
    ADD CONSTRAINT chk_familia_estrategia
        CHECK (estrategia_codigo IN ('REPEAT_PREFIX')),
    ADD CONSTRAINT chk_familia_version_esquema
        CHECK (version_esquema > 0),
    ADD CONSTRAINT chk_familia_nombre
        CHECK (BTRIM(nombre_familia) <> '');

CREATE UNIQUE INDEX uq_familia_nombre_normalizado
    ON familias_codigo_inventario (LOWER(BTRIM(nombre_familia)));

INSERT INTO familias_codigo_inventario (
    tipo_entidad,
    tipo_activo_normalizado,
    nombre_familia,
    prefijo
)
VALUES
    ('DISPOSITIVO', 'NOTEBOOK', 'Notebook', '3'),
    ('DISPOSITIVO', 'MONITOR', 'Monitor', '4'),
    ('DISPOSITIVO', 'PC', 'PC', '5'),
    ('DISPOSITIVO', 'PERIFERICOS', 'Periféricos', '6');

UPDATE tipos_dispositivo AS tipo
SET familia_codigo_inventario_id = familia.id,
    descripcion = COALESCE(
        tipo.descripcion,
        'Equipo portátil administrado como dispositivo ITAM.'
    )
FROM familias_codigo_inventario AS familia
WHERE LOWER(BTRIM(tipo.nombre)) = 'notebook'
  AND familia.prefijo = '3'
  AND tipo.familia_codigo_inventario_id IS NULL;

INSERT INTO tipos_dispositivo (
    nombre,
    descripcion,
    familia_codigo_inventario_id
)
SELECT
    datos.nombre,
    datos.descripcion,
    familia.id
FROM (
    VALUES
        ('Monitor', 'Pantalla o monitor corporativo.', '4'),
        ('PC', 'Equipo de escritorio corporativo.', '5')
) AS datos(nombre, descripcion, prefijo)
INNER JOIN familias_codigo_inventario AS familia
    ON familia.prefijo = datos.prefijo
ON CONFLICT DO NOTHING;

UPDATE tipos_dispositivo AS tipo
SET familia_codigo_inventario_id = familia.id
FROM familias_codigo_inventario AS familia
WHERE LOWER(BTRIM(tipo.nombre)) = LOWER(BTRIM(familia.nombre_familia))
  AND familia.prefijo IN ('4', '5')
  AND tipo.familia_codigo_inventario_id IS NULL;

ALTER TABLE tipos_dispositivo
    ADD COLUMN requiere_imei BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE tipos_dispositivo
SET requiere_imei = TRUE
WHERE LOWER(BTRIM(nombre)) = 'smartphone';

COMMENT ON COLUMN tipos_dispositivo.requiere_imei IS
'Configuración de UI y validación para mostrar el campo IMEI sin depender del nombre del tipo.';

COMMENT ON COLUMN familias_codigo_inventario.estrategia_codigo IS
'Estrategia genérica de generación. La versión actual admite REPEAT_PREFIX.';

COMMENT ON COLUMN familias_codigo_inventario.version_esquema IS
'Versión del esquema de numeración; permite incorporar estrategias futuras sin reinterpretar códigos emitidos.';

CREATE OR REPLACE FUNCTION fn_proteger_prefijo_familia_en_uso()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.prefijo IS DISTINCT FROM OLD.prefijo AND (
        OLD.ultimo_ordinal > 0
        OR EXISTS (
            SELECT 1
            FROM tipos_dispositivo AS tipo
            INNER JOIN dispositivos AS dispositivo
                ON dispositivo.tipo_dispositivo_id = tipo.id
            WHERE tipo.familia_codigo_inventario_id = OLD.id
        )
        OR (
            OLD.tipo_entidad = 'SIM'
            AND EXISTS (SELECT 1 FROM sim)
        )
    ) THEN
        RAISE EXCEPTION
            'No se puede modificar el prefijo de una familia que ya posee códigos emitidos.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_familia_proteger_prefijo_en_uso
BEFORE UPDATE OF prefijo
ON familias_codigo_inventario
FOR EACH ROW
EXECUTE FUNCTION fn_proteger_prefijo_familia_en_uso();

CREATE OR REPLACE FUNCTION fn_proteger_cambio_familia_tipo_en_uso()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.familia_codigo_inventario_id IS DISTINCT FROM
       OLD.familia_codigo_inventario_id
       AND EXISTS (
           SELECT 1
           FROM dispositivos
           WHERE tipo_dispositivo_id = OLD.id
       ) THEN
        RAISE EXCEPTION
            'No se puede mover este tipo a otra familia porque existen activos con códigos históricos asociados.'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tipo_proteger_cambio_familia_en_uso
BEFORE UPDATE OF familia_codigo_inventario_id
ON tipos_dispositivo
FOR EACH ROW
EXECUTE FUNCTION fn_proteger_cambio_familia_tipo_en_uso();

CREATE OR REPLACE FUNCTION fn_proteger_cambio_tipo_dispositivo()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    familia_anterior BIGINT;
    familia_nueva BIGINT;
BEGIN
    IF NEW.tipo_dispositivo_id IS DISTINCT FROM OLD.tipo_dispositivo_id THEN
        SELECT familia_codigo_inventario_id
        INTO familia_anterior
        FROM tipos_dispositivo
        WHERE id = OLD.tipo_dispositivo_id;

        SELECT familia_codigo_inventario_id
        INTO familia_nueva
        FROM tipos_dispositivo
        WHERE id = NEW.tipo_dispositivo_id;

        IF familia_anterior IS DISTINCT FROM familia_nueva THEN
            RAISE EXCEPTION
                'No se puede cambiar el tipo porque contradice la familia histórica del código ITAM.'
                USING ERRCODE = 'P0001';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dispositivo_proteger_cambio_tipo
BEFORE UPDATE OF tipo_dispositivo_id
ON dispositivos
FOR EACH ROW
EXECUTE FUNCTION fn_proteger_cambio_tipo_dispositivo();

INSERT INTO schema_migrations (version, nombre)
VALUES ('006', 'configurable_inventory_code_families');

COMMIT;

-- Reversión manual conservadora:
-- No eliminar familias ni tipos si ya emitieron códigos después de esta migración.
-- En contingencia productiva se recomienda restaurar el backup previo.
