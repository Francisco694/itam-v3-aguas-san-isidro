-- ITAM - Tipos prioritarios para control inicial de stock
BEGIN;
SET search_path TO itam, public;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE version = '027' AND nombre IS DISTINCT FROM 'default_priority_stock_alerts'
    ) THEN
        RAISE EXCEPTION 'Migration 027 is registered with a different name';
    END IF;
END;
$$;

UPDATE configuraciones_alerta_stock config
   SET minimo_disponible = 0,
       alerta_activa = TRUE
  FROM tipos_dispositivo tipo
 WHERE tipo.id = config.tipo_dispositivo_id
   AND UPPER(BTRIM(tipo.nombre)) IN ('SMARTPHONE', 'NOTEBOOK')
   AND config.creado_por_usuario_id IS NULL
   AND config.actualizado_por_usuario_id IS NULL;

INSERT INTO schema_migrations (version, nombre)
VALUES ('027', 'default_priority_stock_alerts')
ON CONFLICT (version) DO NOTHING;

COMMIT;
