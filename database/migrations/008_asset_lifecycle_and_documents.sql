-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 008 - Ciclo de vida patrimonial y documentos
-- ============================================================

BEGIN;

SET search_path TO itam, public;

ALTER TABLE dispositivos
    ADD COLUMN valor_comercial BIGINT NOT NULL DEFAULT 0,
    ADD CONSTRAINT chk_dispositivo_valor_comercial
        CHECK (valor_comercial >= 0);

CREATE TABLE ordenes_servicio_tecnico (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dispositivo_id BIGINT NOT NULL,
    proveedor VARCHAR(180),
    fecha_envio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    falla_reportada TEXT NOT NULL,
    diagnostico TEXT,
    descripcion_reparacion TEXT,
    monto_cotizacion BIGINT,
    decision VARCHAR(30),
    motivo_decision VARCHAR(80),
    observacion_decision TEXT,
    fecha_decision TIMESTAMPTZ,
    responsable_decision VARCHAR(150),
    costo_final BIGINT,
    fecha_retorno TIMESTAMPTZ,
    resultado TEXT,
    estado VARCHAR(40) NOT NULL DEFAULT 'PENDIENTE_DIAGNOSTICO',
    responsable_envio VARCHAR(150) NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_orden_servicio_dispositivo
        FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE RESTRICT,
    CONSTRAINT chk_orden_servicio_estado CHECK (estado IN (
        'PENDIENTE_DIAGNOSTICO', 'COTIZACION_RECIBIDA', 'REPARACION_APROBADA',
        'REPARACION_RECHAZADA', 'EN_REPARACION', 'REPARACION_TERMINADA',
        'CERRADA', 'BAJA'
    )),
    CONSTRAINT chk_orden_servicio_decision CHECK (
        decision IS NULL OR decision IN ('APROBAR', 'RECHAZAR', 'DAR_BAJA')
    ),
    CONSTRAINT chk_orden_servicio_montos CHECK (
        (monto_cotizacion IS NULL OR monto_cotizacion >= 0)
        AND (costo_final IS NULL OR costo_final >= 0)
    )
);

CREATE UNIQUE INDEX uq_orden_servicio_abierta_dispositivo
    ON ordenes_servicio_tecnico (dispositivo_id)
    WHERE estado NOT IN ('CERRADA', 'BAJA', 'REPARACION_RECHAZADA');

CREATE INDEX idx_ordenes_servicio_estado
    ON ordenes_servicio_tecnico (estado, fecha_envio DESC);

CREATE TRIGGER trg_orden_servicio_actualizado_en
BEFORE UPDATE ON ordenes_servicio_tecnico
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TABLE bajas_dispositivo (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dispositivo_id BIGINT NOT NULL UNIQUE,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    motivo VARCHAR(50) NOT NULL,
    observacion TEXT,
    valor_comercial_momento BIGINT NOT NULL,
    responsable VARCHAR(150) NOT NULL,
    orden_servicio_id BIGINT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_baja_dispositivo
        FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_baja_orden_servicio
        FOREIGN KEY (orden_servicio_id) REFERENCES ordenes_servicio_tecnico(id) ON DELETE RESTRICT,
    CONSTRAINT chk_baja_motivo CHECK (motivo IN (
        'IRREPARABLE', 'REPARACION_NO_CONVENIENTE', 'MULTIPLES_REPARACIONES',
        'OBSOLESCENCIA', 'DANO_FISICO', 'SIN_REPUESTOS', 'OTRO'
    )),
    CONSTRAINT chk_baja_valor CHECK (valor_comercial_momento >= 0)
);

CREATE TABLE secuencias_acta_entrega (
    anio INTEGER PRIMARY KEY,
    ultimo_numero INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT chk_secuencia_acta_anio CHECK (anio BETWEEN 2020 AND 2200),
    CONSTRAINT chk_secuencia_acta_numero CHECK (ultimo_numero >= 0)
);

CREATE TABLE actas_entrega (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_acta VARCHAR(20) NOT NULL UNIQUE,
    colaborador_id BIGINT,
    departamento_id BIGINT,
    recepcionante_id BIGINT,
    localidad VARCHAR(120),
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    estado VARCHAR(20) NOT NULL DEFAULT 'EMITIDA',
    responsable_ti VARCHAR(150) NOT NULL,
    observaciones TEXT,
    declaracion TEXT,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_acta_colaborador
        FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE RESTRICT,
    CONSTRAINT fk_acta_departamento
        FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_acta_recepcionante
        FOREIGN KEY (recepcionante_id) REFERENCES colaboradores(id) ON DELETE RESTRICT,
    CONSTRAINT chk_acta_destinatario CHECK (
        (colaborador_id IS NOT NULL AND departamento_id IS NULL AND recepcionante_id IS NULL)
        OR
        (colaborador_id IS NULL AND departamento_id IS NOT NULL AND recepcionante_id IS NOT NULL)
    ),
    CONSTRAINT chk_acta_estado CHECK (estado IN ('BORRADOR', 'EMITIDA', 'ANULADA'))
);

CREATE TRIGGER trg_acta_entrega_actualizado_en
BEFORE UPDATE ON actas_entrega
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TABLE actas_entrega_detalle (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    acta_entrega_id BIGINT NOT NULL,
    dispositivo_id BIGINT NOT NULL,
    codigo_inventario INTEGER NOT NULL,
    tipo_dispositivo VARCHAR(80) NOT NULL,
    marca VARCHAR(100),
    modelo VARCHAR(150),
    numero_serie VARCHAR(150),
    imei VARCHAR(30),
    valor_comercial BIGINT NOT NULL DEFAULT 0,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_acta_detalle_acta
        FOREIGN KEY (acta_entrega_id) REFERENCES actas_entrega(id) ON DELETE RESTRICT,
    CONSTRAINT fk_acta_detalle_dispositivo
        FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE RESTRICT,
    CONSTRAINT uq_acta_detalle_dispositivo UNIQUE (acta_entrega_id, dispositivo_id),
    CONSTRAINT chk_acta_detalle_valor CHECK (valor_comercial >= 0)
);

CREATE INDEX idx_actas_entrega_colaborador
    ON actas_entrega (colaborador_id, fecha DESC);

CREATE INDEX idx_actas_entrega_departamento
    ON actas_entrega (departamento_id, fecha DESC);

INSERT INTO schema_migrations (version, nombre)
VALUES ('008', 'asset_lifecycle_and_documents');

COMMIT;
