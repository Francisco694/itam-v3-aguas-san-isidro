-- ITAM - Separación formal entre línea móvil, SIM física y Smartphone
BEGIN;
SET search_path TO itam, public;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE version = '028' AND nombre IS DISTINCT FROM 'mobile_lines'
    ) THEN
        RAISE EXCEPTION 'Migration 028 is registered with a different name';
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS respaldo_sim_lineas_moviles_028 AS
SELECT
    id AS sim_id,
    codigo_inventario AS sim_codigo_inventario,
    numero_asociado,
    colaborador_id,
    dispositivo_id,
    estado_id,
    NOW() AS respaldado_en
FROM sim;

CREATE TABLE IF NOT EXISTS lineas_moviles (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_telefonico VARCHAR(30) NOT NULL,
    estado VARCHAR(30) NOT NULL DEFAULT 'ACTIVA',
    colaborador_id BIGINT REFERENCES colaboradores(id) ON DELETE RESTRICT,
    dispositivo_id BIGINT REFERENCES dispositivos(id) ON DELETE RESTRICT,
    sim_id BIGINT REFERENCES sim(id) ON DELETE RESTRICT,
    observaciones TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_linea_movil_estado CHECK (
        estado IN ('ACTIVA', 'BLOQUEADA', 'SUSPENDIDA', 'DADA_BAJA', 'PENDIENTE_REPOSICION')
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lineas_moviles_numero_normalizado
    ON lineas_moviles (REGEXP_REPLACE(numero_telefonico, '[^0-9]', '', 'g'));
CREATE UNIQUE INDEX IF NOT EXISTS uq_lineas_moviles_sim_actual
    ON lineas_moviles (sim_id) WHERE sim_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lineas_moviles_estado ON lineas_moviles (estado);
CREATE INDEX IF NOT EXISTS idx_lineas_moviles_colaborador ON lineas_moviles (colaborador_id);
CREATE INDEX IF NOT EXISTS idx_lineas_moviles_dispositivo ON lineas_moviles (dispositivo_id);

DROP TRIGGER IF EXISTS trg_lineas_moviles_actualizado_en ON lineas_moviles;
CREATE TRIGGER trg_lineas_moviles_actualizado_en
BEFORE UPDATE ON lineas_moviles
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

ALTER TABLE sim ADD COLUMN IF NOT EXISTS linea_movil_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_sim_linea_movil'
          AND conrelid = 'itam.sim'::regclass
    ) THEN
        ALTER TABLE sim
            ADD CONSTRAINT fk_sim_linea_movil
            FOREIGN KEY (linea_movil_id)
            REFERENCES lineas_moviles(id)
            ON DELETE RESTRICT;
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sim_linea_movil_actual
    ON sim (linea_movil_id) WHERE linea_movil_id IS NOT NULL;

WITH candidatos AS (
    SELECT
        s.*,
        REGEXP_REPLACE(s.numero_asociado, '[^0-9]', '', 'g') AS numero_normalizado,
        ROW_NUMBER() OVER (
            PARTITION BY REGEXP_REPLACE(s.numero_asociado, '[^0-9]', '', 'g')
            ORDER BY
                CASE e.codigo WHEN 'ASIGNADA' THEN 0 WHEN 'DISPONIBLE' THEN 1 ELSE 2 END,
                s.id
        ) AS prioridad
    FROM sim s
    JOIN estados e ON e.id = s.estado_id
    WHERE NULLIF(REGEXP_REPLACE(COALESCE(s.numero_asociado, ''), '[^0-9]', '', 'g'), '') IS NOT NULL
)
INSERT INTO lineas_moviles (
    numero_telefonico,
    estado,
    colaborador_id,
    dispositivo_id,
    sim_id,
    observaciones
)
SELECT
    candidato.numero_normalizado,
    CASE candidato.estado_codigo
        WHEN 'DADA_BAJA' THEN 'DADA_BAJA'
        WHEN 'EXTRAVIADA' THEN 'PENDIENTE_REPOSICION'
        ELSE 'ACTIVA'
    END,
    CASE
        WHEN candidato.estado_codigo IN ('DADA_BAJA', 'EXTRAVIADA') THEN NULL
        ELSE candidato.colaborador_id
    END,
    CASE
        WHEN candidato.estado_codigo IN ('DADA_BAJA', 'EXTRAVIADA') THEN NULL
        ELSE candidato.dispositivo_id
    END,
    CASE
        WHEN candidato.estado_codigo IN ('DADA_BAJA', 'EXTRAVIADA') THEN NULL
        ELSE candidato.id
    END,
    'Migrada desde sim.numero_asociado por migración 028.'
FROM (
    SELECT candidatos.*, e.codigo AS estado_codigo
    FROM candidatos
    JOIN estados e ON e.id = candidatos.estado_id
    WHERE candidatos.prioridad = 1
) candidato
WHERE NOT EXISTS (
    SELECT 1
    FROM lineas_moviles linea
    WHERE REGEXP_REPLACE(linea.numero_telefonico, '[^0-9]', '', 'g') = candidato.numero_normalizado
);

UPDATE sim s
SET linea_movil_id = linea.id
FROM lineas_moviles linea
WHERE linea.sim_id = s.id
  AND s.linea_movil_id IS NULL;

ALTER TABLE historial_eventos ADD COLUMN IF NOT EXISTS linea_movil_id BIGINT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_historial_linea_movil'
          AND conrelid = 'itam.historial_eventos'::regclass
    ) THEN
        ALTER TABLE historial_eventos
            ADD CONSTRAINT fk_historial_linea_movil
            FOREIGN KEY (linea_movil_id)
            REFERENCES lineas_moviles(id)
            ON DELETE RESTRICT;
    END IF;
END;
$$;

ALTER TABLE historial_eventos DROP CONSTRAINT IF EXISTS chk_historial_tipo_entidad;
ALTER TABLE historial_eventos ADD CONSTRAINT chk_historial_tipo_entidad
    CHECK (tipo_entidad IN ('DISPOSITIVO', 'SIM', 'LINEA_MOVIL'));

ALTER TABLE historial_eventos DROP CONSTRAINT IF EXISTS chk_historial_entidad;
ALTER TABLE historial_eventos ADD CONSTRAINT chk_historial_entidad CHECK (
    (tipo_entidad = 'DISPOSITIVO' AND dispositivo_id IS NOT NULL AND sim_id IS NULL AND linea_movil_id IS NULL)
    OR (tipo_entidad = 'SIM' AND sim_id IS NOT NULL AND dispositivo_id IS NULL AND linea_movil_id IS NULL)
    OR (tipo_entidad = 'LINEA_MOVIL' AND linea_movil_id IS NOT NULL AND dispositivo_id IS NULL AND sim_id IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_historial_linea_movil
    ON historial_eventos (linea_movil_id, fecha_evento DESC);

INSERT INTO estados (tipo_entidad, codigo, nombre, descripcion, es_terminal)
VALUES
    ('SIM', 'BLOQUEADA', 'Bloqueada', 'SIM bloqueada preventivamente y fuera de operación.', FALSE),
    ('SIM', 'REEMPLAZADA', 'Reemplazada', 'SIM sustituida conservando la línea móvil.', TRUE)
ON CONFLICT (tipo_entidad, codigo) DO NOTHING;

COMMENT ON TABLE lineas_moviles IS
    'Líneas telefónicas corporativas independientes del Smartphone y de la SIM física.';
COMMENT ON COLUMN sim.numero_asociado IS
    'Campo legado conservado temporalmente; la fuente formal es lineas_moviles.numero_telefonico.';
COMMENT ON COLUMN sim.linea_movil_id IS
    'Línea móvil instalada actualmente en esta SIM física.';

INSERT INTO schema_migrations (version, nombre)
VALUES ('028', 'mobile_lines')
ON CONFLICT (version) DO NOTHING;

COMMIT;
