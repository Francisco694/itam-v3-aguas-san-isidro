-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migracion 023 - RUT canonico y conciliacion P1-10
-- ============================================================

BEGIN;

SET search_path TO itam, public;

LOCK TABLE colaboradores IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
    duplicate_references BIGINT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM colaboradores
        WHERE id = 1
          AND UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g')) = '111844739'
    ) THEN
        RAISE EXCEPTION
            'P1-10: el colaborador maestro 1 no existe o su RUT no coincide con la evidencia auditada';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM colaboradores
        WHERE id = 392
          AND UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g')) = '111844739'
          AND activo = FALSE
    ) THEN
        RAISE EXCEPTION
            'P1-10: el duplicado inactivo 392 no existe o cambio desde la auditoria previa';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM colaboradores
        GROUP BY UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g'))
        HAVING COUNT(*) > 1
           AND UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g')) <> '111844739'
    ) THEN
        RAISE EXCEPTION
            'P1-10: existen duplicados de RUT adicionales que no fueron auditados';
    END IF;

    SELECT
        (SELECT COUNT(*) FROM actas_entrega WHERE colaborador_id = 392)
      + (SELECT COUNT(*) FROM actas_entrega WHERE recepcionante_id = 392)
      + (SELECT COUNT(*) FROM comprobantes_devolucion WHERE colaborador_id = 392)
      + (SELECT COUNT(*) FROM comprobantes_devolucion WHERE devuelto_por_id = 392)
      + (SELECT COUNT(*) FROM dispositivos WHERE colaborador_id = 392)
      + (SELECT COUNT(*) FROM dispositivos WHERE recibido_por_id = 392)
      + (SELECT COUNT(*) FROM entregas_temporales_servicio WHERE colaborador_id = 392)
      + (SELECT COUNT(*) FROM ordenes_servicio_tecnico WHERE colaborador_id_al_ingreso = 392)
      + (SELECT COUNT(*) FROM ordenes_servicio_tecnico WHERE recibido_por_id_al_ingreso = 392)
      + (SELECT COUNT(*) FROM procesos_offboarding WHERE colaborador_id = 392)
      + (SELECT COUNT(*) FROM sim WHERE colaborador_id = 392)
    INTO duplicate_references;

    IF duplicate_references <> 0 THEN
        RAISE EXCEPTION
            'P1-10: el duplicado 392 ahora tiene % referencias; se requiere una nueva auditoria',
            duplicate_references;
    END IF;
END;
$$;

INSERT INTO auditoria_operaciones (
    usuario_ejecutor_id,
    metodo,
    ruta,
    codigo_respuesta,
    tipo_entidad,
    entidad_id,
    detalle
)
SELECT
    NULL,
    'DATA',
    '/internal/data-reconciliation/P1-10',
    200,
    'COLABORADOR',
    duplicate.id::TEXT,
    JSONB_BUILD_OBJECT(
        'accion', 'FUSION_COLABORADOR_DUPLICADO',
        'rutCanonico', '111844739',
        'colaboradorMaestroId', master.id,
        'colaboradorDuplicadoId', duplicate.id,
        'referenciasMigradas', 0,
        'motivo', 'Mismo RUT valido; el maestro conserva toda la custodia y el duplicado estaba inactivo sin referencias',
        'maestro', JSONB_BUILD_OBJECT(
            'nombre', master.nombre,
            'rutAnterior', master.rut,
            'activo', master.activo,
            'departamentoId', master.departamento_id
        ),
        'duplicado', JSONB_BUILD_OBJECT(
            'nombre', duplicate.nombre,
            'rutAnterior', duplicate.rut,
            'activo', duplicate.activo,
            'departamentoId', duplicate.departamento_id
        )
    )
FROM colaboradores master
JOIN colaboradores duplicate ON duplicate.id = 392
WHERE master.id = 1;

DELETE FROM colaboradores
WHERE id = 392;

UPDATE colaboradores
SET rut = UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g'))
WHERE rut IS DISTINCT FROM
      UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g'));

ALTER TABLE colaboradores
    DROP CONSTRAINT IF EXISTS colaboradores_rut_key;

ALTER TABLE colaboradores
    ALTER COLUMN rut TYPE TEXT;

ALTER TABLE colaboradores
    ADD CONSTRAINT chk_colaboradores_rut_canonico
        CHECK (
            rut ~ '^[0-9]+[0-9K]$'
            AND rut = UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g'))
        ),
    ADD CONSTRAINT uq_colaboradores_rut_canonico
        UNIQUE (rut);

COMMENT ON COLUMN colaboradores.rut IS
'RUT canonico sin puntos, guion ni espacios; digitos y digito verificador K en mayuscula.';

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM colaboradores
        GROUP BY rut
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'P1-10: persistieron RUT duplicados luego de la conciliacion';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM colaboradores
        WHERE rut !~ '^[0-9]+[0-9K]$'
           OR rut <> UPPER(REGEXP_REPLACE(BTRIM(rut), '[^0-9Kk]', '', 'g'))
    ) THEN
        RAISE EXCEPTION 'P1-10: persistieron RUT fuera del formato canonico';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM colaboradores WHERE id = 1 AND rut = '111844739'
    ) OR EXISTS (
        SELECT 1 FROM colaboradores WHERE id = 392
    ) THEN
        RAISE EXCEPTION 'P1-10: la conciliacion 1/392 no alcanzo el estado esperado';
    END IF;
END;
$$;

INSERT INTO schema_migrations (version, nombre)
VALUES ('023', 'canonical_collaborator_rut');

COMMIT;
