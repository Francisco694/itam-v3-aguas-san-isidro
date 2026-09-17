-- ITAM - Datos editables de la Orden de Trabajo de Servicio Técnico

BEGIN;

SET search_path TO itam, public;

ALTER TABLE ordenes_servicio_tecnico
    ADD COLUMN IF NOT EXISTS area_solicitante VARCHAR(180),
    ADD COLUMN IF NOT EXISTS contacto_servicio VARCHAR(180);

INSERT INTO schema_migrations (version, nombre)
VALUES ('030', 'technical_service_work_order_review');

COMMIT;
