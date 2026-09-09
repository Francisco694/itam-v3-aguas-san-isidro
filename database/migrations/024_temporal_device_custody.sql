-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migracion 024 - Custodia temporal de dispositivos
-- ============================================================

BEGIN;

SET search_path TO itam, public;

INSERT INTO estados (
    tipo_entidad,
    codigo,
    nombre,
    descripcion,
    es_terminal,
    activo
)
VALUES (
    'DISPOSITIVO',
    'PENDIENTE_VALIDACION',
    'Pendiente de validacion',
    'La existencia del activo esta documentada, pero su condicion fisica actual requiere validacion.',
    FALSE,
    TRUE
)
ON CONFLICT (tipo_entidad, codigo) DO UPDATE
SET nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    es_terminal = EXCLUDED.es_terminal,
    activo = TRUE;

CREATE TABLE custodias_dispositivo (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dispositivo_id BIGINT NOT NULL,
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
    CONSTRAINT fk_custodia_dispositivo
        FOREIGN KEY (dispositivo_id)
        REFERENCES dispositivos(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_custodia_colaborador
        FOREIGN KEY (colaborador_id)
        REFERENCES colaboradores(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_custodia_departamento
        FOREIGN KEY (departamento_id)
        REFERENCES departamentos(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_custodia_usuario_ejecutor
        FOREIGN KEY (usuario_ejecutor_id)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_custodia_un_custodio CHECK (
        (colaborador_id IS NOT NULL AND departamento_id IS NULL)
        OR
        (colaborador_id IS NULL AND departamento_id IS NOT NULL)
    ),
    CONSTRAINT chk_custodia_tipo_inicio CHECK (tipo_inicio IN (
        'ASIGNACION',
        'ASIGNACION_DEPARTAMENTO',
        'IMPORTACION_HISTORICA',
        'RECONSTRUCCION_HISTORICA',
        'CORRECCION_ADMINISTRATIVA'
    )),
    CONSTRAINT chk_custodia_tipo_cierre CHECK (
        tipo_cierre IS NULL OR tipo_cierre IN (
            'DEVOLUCION',
            'REASIGNACION',
            'BAJA',
            'EXTRAVIO',
            'OFFBOARDING',
            'CONCILIACION_HISTORICA',
            'CORRECCION_ADMINISTRATIVA'
        )
    ),
    CONSTRAINT chk_custodia_nivel_confianza CHECK (
        nivel_confianza IN ('ALTA', 'MEDIA', 'BAJA', 'MANUAL')
    ),
    CONSTRAINT chk_custodia_evidencia CHECK (
        JSONB_TYPEOF(evidencia) = 'object'
    ),
    CONSTRAINT chk_custodia_vigencia CHECK (
        (
            vigente = TRUE
            AND tipo_cierre IS NULL
            AND fecha_fin IS NULL
            AND cerrado_en IS NULL
        )
        OR
        (
            vigente = FALSE
            AND tipo_cierre IS NOT NULL
            AND cerrado_en IS NOT NULL
        )
    ),
    CONSTRAINT chk_custodia_fechas CHECK (
        fecha_fin IS NULL
        OR fecha_inicio IS NULL
        OR fecha_fin >= fecha_inicio
    )
);

CREATE UNIQUE INDEX uq_custodia_vigente_dispositivo
    ON custodias_dispositivo (dispositivo_id)
    WHERE vigente = TRUE;

CREATE INDEX idx_custodias_colaborador_vigencia
    ON custodias_dispositivo (colaborador_id, vigente, fecha_inicio DESC)
    WHERE colaborador_id IS NOT NULL;

CREATE INDEX idx_custodias_departamento_vigencia
    ON custodias_dispositivo (departamento_id, vigente, fecha_inicio DESC)
    WHERE departamento_id IS NOT NULL;

CREATE INDEX idx_custodias_dispositivo_cronologia
    ON custodias_dispositivo (dispositivo_id, fecha_inicio DESC, id DESC);

CREATE TRIGGER trg_custodias_dispositivo_actualizado_en
BEFORE UPDATE ON custodias_dispositivo
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

COMMENT ON TABLE custodias_dispositivo IS
'Vigencias de custodia separadas del estado fisico o patrimonial del dispositivo.';

COMMENT ON COLUMN dispositivos.colaborador_id IS
'Campo legado de compatibilidad. Desde la migracion 024 la fuente de verdad es custodias_dispositivo.';

COMMENT ON COLUMN dispositivos.departamento_id IS
'Campo legado de compatibilidad. Desde la migracion 024 la fuente de verdad es custodias_dispositivo.';

COMMENT ON COLUMN custodias_dispositivo.fecha_cierre_real_conocida IS
'TRUE solo cuando existe evidencia explicita de la fecha real de cierre; una conciliacion historica puede cerrarse con FALSE.';

INSERT INTO schema_migrations (version, nombre)
VALUES ('024', 'temporal_device_custody');

COMMIT;
