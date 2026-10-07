-- ITAM - Migración 040 - Ampliación del catálogo de tipos de dispositivos
--
-- Amplía únicamente el catálogo y la configuración dinámica de formularios.
-- No cambia códigos ITAM, ordinales ni relaciones de dispositivos existentes.

BEGIN;

SET search_path TO itam, public;

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM familias_codigo_inventario
     WHERE prefijo = '8'
       AND (
         tipo_entidad <> 'DISPOSITIVO'
         OR nombre_familia <> 'Tablet'
         OR activo IS NOT TRUE
       )
  ) THEN
    RAISE EXCEPTION 'El prefijo 8 ya está ocupado por una configuración incompatible.';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM familias_codigo_inventario
     WHERE prefijo = '9'
       AND (
         tipo_entidad <> 'DISPOSITIVO'
         OR nombre_familia <> 'Redes y comunicaciones'
         OR activo IS NOT TRUE
       )
  ) THEN
    RAISE EXCEPTION 'El prefijo 9 ya está ocupado por una configuración incompatible.';
  END IF;
END
$migration$;

UPDATE familias_codigo_inventario
   SET nombre_familia = CASE prefijo
       WHEN '4' THEN 'Pantallas y audiovisual'
       WHEN '5' THEN 'Equipos de cómputo'
       WHEN '6' THEN 'Periféricos y accesorios'
       WHEN '7' THEN 'Impresión y digitalización'
       ELSE nombre_familia
     END,
       agrupa_tipos = CASE WHEN prefijo IN ('4', '5', '6', '7') THEN TRUE ELSE agrupa_tipos END,
       etiqueta_operativa = CASE prefijo
         WHEN '4' THEN 'Pantallas y audiovisual'
         WHEN '5' THEN 'Equipos de cómputo'
         WHEN '6' THEN 'Periféricos y accesorios'
         WHEN '7' THEN 'Impresión y digitalización'
         ELSE etiqueta_operativa
       END
 WHERE tipo_entidad = 'DISPOSITIVO'
   AND prefijo IN ('4', '5', '6', '7');

INSERT INTO familias_codigo_inventario (
  tipo_entidad,
  tipo_activo_normalizado,
  nombre_familia,
  prefijo,
  estrategia_codigo,
  agrupa_tipos,
  etiqueta_operativa
)
VALUES
  ('DISPOSITIVO', 'TABLET', 'Tablet', '8', 'REPEAT_PREFIX', FALSE, NULL),
  ('DISPOSITIVO', 'REDES_Y_COMUNICACIONES', 'Redes y comunicaciones', '9',
   'REPEAT_PREFIX', TRUE, 'Redes y comunicaciones')
ON CONFLICT (prefijo) DO NOTHING;

INSERT INTO tipos_dispositivo (
  nombre,
  descripcion,
  familia_codigo_inventario_id,
  activo,
  requiere_imei,
  configuracion_formulario
)
SELECT datos.nombre,
       datos.descripcion,
       familia.id,
       TRUE,
       datos.requiere_imei,
       datos.configuracion_formulario
  FROM (
    VALUES
      ('Smart TV', 'Televisor inteligente corporativo.', '4', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"tamanoPulgadas","etiqueta":"Tamaño (pulgadas)","tipo":"number","requerido":false,"min":1,"max":200}],"permiteSim":false}'::jsonb),
      ('Proyector', 'Proyector audiovisual corporativo.', '4', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[],"permiteSim":false}'::jsonb),
      ('Servidor', 'Servidor físico de infraestructura.', '5', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"hostname","etiqueta":"Hostname","tipo":"text","requerido":false,"maxLength":120}],"permiteSim":false}'::jsonb),
      ('NAS', 'Sistema de almacenamiento conectado a red.', '5', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"hostnameIp","etiqueta":"Hostname / IP","tipo":"text","requerido":false,"maxLength":120}],"permiteSim":false}'::jsonb),
      ('Audífonos', 'Audífonos corporativos.', '6', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[],"permiteSim":false}'::jsonb),
      ('Parlantes', 'Parlantes corporativos.', '6', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[],"permiteSim":false}'::jsonb),
      ('Micrófono', 'Micrófono corporativo.', '6', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[],"permiteSim":false}'::jsonb),
      ('Disco externo', 'Unidad de almacenamiento externa.', '6', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[],"permiteSim":false}'::jsonb),
      ('Pendrive', 'Unidad de almacenamiento USB.', '6', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[],"permiteSim":false}'::jsonb),
      ('Lector código de barras', 'Lector corporativo de códigos de barras.', '6', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[],"permiteSim":false}'::jsonb),
      ('UPS / No Break', 'Sistema de respaldo eléctrico.', '6', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[],"permiteSim":false}'::jsonb),
      ('Otro periférico', 'Otro periférico o accesorio corporativo.', '6', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"nombrePeriferico","etiqueta":"Nombre del periférico","tipo":"text","requerido":true,"maxLength":100}],"permiteSim":false}'::jsonb),
      ('Multifuncional', 'Equipo multifuncional de impresión y digitalización.', '7', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[],"permiteSim":false}'::jsonb),
      ('Scanner', 'Escáner corporativo.', '7', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[],"permiteSim":false}'::jsonb),
      ('Tablet', 'Tableta corporativa.', '8', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"mostrarImei":true,"camposEspecificos":[],"permiteSim":false}'::jsonb),
      ('Punto de acceso', 'Punto de acceso inalámbrico.', '9', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"mac","etiqueta":"MAC","tipo":"text","requerido":false,"maxLength":50},{"clave":"ip","etiqueta":"IP","tipo":"text","requerido":false,"maxLength":50}],"permiteSim":false}'::jsonb),
      ('Switch', 'Switch de red.', '9', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"mac","etiqueta":"MAC","tipo":"text","requerido":false,"maxLength":50},{"clave":"ip","etiqueta":"IP","tipo":"text","requerido":false,"maxLength":50}],"permiteSim":false}'::jsonb),
      ('Router', 'Router de red.', '9', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"mac","etiqueta":"MAC","tipo":"text","requerido":false,"maxLength":50},{"clave":"ip","etiqueta":"IP","tipo":"text","requerido":false,"maxLength":50}],"permiteSim":false}'::jsonb),
      ('Firewall', 'Firewall de red.', '9', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"mac","etiqueta":"MAC","tipo":"text","requerido":false,"maxLength":50},{"clave":"ip","etiqueta":"IP","tipo":"text","requerido":false,"maxLength":50}],"permiteSim":false}'::jsonb),
      ('Teléfono IP', 'Teléfono IP corporativo.', '9', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"mac","etiqueta":"MAC","tipo":"text","requerido":false,"maxLength":50}],"permiteSim":false}'::jsonb),
      ('Cámara IP', 'Cámara IP corporativa.', '9', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"mac","etiqueta":"MAC","tipo":"text","requerido":false,"maxLength":50},{"clave":"ip","etiqueta":"IP","tipo":"text","requerido":false,"maxLength":50}],"permiteSim":false}'::jsonb),
      ('Módem / ONT', 'Módem o terminal óptico de red.', '9', FALSE,
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"mac","etiqueta":"MAC","tipo":"text","requerido":false,"maxLength":50},{"clave":"ip","etiqueta":"IP","tipo":"text","requerido":false,"maxLength":50}],"permiteSim":false}'::jsonb)
  ) AS datos(nombre, descripcion, prefijo, requiere_imei, configuracion_formulario)
  JOIN familias_codigo_inventario familia
    ON familia.prefijo = datos.prefijo
   AND familia.tipo_entidad = 'DISPOSITIVO'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations(version, nombre)
VALUES ('040', 'expand_device_types')
ON CONFLICT (version) DO NOTHING;

COMMIT;

