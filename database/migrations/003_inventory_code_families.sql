-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 003 - Familias de código y custodia departamental
--
-- - Configura prefijos sin codificarlos en la aplicación.
-- - Mantiene un numerador transaccional por familia.
-- - Permite custodia directa de departamento sin receptor personal.
-- - Conserva códigos y asignaciones existentes.
-- ============================================================

BEGIN;

SET search_path TO itam, public;

CREATE TABLE familias_codigo_inventario (
    id                      BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tipo_entidad            VARCHAR(20) NOT NULL,
    tipo_activo_normalizado VARCHAR(80),
    nombre_familia          VARCHAR(100) NOT NULL,
    prefijo                 CHAR(1) NOT NULL,
    ultimo_ordinal          INTEGER NOT NULL DEFAULT 0,
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_familia_tipo_entidad
        CHECK (tipo_entidad IN ('DISPOSITIVO', 'SIM')),
    CONSTRAINT chk_familia_tipo_activo
        CHECK (
            (tipo_entidad = 'DISPOSITIVO' AND tipo_activo_normalizado IS NOT NULL)
            OR
            (tipo_entidad = 'SIM' AND tipo_activo_normalizado IS NULL)
        ),
    CONSTRAINT chk_familia_prefijo
        CHECK (prefijo ~ '^[1-9]$'),
    CONSTRAINT chk_familia_ordinal
        CHECK (ultimo_ordinal >= 0),
    CONSTRAINT uq_familia_prefijo UNIQUE (prefijo)
);

CREATE UNIQUE INDEX uq_familia_entidad_tipo
    ON familias_codigo_inventario (
        tipo_entidad,
        COALESCE(tipo_activo_normalizado, '')
    );

COMMENT ON TABLE familias_codigo_inventario IS
'Configuración y numerador atómico para códigos ITAM por familia de activo.';

COMMENT ON COLUMN familias_codigo_inventario.ultimo_ordinal IS
'Último ordinal reservado. Debe actualizarse bajo bloqueo de fila dentro de la transacción de alta.';

INSERT INTO familias_codigo_inventario (
    tipo_entidad,
    tipo_activo_normalizado,
    nombre_familia,
    prefijo
)
VALUES
    ('DISPOSITIVO', 'SMARTPHONE', 'Smartphone', '1'),
    ('SIM', NULL, 'SIM', '2');

-- La custodia directa pertenece al departamento; recibido_por_id queda
-- disponible como dato histórico/opcional, pero deja de ser obligatorio.
ALTER TABLE dispositivos
    DROP CONSTRAINT IF EXISTS chk_dispositivo_recepcion_departamento;

CREATE TRIGGER trg_familia_codigo_actualizado_en
BEFORE UPDATE
ON familias_codigo_inventario
FOR EACH ROW
EXECUTE FUNCTION fn_actualizar_timestamp();

INSERT INTO schema_migrations (version, nombre)
VALUES ('003', 'inventory_code_families');

COMMIT;

-- Reversión razonable (manual, solo si no se han generado altas nuevas):
-- BEGIN;
-- DROP TRIGGER IF EXISTS trg_familia_codigo_actualizado_en ON familias_codigo_inventario;
-- DROP TABLE IF EXISTS familias_codigo_inventario;
-- ALTER TABLE dispositivos ADD CONSTRAINT chk_dispositivo_recepcion_departamento
-- CHECK ((departamento_id IS NULL AND recibido_por_id IS NULL)
--     OR (departamento_id IS NOT NULL AND recibido_por_id IS NOT NULL));
-- DELETE FROM schema_migrations WHERE version = '003';
-- COMMIT;
