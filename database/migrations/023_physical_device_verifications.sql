-- ITAM - Verificaciones físicas de equipos (histórico append-only)
BEGIN;
SET search_path TO itam, public;

CREATE TABLE verificaciones_fisicas_dispositivo (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dispositivo_id BIGINT NOT NULL REFERENCES dispositivos(id) ON DELETE RESTRICT,
    encontrado BOOLEAN NOT NULL,
    identificador_comprobado VARCHAR(150),
    identificador_esperado VARCHAR(150),
    resultado VARCHAR(20) NOT NULL,
    observacion TEXT,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_verificacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_verificacion_fisica_resultado
      CHECK (resultado IN ('PENDIENTE','VERIFICADO','REVISAR_DATOS','NO_ENCONTRADO'))
);

CREATE INDEX idx_verificacion_fisica_dispositivo_fecha
  ON verificaciones_fisicas_dispositivo (dispositivo_id, fecha_verificacion DESC);

COMMENT ON TABLE verificaciones_fisicas_dispositivo IS
  'Histórico append-only de verificaciones físicas de dispositivos.';

INSERT INTO schema_migrations (version, nombre)
VALUES ('023', 'physical_device_verifications');

COMMIT;
