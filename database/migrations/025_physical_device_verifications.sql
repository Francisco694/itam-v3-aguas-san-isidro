-- ITAM - Verificación física basada en evidencia operacional
BEGIN;
SET search_path TO itam, public;

CREATE TABLE IF NOT EXISTS verificaciones_fisicas_dispositivo (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dispositivo_id BIGINT NOT NULL REFERENCES dispositivos(id) ON DELETE RESTRICT,
    encontrado BOOLEAN NOT NULL,
    identificador_comprobado VARCHAR(150),
    identificador_esperado VARCHAR(150),
    resultado VARCHAR(20) NOT NULL,
    observacion TEXT,
    usuario_id BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    fecha_verificacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE verificaciones_fisicas_dispositivo
  DROP CONSTRAINT IF EXISTS chk_verificacion_fisica_resultado;

UPDATE verificaciones_fisicas_dispositivo
   SET resultado = 'REVISAR'
 WHERE resultado IN ('REVISAR_DATOS', 'NO_ENCONTRADO');

ALTER TABLE verificaciones_fisicas_dispositivo
  ADD CONSTRAINT chk_verificacion_fisica_resultado
  CHECK (resultado IN ('PENDIENTE', 'VERIFICADO', 'REVISAR'));

CREATE INDEX IF NOT EXISTS idx_verificacion_fisica_dispositivo_fecha
  ON verificaciones_fisicas_dispositivo (dispositivo_id, fecha_verificacion DESC);

COMMENT ON TABLE verificaciones_fisicas_dispositivo IS
  'Histórico append-only de verificaciones físicas y evidencias operacionales.';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE version = '025' AND nombre IS DISTINCT FROM 'physical_device_verifications'
    ) THEN
        RAISE EXCEPTION 'Migration 025 is registered with a different name';
    END IF;
END;
$$;

INSERT INTO schema_migrations (version, nombre)
VALUES ('025', 'physical_device_verifications')
ON CONFLICT (version) DO NOTHING;

COMMIT;
