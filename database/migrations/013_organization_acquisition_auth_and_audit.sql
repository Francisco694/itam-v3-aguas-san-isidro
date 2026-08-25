-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migracion 013 - Organizacion, adquisicion, autenticacion y auditoria
-- Incremental y no destructiva. Los historicos admiten ejecutor NULL.
-- ============================================================

BEGIN;

SET search_path TO itam, public;

-- La jerarquia organizacional no admite ciclos directos ni indirectos.
CREATE OR REPLACE FUNCTION fn_validar_ciclo_departamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.dependencia_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.id = NEW.dependencia_id THEN
        RAISE EXCEPTION 'Un departamento no puede depender de si mismo.';
    END IF;

    IF EXISTS (
        WITH RECURSIVE ascendencia AS (
            SELECT id, dependencia_id
            FROM departamentos
            WHERE id = NEW.dependencia_id

            UNION ALL

            SELECT padre.id, padre.dependencia_id
            FROM departamentos padre
            INNER JOIN ascendencia actual
                ON padre.id = actual.dependencia_id
        )
        SELECT 1 FROM ascendencia WHERE id = NEW.id
    ) THEN
        RAISE EXCEPTION 'La dependencia seleccionada genera un ciclo organizacional.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_departamentos_sin_ciclos
BEFORE INSERT OR UPDATE OF dependencia_id
ON departamentos
FOR EACH ROW
EXECUTE FUNCTION fn_validar_ciclo_departamento();

-- ITAM registra antecedentes de adquisicion, no gestiona compras.
CREATE TABLE facturas_adquisicion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    numero_factura VARCHAR(80) NOT NULL,
    fecha_factura DATE,
    proveedor VARCHAR(180),
    monto_total BIGINT,
    observaciones TEXT,
    referencia_documental VARCHAR(300),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_factura_monto CHECK (monto_total IS NULL OR monto_total >= 0),
    CONSTRAINT uq_factura_proveedor_numero UNIQUE NULLS NOT DISTINCT
        (numero_factura, proveedor)
);

CREATE TRIGGER trg_factura_adquisicion_actualizado_en
BEFORE UPDATE ON facturas_adquisicion
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

ALTER TABLE dispositivos
    ADD COLUMN factura_adquisicion_id BIGINT,
    ADD CONSTRAINT fk_dispositivo_factura_adquisicion
        FOREIGN KEY (factura_adquisicion_id)
        REFERENCES facturas_adquisicion(id)
        ON DELETE RESTRICT;

CREATE INDEX idx_dispositivos_factura_adquisicion
    ON dispositivos (factura_adquisicion_id);

-- Autenticacion productiva minima: dos perfiles y sesiones revocables.
CREATE TABLE usuarios (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(180) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash TEXT NOT NULL,
    rol VARCHAR(30) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_usuario_rol CHECK (rol IN ('SUPER_USUARIO', 'USUARIO'))
);

CREATE UNIQUE INDEX uq_usuarios_email_normalizado
    ON usuarios (LOWER(BTRIM(email)));

CREATE TRIGGER trg_usuario_actualizado_en
BEFORE UPDATE ON usuarios
FOR EACH ROW EXECUTE FUNCTION fn_actualizar_timestamp();

CREATE TABLE sesiones_usuario (
    token_hash CHAR(64) PRIMARY KEY,
    usuario_id BIGINT NOT NULL,
    expira_en TIMESTAMPTZ NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revocado_en TIMESTAMPTZ,
    CONSTRAINT fk_sesion_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE RESTRICT
);

CREATE INDEX idx_sesiones_usuario_vigentes
    ON sesiones_usuario (usuario_id, expira_en)
    WHERE revocado_en IS NULL;

CREATE TABLE auditoria_operaciones (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_ejecutor_id BIGINT,
    metodo VARCHAR(10) NOT NULL,
    ruta VARCHAR(300) NOT NULL,
    codigo_respuesta INTEGER NOT NULL,
    tipo_entidad VARCHAR(80),
    entidad_id VARCHAR(80),
    detalle JSONB NOT NULL DEFAULT '{}'::JSONB,
    fecha_evento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_auditoria_usuario
        FOREIGN KEY (usuario_ejecutor_id) REFERENCES usuarios(id) ON DELETE RESTRICT,
    CONSTRAINT chk_auditoria_detalle CHECK (JSONB_TYPEOF(detalle) = 'object')
);

CREATE INDEX idx_auditoria_usuario_fecha
    ON auditoria_operaciones (usuario_ejecutor_id, fecha_evento DESC);

CREATE INDEX idx_auditoria_fecha
    ON auditoria_operaciones (fecha_evento DESC);

ALTER TABLE historial_eventos
    ADD COLUMN usuario_ejecutor_id BIGINT,
    ADD CONSTRAINT fk_historial_usuario_ejecutor
        FOREIGN KEY (usuario_ejecutor_id) REFERENCES usuarios(id) ON DELETE RESTRICT;

ALTER TABLE ordenes_servicio_tecnico
    ADD COLUMN observaciones_envio TEXT,
    ADD COLUMN usuario_ejecutor_id BIGINT,
    ADD CONSTRAINT fk_orden_servicio_usuario_ejecutor
        FOREIGN KEY (usuario_ejecutor_id) REFERENCES usuarios(id) ON DELETE RESTRICT;

ALTER TABLE entregas_temporales_servicio
    ADD COLUMN usuario_ejecutor_id BIGINT,
    ADD CONSTRAINT fk_entrega_temporal_usuario_ejecutor
        FOREIGN KEY (usuario_ejecutor_id) REFERENCES usuarios(id) ON DELETE RESTRICT;

ALTER TABLE bajas_dispositivo
    ADD COLUMN usuario_ejecutor_id BIGINT,
    ADD CONSTRAINT fk_baja_usuario_ejecutor
        FOREIGN KEY (usuario_ejecutor_id) REFERENCES usuarios(id) ON DELETE RESTRICT;

ALTER TABLE actas_entrega
    ADD COLUMN usuario_ejecutor_id BIGINT,
    ADD CONSTRAINT fk_acta_usuario_ejecutor
        FOREIGN KEY (usuario_ejecutor_id) REFERENCES usuarios(id) ON DELETE RESTRICT;

ALTER TABLE comprobantes_devolucion
    ADD COLUMN usuario_ejecutor_id BIGINT,
    ADD CONSTRAINT fk_comprobante_usuario_ejecutor
        FOREIGN KEY (usuario_ejecutor_id) REFERENCES usuarios(id) ON DELETE RESTRICT;

INSERT INTO schema_migrations (version, nombre)
VALUES ('013', 'organization_acquisition_auth_and_audit');

COMMIT;
