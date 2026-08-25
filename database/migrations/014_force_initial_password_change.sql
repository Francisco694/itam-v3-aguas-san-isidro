-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migracion 014 - Cargo de usuario y cambio de clave inicial
-- Incremental y no destructiva.
-- ============================================================

BEGIN;

SET search_path TO itam, public;

ALTER TABLE usuarios
    ADD COLUMN cargo VARCHAR(150),
    ADD COLUMN debe_cambiar_password BOOLEAN NOT NULL DEFAULT FALSE;

INSERT INTO schema_migrations (version, nombre)
VALUES ('014', 'force_initial_password_change');

COMMIT;
