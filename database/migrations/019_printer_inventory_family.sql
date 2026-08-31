-- ITAM v3.0 - Familia independiente para impresoras (7000)
BEGIN;

SET search_path TO itam, public;

DO $migration$
DECLARE
    v_family_by_prefix BIGINT;
    v_family_by_key BIGINT;
    v_family_id BIGINT;
    v_type_id BIGINT;
    v_type_family_id BIGINT;
BEGIN
    SELECT id INTO v_family_by_prefix
    FROM familias_codigo_inventario
    WHERE prefijo = '7';

    SELECT id INTO v_family_by_key
    FROM familias_codigo_inventario
    WHERE tipo_entidad = 'DISPOSITIVO'
      AND tipo_activo_normalizado = 'IMPRESORA';

    IF v_family_by_prefix IS NOT NULL
       AND v_family_by_key IS NOT NULL
       AND v_family_by_prefix <> v_family_by_key THEN
        RAISE EXCEPTION
            'El prefijo 7 y la familia IMPRESORA pertenecen a registros diferentes.';
    END IF;

    v_family_id := COALESCE(v_family_by_prefix, v_family_by_key);

    IF v_family_id IS NULL THEN
        INSERT INTO familias_codigo_inventario (
            tipo_entidad,
            tipo_activo_normalizado,
            nombre_familia,
            prefijo,
            estrategia_codigo,
            version_esquema,
            agrupa_tipos,
            etiqueta_operativa,
            activo
        )
        VALUES (
            'DISPOSITIVO',
            'IMPRESORA',
            'Impresora',
            '7',
            'REPEAT_PREFIX',
            1,
            FALSE,
            'Impresora',
            TRUE
        )
        RETURNING id INTO v_family_id;
    ELSE
        IF EXISTS (
            SELECT 1
            FROM familias_codigo_inventario
            WHERE id = v_family_id
              AND (
                  tipo_entidad <> 'DISPOSITIVO'
                  OR prefijo <> '7'
                  OR tipo_activo_normalizado <> 'IMPRESORA'
              )
        ) THEN
            RAISE EXCEPTION
                'El prefijo 7 ya se encuentra reservado por una familia incompatible.';
        END IF;

        UPDATE familias_codigo_inventario
        SET nombre_familia = 'Impresora',
            estrategia_codigo = 'REPEAT_PREFIX',
            version_esquema = 1,
            agrupa_tipos = FALSE,
            etiqueta_operativa = 'Impresora',
            activo = TRUE
        WHERE id = v_family_id;
    END IF;

    SELECT id, familia_codigo_inventario_id
    INTO v_type_id, v_type_family_id
    FROM tipos_dispositivo
    WHERE LOWER(BTRIM(nombre)) = 'impresora'
    LIMIT 1;

    IF v_type_id IS NULL THEN
        INSERT INTO tipos_dispositivo (
            nombre,
            descripcion,
            familia_codigo_inventario_id,
            activo,
            requiere_imei,
            configuracion_formulario
        )
        VALUES (
            'Impresora',
            'Impresora corporativa administrada como activo ITAM independiente.',
            v_family_id,
            TRUE,
            FALSE,
            '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[]}'::JSONB
        );
    ELSE
        IF v_type_family_id IS DISTINCT FROM v_family_id
           AND EXISTS (
               SELECT 1
               FROM dispositivos
               WHERE tipo_dispositivo_id = v_type_id
           ) THEN
            RAISE EXCEPTION
                'No se puede mover Impresora a la familia 7000 porque posee activos emitidos.';
        END IF;

        UPDATE tipos_dispositivo
        SET nombre = 'Impresora',
            descripcion = 'Impresora corporativa administrada como activo ITAM independiente.',
            familia_codigo_inventario_id = v_family_id,
            activo = TRUE,
            requiere_imei = FALSE,
            configuracion_formulario =
                '{"mostrarMarca":true,"mostrarModelo":true,"mostrarNumeroSerie":true,"camposEspecificos":[]}'::JSONB
        WHERE id = v_type_id;
    END IF;
END;
$migration$;

INSERT INTO schema_migrations (version, nombre)
VALUES ('019', 'printer_inventory_family')
ON CONFLICT (version) DO NOTHING;

COMMIT;
