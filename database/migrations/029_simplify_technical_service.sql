-- ============================================================
-- ITAM - Flujo simplificado de servicio técnico
-- ============================================================

BEGIN;

SET search_path TO itam, public;

ALTER TABLE ordenes_servicio_tecnico
    ADD COLUMN tipo_servicio VARCHAR(20) NOT NULL DEFAULT 'DIAGNOSTICO',
    ADD COLUMN accesorios_entregados TEXT,
    ADD COLUMN plazo_informado VARCHAR(120),
    ADD COLUMN estado_final VARCHAR(20),
    ADD COLUMN observaciones_retorno TEXT,
    ADD CONSTRAINT chk_orden_servicio_tipo_servicio CHECK (
        tipo_servicio IN ('GARANTIA', 'REPARACION', 'MANTENCION', 'DIAGNOSTICO')
    ),
    ADD CONSTRAINT chk_orden_servicio_estado_final CHECK (
        estado_final IS NULL OR estado_final IN ('OPERATIVO', 'SIN_REPARACION', 'BAJA')
    );

INSERT INTO schema_migrations (version, nombre)
VALUES ('029', 'simplify_technical_service');

COMMIT;
