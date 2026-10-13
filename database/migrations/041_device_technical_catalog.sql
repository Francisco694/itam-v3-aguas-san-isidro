-- Catálogo técnico opcional asociado a un dispositivo ya registrado.
-- El PDF se almacena fuera de PostgreSQL; esta tabla conserva sus metadatos.

BEGIN;

SET search_path TO itam, public;

CREATE TABLE catalogos_tecnicos_dispositivo (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dispositivo_id BIGINT NOT NULL UNIQUE
        REFERENCES dispositivos(id) ON DELETE RESTRICT,
    nombre_original VARCHAR(255) NOT NULL,
    nombre_almacenado VARCHAR(120) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    tamano_bytes BIGINT NOT NULL,
    ruta VARCHAR(300) NOT NULL,
    subido_por VARCHAR(150) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_catalogo_tecnico_metadata CHECK (
        mime_type = 'application/pdf'
        AND tamano_bytes BETWEEN 1 AND 10485760
    )
);

CREATE INDEX idx_catalogos_tecnicos_dispositivo
    ON catalogos_tecnicos_dispositivo (dispositivo_id);

INSERT INTO schema_migrations(version, nombre)
VALUES ('041', 'device_technical_catalog');

COMMIT;
