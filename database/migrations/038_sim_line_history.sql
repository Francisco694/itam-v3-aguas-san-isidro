-- Fase 1 SIM / línea móvil.
-- Esta migración agrega trazabilidad para nuevas asociaciones. No reconstruye
-- relaciones históricas existentes ni modifica filas actuales.

CREATE TABLE IF NOT EXISTS itam.lineas_moviles_sim_historial (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    linea_movil_id BIGINT NOT NULL REFERENCES itam.lineas_moviles(id) ON DELETE RESTRICT,
    sim_id BIGINT NOT NULL REFERENCES itam.sim(id) ON DELETE RESTRICT,
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_fin TIMESTAMPTZ,
    motivo VARCHAR(100) NOT NULL,
    usuario_id BIGINT REFERENCES itam.usuarios(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_linea_sim_historial_fechas
      CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
    CONSTRAINT chk_linea_sim_historial_motivo
      CHECK (NULLIF(BTRIM(motivo), '') IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_linea_sim_historial_linea_activa
  ON itam.lineas_moviles_sim_historial(linea_movil_id)
  WHERE fecha_fin IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_linea_sim_historial_sim_activa
  ON itam.lineas_moviles_sim_historial(sim_id)
  WHERE fecha_fin IS NULL;

CREATE INDEX IF NOT EXISTS idx_linea_sim_historial_linea_fecha
  ON itam.lineas_moviles_sim_historial(linea_movil_id, fecha_inicio DESC);

CREATE INDEX IF NOT EXISTS idx_linea_sim_historial_sim_fecha
  ON itam.lineas_moviles_sim_historial(sim_id, fecha_inicio DESC);

-- La unicidad de línea por dispositivo aplica a la asociación actual.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lineas_moviles_dispositivo_actual
  ON itam.lineas_moviles(dispositivo_id)
  WHERE dispositivo_id IS NOT NULL;

-- ICCID se compara por su representación numérica canónica, conservando el
-- valor almacenado intacto. Los cinco ICCID NULL existentes siguen permitidos.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sim_iccid_normalizado
  ON itam.sim (REGEXP_REPLACE(BTRIM(iccid_codigo_fabrica), '[^0-9]', '', 'g'))
  WHERE NULLIF(BTRIM(iccid_codigo_fabrica), '') IS NOT NULL;

ALTER TABLE itam.sim
  DROP CONSTRAINT IF EXISTS chk_sim_iccid_formato;

ALTER TABLE itam.sim
  ADD CONSTRAINT chk_sim_iccid_formato
  CHECK (
    iccid_codigo_fabrica IS NULL
    OR BTRIM(iccid_codigo_fabrica) ~ '^[0-9]{19,20}$'
  );

INSERT INTO itam.schema_migrations(version, nombre)
VALUES ('038', 'sim_line_history')
ON CONFLICT (version) DO NOTHING;

