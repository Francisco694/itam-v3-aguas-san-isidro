-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migracion 021 - Anulacion logica de bajas de dispositivos
-- ============================================================

BEGIN;

SET search_path TO itam, public;

ALTER TABLE bajas_dispositivo
    ADD COLUMN IF NOT EXISTS anulada BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS anulada_en TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'itam.bajas_dispositivo'::regclass
          AND conname = 'chk_baja_anulacion_consistente'
    ) THEN
        ALTER TABLE bajas_dispositivo
            ADD CONSTRAINT chk_baja_anulacion_consistente CHECK (
                (
                    anulada = FALSE
                    AND anulada_en IS NULL
                    AND motivo_anulacion IS NULL
                )
                OR
                (
                    anulada = TRUE
                    AND anulada_en IS NOT NULL
                    AND NULLIF(BTRIM(motivo_anulacion), '') IS NOT NULL
                )
            );
    END IF;
END
$$;

ALTER TABLE bajas_dispositivo
    DROP CONSTRAINT IF EXISTS bajas_dispositivo_dispositivo_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_baja_dispositivo_activa
    ON bajas_dispositivo (dispositivo_id)
    WHERE anulada = FALSE;

CREATE INDEX IF NOT EXISTS idx_bajas_dispositivo_anuladas
    ON bajas_dispositivo (anulada, anulada_en DESC);

COMMENT ON COLUMN bajas_dispositivo.anulada IS
'Indica que la baja fue revertida logicamente; la fila original se conserva para trazabilidad.';

COMMENT ON COLUMN bajas_dispositivo.anulada_en IS
'Fecha en que la baja fue anulada logicamente.';

COMMENT ON COLUMN bajas_dispositivo.motivo_anulacion IS
'Fundamento trazable de la anulacion logica de la baja.';

INSERT INTO schema_migrations (version, nombre)
VALUES ('021', 'logical_cancellation_device_disposals')
ON CONFLICT (version) DO NOTHING;

COMMIT;
