-- ITAM - Alertas configurables de stock disponible por tipo de dispositivo
BEGIN;
SET search_path TO itam, public;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE version = '026' AND nombre IS DISTINCT FROM 'configurable_stock_alerts'
    ) THEN
        RAISE EXCEPTION 'Migration 026 is registered with a different name';
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS configuraciones_alerta_stock (
    tipo_dispositivo_id BIGINT PRIMARY KEY
        REFERENCES tipos_dispositivo(id) ON DELETE CASCADE,
    minimo_disponible INTEGER NOT NULL DEFAULT 0,
    alerta_activa BOOLEAN NOT NULL DEFAULT FALSE,
    creado_por_usuario_id BIGINT
        REFERENCES usuarios(id) ON DELETE RESTRICT,
    actualizado_por_usuario_id BIGINT
        REFERENCES usuarios(id) ON DELETE RESTRICT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_alerta_stock_minimo_no_negativo
        CHECK (minimo_disponible >= 0)
);

DROP TRIGGER IF EXISTS trg_configuracion_alerta_stock_actualizado_en
    ON configuraciones_alerta_stock;
CREATE TRIGGER trg_configuracion_alerta_stock_actualizado_en
BEFORE UPDATE ON configuraciones_alerta_stock
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

INSERT INTO configuraciones_alerta_stock (
    tipo_dispositivo_id, minimo_disponible, alerta_activa
)
SELECT id, 0, UPPER(BTRIM(nombre)) = 'SMARTPHONE'
FROM tipos_dispositivo
ON CONFLICT (tipo_dispositivo_id) DO NOTHING;

CREATE OR REPLACE FUNCTION fn_crear_configuracion_alerta_stock_tipo()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO configuraciones_alerta_stock (
        tipo_dispositivo_id, minimo_disponible, alerta_activa
    ) VALUES (
        NEW.id, 0, UPPER(BTRIM(NEW.nombre)) = 'SMARTPHONE'
    ) ON CONFLICT (tipo_dispositivo_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tipo_dispositivo_crear_alerta_stock
    ON tipos_dispositivo;
CREATE TRIGGER trg_tipo_dispositivo_crear_alerta_stock
AFTER INSERT ON tipos_dispositivo
FOR EACH ROW EXECUTE FUNCTION fn_crear_configuracion_alerta_stock_tipo();

COMMENT ON TABLE configuraciones_alerta_stock IS
    'Mínimos configurables; las existencias disponibles se calculan desde el inventario real.';

INSERT INTO schema_migrations (version, nombre)
VALUES ('026', 'configurable_stock_alerts')
ON CONFLICT (version) DO NOTHING;

COMMIT;
