-- Rollback protegido de migración 028. No elimina información operacional nueva.
BEGIN;
SET search_path TO itam, public;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM historial_eventos
        WHERE tipo_entidad = 'LINEA_MOVIL'
    ) THEN
        RAISE EXCEPTION 'No se puede revertir 028: existen eventos de líneas móviles. Exporte y migre esos datos primero.';
    END IF;
END;
$$;

DROP INDEX IF EXISTS idx_historial_linea_movil;
ALTER TABLE historial_eventos DROP CONSTRAINT IF EXISTS fk_historial_linea_movil;
ALTER TABLE historial_eventos DROP CONSTRAINT IF EXISTS chk_historial_entidad;
ALTER TABLE historial_eventos DROP CONSTRAINT IF EXISTS chk_historial_tipo_entidad;
ALTER TABLE historial_eventos DROP COLUMN IF EXISTS linea_movil_id;
ALTER TABLE historial_eventos ADD CONSTRAINT chk_historial_tipo_entidad
    CHECK (tipo_entidad IN ('DISPOSITIVO', 'SIM'));
ALTER TABLE historial_eventos ADD CONSTRAINT chk_historial_entidad CHECK (
    (tipo_entidad = 'DISPOSITIVO' AND dispositivo_id IS NOT NULL AND sim_id IS NULL)
    OR (tipo_entidad = 'SIM' AND sim_id IS NOT NULL AND dispositivo_id IS NULL)
);

DROP INDEX IF EXISTS uq_sim_linea_movil_actual;
ALTER TABLE sim DROP CONSTRAINT IF EXISTS fk_sim_linea_movil;
ALTER TABLE sim DROP COLUMN IF EXISTS linea_movil_id;
DROP TABLE IF EXISTS lineas_moviles;

DELETE FROM estados estado
WHERE estado.tipo_entidad = 'SIM'
  AND estado.codigo IN ('BLOQUEADA', 'REEMPLAZADA')
  AND NOT EXISTS (
      SELECT 1 FROM historial_eventos historial
      WHERE historial.estado_anterior_id = estado.id
         OR historial.estado_nuevo_id = estado.id
  );

DELETE FROM schema_migrations WHERE version = '028';
COMMIT;
