BEGIN;

SET search_path TO itam, public;

ALTER TABLE ordenes_servicio_tecnico
  ADD COLUMN IF NOT EXISTS numero_ot BIGINT;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY creado_en ASC, id ASC) AS numero_ot
  FROM ordenes_servicio_tecnico
)
UPDATE ordenes_servicio_tecnico AS orden
SET numero_ot = numbered.numero_ot
FROM numbered
WHERE numbered.id = orden.id
  AND orden.numero_ot IS NULL;

ALTER TABLE ordenes_servicio_tecnico
  ALTER COLUMN numero_ot SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_ordenes_servicio_numero_ot_positivo'
      AND conrelid = 'itam.ordenes_servicio_tecnico'::regclass
  ) THEN
    ALTER TABLE ordenes_servicio_tecnico
      ADD CONSTRAINT chk_ordenes_servicio_numero_ot_positivo CHECK (numero_ot > 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ordenes_servicio_numero_ot
  ON ordenes_servicio_tecnico (numero_ot);

INSERT INTO schema_migrations(version, nombre)
VALUES ('036', 'correlative_technical_work_order_numbers')
ON CONFLICT (version) DO NOTHING;

COMMIT;
