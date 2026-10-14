-- ITAM - Reconciliación de esquema para instalaciones productivas parciales.
--
-- Algunas instalaciones registraron migraciones posteriores sin haber aplicado
-- completamente los cambios de 029/033/034. Esta migración solo agrega los
-- elementos faltantes y es segura para bases que ya están actualizadas.

BEGIN;

SET search_path TO itam, public;

ALTER TABLE ordenes_servicio_tecnico
    ADD COLUMN IF NOT EXISTS tipo_servicio VARCHAR(20),
    ADD COLUMN IF NOT EXISTS accesorios_entregados TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conrelid = 'itam.ordenes_servicio_tecnico'::regclass
           AND conname = 'chk_orden_servicio_tipo_servicio'
    ) THEN
        ALTER TABLE ordenes_servicio_tecnico
            ADD CONSTRAINT chk_orden_servicio_tipo_servicio CHECK (
                tipo_servicio IS NULL
                OR tipo_servicio IN ('GARANTIA', 'REPARACION', 'MANTENCION', 'DIAGNOSTICO')
            );
    END IF;
END $$;

ALTER TABLE sesiones_usuario
    ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMPTZ;

UPDATE sesiones_usuario
   SET ultima_actividad = COALESCE(ultima_actividad, creado_en, NOW())
 WHERE ultima_actividad IS NULL;

ALTER TABLE sesiones_usuario
    ALTER COLUMN ultima_actividad SET DEFAULT NOW(),
    ALTER COLUMN ultima_actividad SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_actividad
    ON sesiones_usuario (usuario_id, ultima_actividad)
    WHERE revocado_en IS NULL;

INSERT INTO schema_migrations (version, nombre)
VALUES ('042', 'reconcile_service_and_session_schema')
ON CONFLICT (version) DO NOTHING;

COMMIT;
