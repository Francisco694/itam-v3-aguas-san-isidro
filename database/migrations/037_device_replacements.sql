-- ITAM v3.0 - Migracion 037 - Operaciones generales de reemplazo de dispositivos

BEGIN;

SET search_path TO itam, public;

ALTER TABLE comprobantes_devolucion
    DROP CONSTRAINT IF EXISTS chk_comprobante_origen;

ALTER TABLE comprobantes_devolucion
    ADD CONSTRAINT chk_comprobante_origen CHECK (
        origen IN ('INVENTARIO', 'OFFBOARDING', 'REEMPLAZO')
    );

CREATE TABLE IF NOT EXISTS reemplazos_dispositivo (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    colaborador_id BIGINT NOT NULL,
    dispositivo_anterior_id BIGINT NOT NULL,
    dispositivo_nuevo_id BIGINT NOT NULL,
    estado_operacion VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE_DEVOLUCION',
    fecha_inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_recepcion_anterior TIMESTAMPTZ,
    fecha_cierre TIMESTAMPTZ,
    usuario_inicio_id BIGINT NOT NULL,
    usuario_cierre_id BIGINT,
    comprobante_devolucion_id BIGINT,
    destino_dispositivo_anterior VARCHAR(40),
    observacion TEXT,
    motivo_cancelacion TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_reemplazo_colaborador
        FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reemplazo_dispositivo_anterior
        FOREIGN KEY (dispositivo_anterior_id) REFERENCES dispositivos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reemplazo_dispositivo_nuevo
        FOREIGN KEY (dispositivo_nuevo_id) REFERENCES dispositivos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reemplazo_usuario_inicio
        FOREIGN KEY (usuario_inicio_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reemplazo_usuario_cierre
        FOREIGN KEY (usuario_cierre_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT fk_reemplazo_comprobante
        FOREIGN KEY (comprobante_devolucion_id) REFERENCES comprobantes_devolucion(id) ON DELETE RESTRICT,
    CONSTRAINT chk_reemplazo_dispositivos_distintos
        CHECK (dispositivo_anterior_id <> dispositivo_nuevo_id),
    CONSTRAINT chk_reemplazo_estado
        CHECK (estado_operacion IN ('PENDIENTE_DEVOLUCION', 'COMPLETADO', 'CANCELADO')),
    CONSTRAINT chk_reemplazo_cierre_consistente
        CHECK (
            (
                estado_operacion = 'PENDIENTE_DEVOLUCION'
                AND fecha_recepcion_anterior IS NULL
                AND fecha_cierre IS NULL
                AND usuario_cierre_id IS NULL
                AND comprobante_devolucion_id IS NULL
                AND destino_dispositivo_anterior IS NULL
                AND motivo_cancelacion IS NULL
            )
            OR
            (
                estado_operacion = 'COMPLETADO'
                AND fecha_recepcion_anterior IS NOT NULL
                AND fecha_cierre IS NOT NULL
                AND usuario_cierre_id IS NOT NULL
                AND comprobante_devolucion_id IS NOT NULL
                AND NULLIF(BTRIM(destino_dispositivo_anterior), '') IS NOT NULL
                AND motivo_cancelacion IS NULL
            )
            OR
            (
                estado_operacion = 'CANCELADO'
                AND fecha_cierre IS NOT NULL
                AND usuario_cierre_id IS NOT NULL
                AND NULLIF(BTRIM(motivo_cancelacion), '') IS NOT NULL
                AND fecha_recepcion_anterior IS NULL
                AND comprobante_devolucion_id IS NULL
                AND destino_dispositivo_anterior IS NULL
            )
        )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_reemplazo_pendiente_anterior
    ON reemplazos_dispositivo (dispositivo_anterior_id)
    WHERE estado_operacion = 'PENDIENTE_DEVOLUCION';

CREATE UNIQUE INDEX IF NOT EXISTS uq_reemplazo_pendiente_nuevo
    ON reemplazos_dispositivo (dispositivo_nuevo_id)
    WHERE estado_operacion = 'PENDIENTE_DEVOLUCION';

CREATE UNIQUE INDEX IF NOT EXISTS uq_reemplazo_comprobante
    ON reemplazos_dispositivo (comprobante_devolucion_id)
    WHERE comprobante_devolucion_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reemplazos_colaborador_estado
    ON reemplazos_dispositivo (colaborador_id, estado_operacion, fecha_inicio DESC);

CREATE INDEX IF NOT EXISTS idx_reemplazos_estado_fecha
    ON reemplazos_dispositivo (estado_operacion, fecha_inicio DESC);

CREATE OR REPLACE FUNCTION fn_reemplazo_dispositivo_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reemplazos_dispositivo_updated_at ON reemplazos_dispositivo;

CREATE TRIGGER trg_reemplazos_dispositivo_updated_at
BEFORE UPDATE ON reemplazos_dispositivo
FOR EACH ROW EXECUTE FUNCTION fn_reemplazo_dispositivo_updated_at();

COMMENT ON TABLE reemplazos_dispositivo IS
'Estado actual de las operaciones de reemplazo de dispositivos. La custodia continua en dispositivos.colaborador_id/departamento_id.';

COMMENT ON COLUMN reemplazos_dispositivo.estado_operacion IS
'PENDIENTE_DEVOLUCION, COMPLETADO o CANCELADO. No es un estado del dispositivo.';

COMMENT ON COLUMN reemplazos_dispositivo.destino_dispositivo_anterior IS
'Codigo del estado operativo aplicado al dispositivo anterior despues de su recepcion.';

INSERT INTO schema_migrations (version, nombre)
VALUES ('037', 'device_replacements')
ON CONFLICT (version) DO NOTHING;

COMMIT;
