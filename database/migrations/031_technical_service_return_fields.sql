-- Campos del cierre y retorno de una orden de servicio técnico.

BEGIN;

SET search_path TO itam, public;

ALTER TABLE ordenes_servicio_tecnico
    ADD COLUMN IF NOT EXISTS area_solicitante VARCHAR(180),
    ADD COLUMN IF NOT EXISTS contacto_servicio VARCHAR(180),
    ADD COLUMN IF NOT EXISTS plazo_informado VARCHAR(120),
    ADD COLUMN IF NOT EXISTS estado_final VARCHAR(50),
    ADD COLUMN IF NOT EXISTS observaciones_retorno TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_orden_servicio_estado_final'
    ) THEN
        ALTER TABLE ordenes_servicio_tecnico
            ADD CONSTRAINT chk_orden_servicio_estado_final CHECK (
                estado_final IS NULL OR estado_final IN ('OPERATIVO', 'SIN_REPARACION', 'BAJA')
            );
    END IF;
END $$;

INSERT INTO schema_migrations (version, nombre)
VALUES ('031', 'technical_service_return_fields');

COMMIT;
