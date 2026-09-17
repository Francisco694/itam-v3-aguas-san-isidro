-- Metadata y versiones de archivos de cotización de Servicio Técnico.

BEGIN;

SET search_path TO itam, public;

ALTER TABLE ordenes_servicio_tecnico
    ADD COLUMN IF NOT EXISTS ticket_proveedor VARCHAR(120),
    ADD COLUMN IF NOT EXISTS observaciones_cotizacion TEXT;

CREATE TABLE IF NOT EXISTS servicio_tecnico_cotizaciones_archivos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_servicio_tecnico_id BIGINT NOT NULL
        REFERENCES ordenes_servicio_tecnico(id) ON DELETE RESTRICT,
    dispositivo_id BIGINT NOT NULL
        REFERENCES dispositivos(id) ON DELETE RESTRICT,
    proveedor VARCHAR(180),
    nombre_original VARCHAR(255) NOT NULL,
    nombre_archivo VARCHAR(120) NOT NULL,
    mime_type VARCHAR(120) NOT NULL,
    tamanio_bytes BIGINT NOT NULL CHECK (tamanio_bytes BETWEEN 1 AND 10485760),
    ruta_archivo VARCHAR(300) NOT NULL,
    version INTEGER NOT NULL CHECK (version > 0),
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    subido_por VARCHAR(150) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_st_cotizacion_archivo_activo
    ON servicio_tecnico_cotizaciones_archivos (orden_servicio_tecnico_id)
    WHERE activo;

CREATE INDEX IF NOT EXISTS idx_st_cotizacion_archivo_orden
    ON servicio_tecnico_cotizaciones_archivos (orden_servicio_tecnico_id, version DESC);

INSERT INTO schema_migrations (version, nombre)
VALUES ('032', 'technical_service_quotes');

COMMIT;
