-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 010 - Custodia técnica, equipos temporales y devoluciones
-- ============================================================

BEGIN;

SET search_path TO itam, public;

ALTER TABLE ordenes_servicio_tecnico
    ADD COLUMN custodio_tipo_al_ingreso VARCHAR(20),
    ADD COLUMN colaborador_id_al_ingreso BIGINT,
    ADD COLUMN departamento_id_al_ingreso BIGINT,
    ADD COLUMN recibido_por_id_al_ingreso BIGINT,
    ADD CONSTRAINT fk_orden_custodio_colaborador
        FOREIGN KEY (colaborador_id_al_ingreso) REFERENCES colaboradores(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_orden_custodio_departamento
        FOREIGN KEY (departamento_id_al_ingreso) REFERENCES departamentos(id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_orden_custodio_recepcionante
        FOREIGN KEY (recibido_por_id_al_ingreso) REFERENCES colaboradores(id) ON DELETE RESTRICT,
    ADD CONSTRAINT chk_orden_custodio_ingreso CHECK (
        (custodio_tipo_al_ingreso IS NULL
            AND colaborador_id_al_ingreso IS NULL
            AND departamento_id_al_ingreso IS NULL
            AND recibido_por_id_al_ingreso IS NULL)
        OR
        (custodio_tipo_al_ingreso = 'COLABORADOR'
            AND colaborador_id_al_ingreso IS NOT NULL
            AND departamento_id_al_ingreso IS NULL
            AND recibido_por_id_al_ingreso IS NULL)
        OR
        (custodio_tipo_al_ingreso = 'DEPARTAMENTO'
            AND colaborador_id_al_ingreso IS NULL
            AND departamento_id_al_ingreso IS NOT NULL
            AND recibido_por_id_al_ingreso IS NOT NULL)
    );

UPDATE ordenes_servicio_tecnico orden
SET custodio_tipo_al_ingreso = CASE
        WHEN dispositivo.colaborador_id IS NOT NULL THEN 'COLABORADOR'
        WHEN dispositivo.departamento_id IS NOT NULL THEN 'DEPARTAMENTO'
        ELSE NULL
    END,
    colaborador_id_al_ingreso = dispositivo.colaborador_id,
    departamento_id_al_ingreso = dispositivo.departamento_id,
    recibido_por_id_al_ingreso = dispositivo.recibido_por_id
FROM dispositivos dispositivo
WHERE dispositivo.id = orden.dispositivo_id;

CREATE TABLE entregas_temporales_servicio (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    orden_servicio_id BIGINT NOT NULL,
    dispositivo_temporal_id BIGINT NOT NULL,
    colaborador_id BIGINT NOT NULL,
    fecha_entrega TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responsable_entrega VARCHAR(150) NOT NULL,
    observaciones_entrega TEXT,
    fecha_devolucion TIMESTAMPTZ,
    responsable_devolucion VARCHAR(150),
    observaciones_devolucion TEXT,
    estado VARCHAR(20) NOT NULL DEFAULT 'ABIERTA',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_entrega_temporal_orden
        FOREIGN KEY (orden_servicio_id) REFERENCES ordenes_servicio_tecnico(id) ON DELETE RESTRICT,
    CONSTRAINT fk_entrega_temporal_dispositivo
        FOREIGN KEY (dispositivo_temporal_id) REFERENCES dispositivos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_entrega_temporal_colaborador
        FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE RESTRICT,
    CONSTRAINT chk_entrega_temporal_estado
        CHECK (estado IN ('ABIERTA', 'CERRADA', 'CANCELADA')),
    CONSTRAINT chk_entrega_temporal_cierre CHECK (
        (estado = 'ABIERTA' AND fecha_devolucion IS NULL AND responsable_devolucion IS NULL)
        OR
        (estado IN ('CERRADA', 'CANCELADA') AND fecha_devolucion IS NOT NULL
            AND responsable_devolucion IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_entrega_temporal_abierta_orden
    ON entregas_temporales_servicio (orden_servicio_id)
    WHERE estado = 'ABIERTA';

CREATE UNIQUE INDEX uq_entrega_temporal_abierta_dispositivo
    ON entregas_temporales_servicio (dispositivo_temporal_id)
    WHERE estado = 'ABIERTA';

CREATE TRIGGER trg_entrega_temporal_actualizado_en
BEFORE UPDATE ON entregas_temporales_servicio
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TABLE secuencias_comprobante_devolucion (
    anio INTEGER PRIMARY KEY,
    ultimo_numero INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT chk_secuencia_comprobante_anio CHECK (anio BETWEEN 2020 AND 2200),
    CONSTRAINT chk_secuencia_comprobante_numero CHECK (ultimo_numero >= 0)
);

CREATE TABLE comprobantes_devolucion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_comprobante VARCHAR(20) NOT NULL UNIQUE,
    dispositivo_id BIGINT NOT NULL,
    acta_entrega_detalle_id BIGINT,
    colaborador_id BIGINT,
    departamento_id BIGINT,
    devuelto_por_id BIGINT,
    fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    condicion VARCHAR(120),
    resultado VARCHAR(20) NOT NULL,
    observaciones TEXT,
    responsable_ti VARCHAR(150) NOT NULL,
    origen VARCHAR(30) NOT NULL DEFAULT 'INVENTARIO',
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_comprobante_dispositivo
        FOREIGN KEY (dispositivo_id) REFERENCES dispositivos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_comprobante_acta_detalle
        FOREIGN KEY (acta_entrega_detalle_id) REFERENCES actas_entrega_detalle(id) ON DELETE RESTRICT,
    CONSTRAINT fk_comprobante_colaborador
        FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE RESTRICT,
    CONSTRAINT fk_comprobante_departamento
        FOREIGN KEY (departamento_id) REFERENCES departamentos(id) ON DELETE RESTRICT,
    CONSTRAINT fk_comprobante_devuelto_por
        FOREIGN KEY (devuelto_por_id) REFERENCES colaboradores(id) ON DELETE RESTRICT,
    CONSTRAINT chk_comprobante_resultado CHECK (resultado IN ('DEVUELTO', 'DANADO')),
    CONSTRAINT chk_comprobante_origen CHECK (origen IN ('INVENTARIO', 'OFFBOARDING')),
    CONSTRAINT chk_comprobante_custodio CHECK (
        (colaborador_id IS NOT NULL AND departamento_id IS NULL)
        OR
        (colaborador_id IS NULL AND departamento_id IS NOT NULL AND devuelto_por_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_comprobante_acta_detalle
    ON comprobantes_devolucion (acta_entrega_detalle_id)
    WHERE acta_entrega_detalle_id IS NOT NULL;

CREATE INDEX idx_comprobantes_dispositivo_fecha
    ON comprobantes_devolucion (dispositivo_id, fecha DESC);

CREATE INDEX idx_comprobantes_colaborador_fecha
    ON comprobantes_devolucion (colaborador_id, fecha DESC);

INSERT INTO schema_migrations (version, nombre)
VALUES ('010', 'custody_returns_and_temporary_assets');

COMMIT;
