-- ITAM v3.0 - Actividad de sesión e índice para timeout de inactividad.
-- Corrige el defecto histórico de 018 sin reescribir esa migración.

BEGIN;

SET search_path TO itam, public;

-- Se agrega sin DEFAULT para poder conservar la fecha de creación de sesiones
-- existentes. Después se normaliza al contrato definitivo de itam_dev.
ALTER TABLE sesiones_usuario
    ADD COLUMN IF NOT EXISTS ultima_actividad TIMESTAMPTZ;

UPDATE sesiones_usuario
   SET ultima_actividad = COALESCE(ultima_actividad, creado_en, NOW())
 WHERE ultima_actividad IS NULL;

ALTER TABLE sesiones_usuario
    ALTER COLUMN ultima_actividad SET DEFAULT NOW(),
    ALTER COLUMN ultima_actividad SET NOT NULL;

-- Definición recuperada de itam_dev: acelera la búsqueda de sesiones activas
-- durante la actualización de actividad y excluye sesiones revocadas.
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario_actividad
    ON sesiones_usuario (usuario_id, ultima_actividad)
    WHERE revocado_en IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM information_schema.columns
         WHERE table_schema = 'itam'
           AND table_name = 'sesiones_usuario'
           AND column_name = 'ultima_actividad'
           AND data_type = 'timestamp with time zone'
           AND is_nullable = 'NO'
           AND column_default LIKE 'now()%'
    ) THEN
        RAISE EXCEPTION
            'sesiones_usuario.ultima_actividad no quedó con la definición esperada';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM pg_indexes
         WHERE schemaname = 'itam'
           AND tablename = 'sesiones_usuario'
           AND indexname = 'idx_sesiones_usuario_actividad'
           AND indexdef LIKE '%(usuario_id, ultima_actividad)%'
           AND indexdef LIKE '%WHERE (revocado_en IS NULL)%'
    ) THEN
        RAISE EXCEPTION
            'No existe el índice esperado idx_sesiones_usuario_actividad';
    END IF;
END $$;

INSERT INTO schema_migrations (version, nombre)
VALUES ('034', 'session_activity_and_proxy_ready')
ON CONFLICT (version) DO NOTHING;

COMMIT;
