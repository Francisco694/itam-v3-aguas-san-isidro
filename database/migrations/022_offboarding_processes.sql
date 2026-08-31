-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migracion 022 - Procesos explicitos de Offboarding
-- ============================================================

BEGIN;

SET search_path TO itam, public;

CREATE TABLE procesos_offboarding (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    colaborador_id BIGINT NOT NULL,
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTO',
    usuario_inicio_id BIGINT NOT NULL,
    observaciones TEXT,
    fecha_cierre TIMESTAMPTZ,
    usuario_cierre_id BIGINT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_offboarding_colaborador
        FOREIGN KEY (colaborador_id)
        REFERENCES colaboradores(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_offboarding_usuario_inicio
        FOREIGN KEY (usuario_inicio_id)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_offboarding_usuario_cierre
        FOREIGN KEY (usuario_cierre_id)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_offboarding_estado
        CHECK (estado IN ('ABIERTO', 'COMPLETADO')),
    CONSTRAINT chk_offboarding_cierre_consistente CHECK (
        (
            estado = 'ABIERTO'
            AND fecha_cierre IS NULL
            AND usuario_cierre_id IS NULL
        )
        OR
        (
            estado = 'COMPLETADO'
            AND fecha_cierre IS NOT NULL
            AND usuario_cierre_id IS NOT NULL
        )
    )
);

CREATE UNIQUE INDEX uq_offboarding_abierto_colaborador
    ON procesos_offboarding (colaborador_id)
    WHERE estado = 'ABIERTO';

CREATE INDEX idx_offboarding_estado_fecha
    ON procesos_offboarding (estado, fecha_inicio DESC);

CREATE INDEX idx_offboarding_colaborador_fecha
    ON procesos_offboarding (colaborador_id, fecha_inicio DESC);

CREATE TRIGGER trg_offboarding_actualizado_en
BEFORE UPDATE ON procesos_offboarding
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

COMMENT ON TABLE procesos_offboarding IS
'Procesos de salida iniciados explicitamente para recuperar activos de un colaborador.';

COMMENT ON COLUMN procesos_offboarding.estado IS
'Estado operativo del proceso: ABIERTO o COMPLETADO.';

INSERT INTO schema_migrations (version, nombre)
VALUES ('022', 'offboarding_processes');

COMMIT;
