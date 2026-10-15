-- Permite conservar varios catálogos técnicos por dispositivo.

BEGIN;

SET search_path TO itam, public;

ALTER TABLE catalogos_tecnicos_dispositivo
    DROP CONSTRAINT IF EXISTS catalogos_tecnicos_dispositivo_dispositivo_id_key;

DROP INDEX IF EXISTS catalogos_tecnicos_dispositivo_dispositivo_id_key;

CREATE INDEX IF NOT EXISTS idx_catalogos_tecnicos_dispositivo_fecha
    ON catalogos_tecnicos_dispositivo (dispositivo_id, creado_en DESC, id DESC);

INSERT INTO schema_migrations(version, nombre)
VALUES ('043', 'multiple_device_technical_catalogs')
ON CONFLICT (version) DO NOTHING;

COMMIT;
