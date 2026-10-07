-- ITAM - Migración 039 - Línea base de trazabilidad SIM ↔ línea móvil
--
-- Registra únicamente las asociaciones recíprocas que ya estaban vigentes al
-- iniciar la trazabilidad relacional. CURRENT_TIMESTAMP representa el inicio
-- de esta trazabilidad, no la fecha histórica real de instalación física.
-- No modifica las referencias actuales de sim ni de lineas_moviles.

DO $migration$
BEGIN
  IF to_regclass('itam.lineas_moviles_sim_historial') IS NULL THEN
    RAISE EXCEPTION
      'La migración 039 requiere itam.lineas_moviles_sim_historial (038).';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM itam.schema_migrations
     WHERE version = '039'
       AND nombre <> 'seed_current_sim_line_history'
  ) THEN
    RAISE EXCEPTION
      'La versión 039 ya está registrada con un nombre diferente.';
  END IF;
END
$migration$;

INSERT INTO itam.lineas_moviles_sim_historial (
  linea_movil_id,
  sim_id,
  fecha_inicio,
  motivo,
  usuario_id
)
SELECT
  linea.id,
  sim.id,
  CURRENT_TIMESTAMP,
  'MIGRACION_ESTADO_INICIAL',
  NULL
FROM itam.sim sim
JOIN itam.lineas_moviles linea
  ON linea.id = sim.linea_movil_id
 AND linea.sim_id = sim.id
WHERE NOT EXISTS (
  SELECT 1
    FROM itam.lineas_moviles_sim_historial historial
   WHERE historial.fecha_fin IS NULL
     AND (
       historial.linea_movil_id = linea.id
       OR historial.sim_id = sim.id
     )
);

INSERT INTO itam.schema_migrations(version, nombre)
VALUES ('039', 'seed_current_sim_line_history')
ON CONFLICT (version) DO NOTHING;

