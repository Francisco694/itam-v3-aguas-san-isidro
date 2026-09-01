-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migracion 026 - Custodia y asociacion temporal de SIM
-- ============================================================

BEGIN;

SET search_path TO itam, public;

CREATE TABLE custodias_sim (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sim_id BIGINT NOT NULL,
    colaborador_id BIGINT,
    departamento_id BIGINT,
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ,
    vigente BOOLEAN NOT NULL DEFAULT TRUE,
    tipo_inicio VARCHAR(40) NOT NULL,
    tipo_cierre VARCHAR(40),
    fecha_cierre_real_conocida BOOLEAN NOT NULL DEFAULT FALSE,
    origen VARCHAR(80) NOT NULL,
    referencia_origen VARCHAR(250),
    evidencia JSONB NOT NULL DEFAULT '{}'::JSONB,
    nivel_confianza VARCHAR(10) NOT NULL,
    usuario_ejecutor_id BIGINT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_en TIMESTAMPTZ,
    CONSTRAINT fk_custodia_sim
        FOREIGN KEY (sim_id) REFERENCES sim(id) ON DELETE RESTRICT,
    CONSTRAINT fk_custodia_sim_colaborador
        FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE RESTRICT,
    CONSTRAINT fk_custodia_sim_departamento
        FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_custodia_sim_usuario
        FOREIGN KEY (usuario_ejecutor_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_custodia_sim_un_custodio CHECK (
        (colaborador_id IS NOT NULL AND departamento_id IS NULL)
        OR
        (colaborador_id IS NULL AND departamento_id IS NOT NULL)
    ),
    CONSTRAINT chk_custodia_sim_tipo_inicio CHECK (tipo_inicio IN (
        'ASIGNACION',
        'ASIGNACION_DEPARTAMENTO',
        'IMPORTACION_HISTORICA',
        'RECONSTRUCCION_HISTORICA',
        'CORRECCION_ADMINISTRATIVA'
    )),
    CONSTRAINT chk_custodia_sim_tipo_cierre CHECK (
        tipo_cierre IS NULL OR tipo_cierre IN (
            'DEVOLUCION', 'REASIGNACION', 'BAJA', 'EXTRAVIO',
            'OFFBOARDING', 'CONCILIACION_HISTORICA',
            'CORRECCION_ADMINISTRATIVA'
        )
    ),
    CONSTRAINT chk_custodia_sim_confianza CHECK (
        nivel_confianza IN ('ALTA', 'MEDIA', 'BAJA', 'MANUAL')
    ),
    CONSTRAINT chk_custodia_sim_vigencia CHECK (
        (vigente = TRUE AND tipo_cierre IS NULL AND fecha_fin IS NULL AND cerrado_en IS NULL)
        OR
        (vigente = FALSE AND tipo_cierre IS NOT NULL AND cerrado_en IS NOT NULL)
    ),
    CONSTRAINT chk_custodia_sim_evidencia CHECK (
        JSONB_TYPEOF(evidencia) = 'object'
    )
);

CREATE UNIQUE INDEX uq_custodia_vigente_sim
    ON custodias_sim (sim_id)
    WHERE vigente = TRUE;

CREATE INDEX idx_custodias_sim_colaborador
    ON custodias_sim (colaborador_id, vigente, fecha_inicio DESC)
    WHERE colaborador_id IS NOT NULL;

CREATE TRIGGER trg_custodias_sim_actualizado_en
BEFORE UPDATE ON custodias_sim
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TABLE asociaciones_sim_dispositivo (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sim_id BIGINT NOT NULL,
    dispositivo_id BIGINT NOT NULL,
    fecha_inicio TIMESTAMPTZ,
    fecha_fin TIMESTAMPTZ,
    vigente BOOLEAN NOT NULL DEFAULT TRUE,
    origen VARCHAR(80) NOT NULL,
    referencia_origen VARCHAR(250),
    evidencia JSONB NOT NULL DEFAULT '{}'::JSONB,
    nivel_confianza VARCHAR(10) NOT NULL,
    usuario_ejecutor_id BIGINT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cerrado_en TIMESTAMPTZ,
    CONSTRAINT fk_asociacion_sim
        FOREIGN KEY (sim_id) REFERENCES sim(id) ON DELETE RESTRICT,
    CONSTRAINT fk_asociacion_dispositivo
        FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_asociacion_sim_usuario
        FOREIGN KEY (usuario_ejecutor_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_asociacion_sim_confianza CHECK (
        nivel_confianza IN ('ALTA', 'MEDIA', 'BAJA', 'MANUAL')
    ),
    CONSTRAINT chk_asociacion_sim_vigencia CHECK (
        (vigente = TRUE AND fecha_fin IS NULL AND cerrado_en IS NULL)
        OR
        (vigente = FALSE AND cerrado_en IS NOT NULL)
    ),
    CONSTRAINT chk_asociacion_sim_evidencia CHECK (
        JSONB_TYPEOF(evidencia) = 'object'
    )
);

CREATE UNIQUE INDEX uq_asociacion_vigente_por_sim
    ON asociaciones_sim_dispositivo (sim_id)
    WHERE vigente = TRUE;

CREATE UNIQUE INDEX uq_asociacion_vigente_por_dispositivo
    ON asociaciones_sim_dispositivo (dispositivo_id)
    WHERE vigente = TRUE;

CREATE INDEX idx_asociaciones_sim_cronologia
    ON asociaciones_sim_dispositivo (sim_id, fecha_inicio DESC, id DESC);

COMMENT ON COLUMN sim.colaborador_id IS
'Campo legado de compatibilidad. Desde la migracion 026 la fuente de verdad es custodias_sim.';

COMMENT ON COLUMN sim.dispositivo_id IS
'Campo legado de compatibilidad. Desde la migracion 026 la fuente de verdad es asociaciones_sim_dispositivo.';

INSERT INTO schema_migrations (version, nombre)
VALUES ('026', 'temporal_sim_custody');

COMMIT;
