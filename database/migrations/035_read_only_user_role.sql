-- ITAM v3.0 - Rol de solo lectura
-- Amplia el catalogo de perfiles sin modificar migraciones historicas.

BEGIN;

SET search_path TO itam, public;

ALTER TABLE usuarios
    DROP CONSTRAINT IF EXISTS chk_usuario_rol;

ALTER TABLE usuarios
    ADD CONSTRAINT chk_usuario_rol
    CHECK (rol IN ('SUPER_USUARIO', 'USUARIO', 'SOLO_LECTURA'));

INSERT INTO schema_migrations (version, nombre)
VALUES ('035', 'read_only_user_role')
ON CONFLICT (version) DO NOTHING;

COMMIT;
