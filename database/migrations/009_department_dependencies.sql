-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 009 - Dependencia opcional de departamentos
-- ============================================================

BEGIN;

SET search_path TO itam, public;

ALTER TABLE departamentos
    ADD COLUMN dependencia_id INTEGER NULL,
    ADD CONSTRAINT fk_departamentos_dependencia
        FOREIGN KEY (dependencia_id) REFERENCES departamentos(id),
    ADD CONSTRAINT chk_departamentos_dependencia_propia
        CHECK (dependencia_id IS NULL OR dependencia_id <> id);

COMMENT ON COLUMN departamentos.dependencia_id IS
'Departamento del cual depende opcionalmente esta unidad.';

COMMIT;
