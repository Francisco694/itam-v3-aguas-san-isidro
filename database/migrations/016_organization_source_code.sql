-- ITAM v3.0 - Identificador estable de la fuente organizacional oficial.
BEGIN;

SET search_path TO itam, public;

ALTER TABLE departamentos
    ADD COLUMN codigo_organizacional VARCHAR(40),
    ADD CONSTRAINT chk_departamento_codigo_organizacional
        CHECK (
            codigo_organizacional IS NULL
            OR BTRIM(codigo_organizacional) <> ''
        );

CREATE UNIQUE INDEX uq_departamentos_codigo_organizacional
    ON departamentos (codigo_organizacional)
    WHERE codigo_organizacional IS NOT NULL;

COMMENT ON COLUMN departamentos.codigo_organizacional IS
    'ID estable de la unidad en la fuente organizacional oficial; no corresponde al ID interno.';

INSERT INTO schema_migrations (version, nombre)
VALUES ('016', 'organization_source_code');

COMMIT;
