-- ITAM v3.0 - PIN de acceso rápido protegido mediante hash.
BEGIN;

SET search_path TO itam, public;

ALTER TABLE usuarios
    ADD COLUMN pin_hash TEXT,
    ADD COLUMN pin_intentos_fallidos SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN pin_bloqueado_hasta TIMESTAMPTZ,
    ADD COLUMN debe_cambiar_pin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD CONSTRAINT chk_usuario_pin_hash
        CHECK (pin_hash IS NULL OR pin_hash LIKE 'scrypt$%'),
    ADD CONSTRAINT chk_usuario_pin_intentos
        CHECK (pin_intentos_fallidos BETWEEN 0 AND 5),
    ADD CONSTRAINT chk_usuario_pin_configuracion
        CHECK (
            pin_hash IS NOT NULL
            OR (
                pin_intentos_fallidos = 0
                AND pin_bloqueado_hasta IS NULL
                AND debe_cambiar_pin = FALSE
            )
        );

INSERT INTO schema_migrations (version, nombre)
VALUES ('017', 'user_pin_auth');

COMMIT;
