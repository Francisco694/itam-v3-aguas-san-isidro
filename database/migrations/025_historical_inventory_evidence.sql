-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migracion 025 - Evidencia historica y casos de conciliacion
-- ============================================================

BEGIN;

SET search_path TO itam, public;

CREATE TABLE evidencias_inventario_historico (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clave_origen VARCHAR(300) NOT NULL,
    fuente VARCHAR(250) NOT NULL,
    hoja VARCHAR(150) NOT NULL,
    fila_origen INTEGER NOT NULL,
    indice_activo INTEGER NOT NULL DEFAULT 1,
    rut_original TEXT,
    rut_canonico TEXT,
    colaborador_id BIGINT,
    nombre_original TEXT,
    tipo_activo VARCHAR(120),
    descripcion_original TEXT,
    imei_original TEXT,
    imei_normalizado VARCHAR(30),
    serie_original TEXT,
    serie_normalizada VARCHAR(180),
    telefono_original TEXT,
    fecha_entrega DATE,
    fecha_cierre_fuente DATE,
    dispositivo_id BIGINT,
    estado_conciliacion VARCHAR(50) NOT NULL,
    motivo_conflicto TEXT,
    nivel_confianza VARCHAR(10) NOT NULL,
    datos_origen JSONB NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_evidencia_clave_origen UNIQUE (clave_origen),
    CONSTRAINT fk_evidencia_colaborador
        FOREIGN KEY (colaborador_id)
        REFERENCES colaboradores(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_evidencia_dispositivo
        FOREIGN KEY (dispositivo_id)
        REFERENCES dispositivos(id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_evidencia_fila_origen CHECK (fila_origen > 0),
    CONSTRAINT chk_evidencia_indice_activo CHECK (indice_activo > 0),
    CONSTRAINT chk_evidencia_estado CHECK (estado_conciliacion IN (
        'VINCULADA',
        'VIGENTE_CONFIRMADA',
        'HISTORICA_CONFIRMADA',
        'PROBABLE_VIGENTE',
        'PROBABLE_HISTORICA',
        'PENDIENTE_IDENTIFICAR_ACTIVO',
        'CONFLICTO_IMEI',
        'CONFLICTO_SERIE',
        'CONFLICTO_RUT',
        'CONFLICTO_IDENTIDAD',
        'REQUIERE_VALIDACION_FISICA'
    )),
    CONSTRAINT chk_evidencia_confianza CHECK (
        nivel_confianza IN ('ALTA', 'MEDIA', 'BAJA', 'MANUAL')
    ),
    CONSTRAINT chk_evidencia_datos_origen CHECK (
        JSONB_TYPEOF(datos_origen) = 'object'
    )
);

CREATE INDEX idx_evidencias_colaborador
    ON evidencias_inventario_historico (colaborador_id, fecha_entrega DESC);

CREATE INDEX idx_evidencias_dispositivo
    ON evidencias_inventario_historico (dispositivo_id, fecha_entrega DESC);

CREATE INDEX idx_evidencias_conciliacion
    ON evidencias_inventario_historico (estado_conciliacion, nivel_confianza);

CREATE INDEX idx_evidencias_imei
    ON evidencias_inventario_historico (imei_normalizado)
    WHERE imei_normalizado IS NOT NULL;

CREATE INDEX idx_evidencias_serie
    ON evidencias_inventario_historico (serie_normalizada)
    WHERE serie_normalizada IS NOT NULL;

CREATE TRIGGER trg_evidencias_inventario_actualizado_en
BEFORE UPDATE ON evidencias_inventario_historico
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TABLE casos_conciliacion_inventario (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    clave_caso VARCHAR(300) NOT NULL,
    tipo_conflicto VARCHAR(80) NOT NULL,
    imei VARCHAR(30),
    serie VARCHAR(180),
    dispositivo_id BIGINT,
    colaborador_id BIGINT,
    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    prioridad VARCHAR(10) NOT NULL DEFAULT 'MEDIA',
    descripcion TEXT NOT NULL,
    evidencia JSONB NOT NULL DEFAULT '{}'::JSONB,
    resuelto_por BIGINT,
    resuelto_en TIMESTAMPTZ,
    resolucion TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_caso_conciliacion_clave UNIQUE (clave_caso),
    CONSTRAINT fk_caso_dispositivo
        FOREIGN KEY (dispositivo_id)
        REFERENCES dispositivos(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_caso_colaborador
        FOREIGN KEY (colaborador_id)
        REFERENCES colaboradores(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_caso_resuelto_por
        FOREIGN KEY (resuelto_por)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,
    CONSTRAINT chk_caso_estado CHECK (
        estado IN ('PENDIENTE', 'EN_REVISION', 'RESUELTO', 'DESCARTADO')
    ),
    CONSTRAINT chk_caso_prioridad CHECK (
        prioridad IN ('CRITICA', 'ALTA', 'MEDIA', 'BAJA')
    ),
    CONSTRAINT chk_caso_evidencia CHECK (
        JSONB_TYPEOF(evidencia) = 'object'
    ),
    CONSTRAINT chk_caso_resolucion CHECK (
        (
            estado IN ('PENDIENTE', 'EN_REVISION')
            AND resuelto_por IS NULL
            AND resuelto_en IS NULL
            AND resolucion IS NULL
        )
        OR
        (
            estado IN ('RESUELTO', 'DESCARTADO')
            AND resuelto_por IS NOT NULL
            AND resuelto_en IS NOT NULL
            AND NULLIF(BTRIM(resolucion), '') IS NOT NULL
        )
    )
);

CREATE INDEX idx_casos_conciliacion_estado
    ON casos_conciliacion_inventario (estado, prioridad, creado_en);

CREATE INDEX idx_casos_conciliacion_identificadores
    ON casos_conciliacion_inventario (imei, serie);

CREATE TRIGGER trg_casos_conciliacion_actualizado_en
BEFORE UPDATE ON casos_conciliacion_inventario
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TABLE casos_conciliacion_evidencias (
    caso_id BIGINT NOT NULL,
    evidencia_id BIGINT NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (caso_id, evidencia_id),
    CONSTRAINT fk_caso_evidencia_caso
        FOREIGN KEY (caso_id)
        REFERENCES casos_conciliacion_inventario(id)
        ON DELETE RESTRICT,
    CONSTRAINT fk_caso_evidencia_evidencia
        FOREIGN KEY (evidencia_id)
        REFERENCES evidencias_inventario_historico(id)
        ON DELETE RESTRICT
);

INSERT INTO schema_migrations (version, nombre)
VALUES ('025', 'historical_inventory_evidence');

COMMIT;
