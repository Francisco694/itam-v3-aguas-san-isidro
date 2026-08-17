-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 007 - Alta dinámica de activos y periféricos
-- ============================================================

BEGIN;

SET search_path TO itam, public;

ALTER TABLE familias_codigo_inventario
    ADD COLUMN agrupa_tipos BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN etiqueta_operativa VARCHAR(80),
    ADD CONSTRAINT chk_familia_etiqueta_operativa
        CHECK (etiqueta_operativa IS NULL OR BTRIM(etiqueta_operativa) <> '');

UPDATE familias_codigo_inventario
SET agrupa_tipos = TRUE,
    etiqueta_operativa = 'Periférico'
WHERE prefijo = '6'
  AND tipo_entidad = 'DISPOSITIVO';

ALTER TABLE tipos_dispositivo
    ADD COLUMN configuracion_formulario JSONB NOT NULL DEFAULT
        '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[]}'::JSONB,
    ADD CONSTRAINT chk_tipo_configuracion_formulario_objeto
        CHECK (JSONB_TYPEOF(configuracion_formulario) = 'object');

ALTER TABLE dispositivos
    ADD COLUMN atributos_especificos JSONB NOT NULL DEFAULT '{}'::JSONB,
    ADD CONSTRAINT chk_dispositivo_atributos_especificos_objeto
        CHECK (JSONB_TYPEOF(atributos_especificos) = 'object');

INSERT INTO tipos_dispositivo (
    nombre,
    descripcion,
    familia_codigo_inventario_id,
    configuracion_formulario
)
SELECT datos.nombre, datos.descripcion, familia.id, datos.configuracion
FROM (
    VALUES
      ('Mouse', 'Dispositivo apuntador.',
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[]}'::JSONB),
      ('Teclado', 'Teclado corporativo.',
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"partNumber","etiqueta":"Part Number","tipo":"text","requerido":false,"maxLength":100}]}'::JSONB),
      ('Cable', 'Cable de conectividad o alimentación.',
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":false,"camposEspecificos":[{"clave":"tipoCable","etiqueta":"Tipo de cable","tipo":"select","requerido":true,"opciones":["HDMI","USB","USB-C","DisplayPort","VGA","Red / Ethernet","Poder","Audio","Otro"]},{"clave":"longitud","etiqueta":"Longitud","tipo":"text","requerido":false,"maxLength":50}]}'::JSONB),
      ('Cargador', 'Cargador o fuente de poder de equipo.',
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"partNumber","etiqueta":"Part Number","tipo":"text","requerido":false,"maxLength":100},{"clave":"potencia","etiqueta":"Potencia","tipo":"text","requerido":false,"maxLength":50}]}'::JSONB),
      ('Docking Station', 'Estación de acoplamiento.',
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[]}'::JSONB),
      ('Webcam', 'Cámara web corporativa.',
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[]}'::JSONB),
      ('Adaptador', 'Adaptador de conectividad.',
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":false,"camposEspecificos":[{"clave":"tipoAdaptador","etiqueta":"Tipo de adaptador","tipo":"text","requerido":true,"maxLength":100}]}'::JSONB),
      ('Hub USB', 'Concentrador de puertos USB.',
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"cantidadPuertos","etiqueta":"Cantidad de puertos","tipo":"number","requerido":false,"min":1,"max":100}]}'::JSONB),
      ('Otro', 'Otro periférico no incluido en el catálogo.',
       '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[{"clave":"nombrePeriferico","etiqueta":"Nombre del periférico","tipo":"text","requerido":true,"maxLength":100}]}'::JSONB)
) AS datos(nombre, descripcion, configuracion)
INNER JOIN familias_codigo_inventario AS familia
    ON familia.prefijo = '6'
   AND familia.tipo_entidad = 'DISPOSITIVO'
ON CONFLICT DO NOTHING;

INSERT INTO schema_migrations (version, nombre)
VALUES ('007', 'dynamic_asset_registration');

COMMIT;

-- Reversión manual conservadora:
-- Los tipos insertados no deben eliminarse si ya poseen activos.
-- En producción se debe restaurar el backup previo si la migración completa
-- requiere reversión después de haber emitido códigos.
