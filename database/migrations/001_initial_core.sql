-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migración 001 - Initial Core
--
-- Núcleo inicial del inventario TI:
--   - Departamentos
--   - Colaboradores
--   - Estados
--   - Dispositivos
--   - SIM
--   - Historial de eventos
--
-- Autor: Francisco Javier Ponce Barril
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ESQUEMA ITAM
-- ============================================================

CREATE SCHEMA IF NOT EXISTS itam;

SET search_path TO itam, public;


-- ============================================================
-- 2. CONTROL DE MIGRACIONES
-- ============================================================

CREATE TABLE schema_migrations (

    version         VARCHAR(20) PRIMARY KEY,

    nombre          VARCHAR(150) NOT NULL,

    aplicado_en     TIMESTAMPTZ NOT NULL DEFAULT NOW()

);


-- ============================================================
-- 3. DEPARTAMENTOS
-- ============================================================

CREATE TABLE departamentos (

    id                  BIGINT GENERATED ALWAYS AS IDENTITY
                        PRIMARY KEY,

    nombre              VARCHAR(120) NOT NULL UNIQUE,

    activo              BOOLEAN NOT NULL DEFAULT TRUE,

    observaciones       TEXT,

    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()

);


COMMENT ON TABLE departamentos IS
'Departamentos de Aguas San Isidro que pueden mantener dispositivos TI bajo su custodia.';


-- ============================================================
-- 4. COLABORADORES
-- ============================================================

CREATE TABLE colaboradores (

    id                  BIGINT GENERATED ALWAYS AS IDENTITY
                        PRIMARY KEY,

    rut                 VARCHAR(20) NOT NULL UNIQUE,

    nombre              VARCHAR(180) NOT NULL,

    cargo               VARCHAR(150),

    departamento_id     BIGINT,

    localidad           VARCHAR(120),

    activo              BOOLEAN NOT NULL DEFAULT TRUE,

    observaciones       TEXT,

    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_colaborador_departamento
        FOREIGN KEY (departamento_id)
        REFERENCES departamentos(id)
        ON DELETE RESTRICT

);


COMMENT ON TABLE colaboradores IS
'Colaboradores que pueden mantener dispositivos y SIM bajo su responsabilidad.';


-- ============================================================
-- 5. CATÁLOGO DE ESTADOS
-- ============================================================

CREATE TABLE estados (

    id                  BIGINT GENERATED ALWAYS AS IDENTITY
                        PRIMARY KEY,

    tipo_entidad        VARCHAR(20) NOT NULL,

    codigo              VARCHAR(40) NOT NULL,

    nombre              VARCHAR(100) NOT NULL,

    descripcion         TEXT,

    es_terminal         BOOLEAN NOT NULL DEFAULT FALSE,

    activo              BOOLEAN NOT NULL DEFAULT TRUE,

    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_estado_tipo_entidad
        CHECK (
            tipo_entidad IN (
                'DISPOSITIVO',
                'SIM'
            )
        ),

    CONSTRAINT uq_estado_tipo_codigo
        UNIQUE (
            tipo_entidad,
            codigo
        )

);


COMMENT ON TABLE estados IS
'Catálogo controlado de estados para dispositivos y SIM.';


-- ============================================================
-- 6. DISPOSITIVOS
-- ============================================================

CREATE TABLE dispositivos (

    id                      BIGINT GENERATED ALWAYS AS IDENTITY
                            PRIMARY KEY,

    -- Código de inventario visible para TI.
    -- Ejemplos:
    -- 1001 Smartphone
    -- 3001 Notebook
    -- 4001 Monitor
    -- 5001 Impresora
    -- 6001 Periférico

    codigo_inventario       INTEGER NOT NULL UNIQUE,

    tipo_dispositivo        VARCHAR(80) NOT NULL,

    marca                   VARCHAR(100),

    modelo                  VARCHAR(150),

    numero_serie            VARCHAR(150),

    imei                    VARCHAR(30),

    estado_id               BIGINT NOT NULL,

    -- Asignación directa a persona.
    colaborador_id          BIGINT,

    -- Asignación directa a departamento.
    departamento_id         BIGINT,

    -- Persona que recibió el dispositivo
    -- cuando fue entregado a un departamento.
    recibido_por_id         BIGINT,

    localidad               VARCHAR(120),

    ubicacion_detalle       VARCHAR(250),

    observaciones           TEXT,

    fecha_registro          DATE NOT NULL DEFAULT CURRENT_DATE,

    creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_dispositivo_codigo
        CHECK (
            codigo_inventario > 0
        ),

    CONSTRAINT fk_dispositivo_estado
        FOREIGN KEY (estado_id)
        REFERENCES estados(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_dispositivo_colaborador
        FOREIGN KEY (colaborador_id)
        REFERENCES colaboradores(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_dispositivo_departamento
        FOREIGN KEY (departamento_id)
        REFERENCES departamentos(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_dispositivo_recibido_por
        FOREIGN KEY (recibido_por_id)
        REFERENCES colaboradores(id)
        ON DELETE RESTRICT,

    -- Un dispositivo puede estar asignado
    -- a una PERSONA o a un DEPARTAMENTO,
    -- pero no a ambos simultáneamente.
    CONSTRAINT chk_dispositivo_un_custodio
        CHECK (
            NOT (
                colaborador_id IS NOT NULL
                AND
                departamento_id IS NOT NULL
            )
        ),

    -- Si existe "recibido_por",
    -- necesariamente debe existir un departamento.
    CONSTRAINT chk_recibido_por_departamento
        CHECK (
            recibido_por_id IS NULL
            OR
            departamento_id IS NOT NULL
        )

);


COMMENT ON TABLE dispositivos IS
'Dispositivos y recursos TI inventariables administrados por Aguas San Isidro.';


-- ============================================================
-- 7. SIM
-- ============================================================

CREATE TABLE sim (

    id                      BIGINT GENERATED ALWAYS AS IDENTITY
                            PRIMARY KEY,

    -- Código de inventario ITAM.
    -- Ejemplo:
    -- 2001
    -- 2002
    -- 2003

    codigo_inventario       INTEGER NOT NULL UNIQUE,

    -- Identificador físico original de la SIM.
    -- Ejemplo:
    -- 8956032255756673254

    iccid_codigo_fabrica    VARCHAR(32) NOT NULL UNIQUE,

    numero_asociado         VARCHAR(30),

    compania                VARCHAR(100),

    estado_id               BIGINT NOT NULL,

    -- Una SIM puede estar asociada actualmente
    -- a un colaborador.
    colaborador_id          BIGINT,

    -- Una SIM puede estar instalada actualmente
    -- en máximo un dispositivo.
    dispositivo_id          BIGINT UNIQUE,

    observaciones           TEXT,

    fecha_registro          DATE NOT NULL DEFAULT CURRENT_DATE,

    creado_en               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    actualizado_en          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sim_codigo
        CHECK (
            codigo_inventario > 0
        ),

    CONSTRAINT fk_sim_estado
        FOREIGN KEY (estado_id)
        REFERENCES estados(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sim_colaborador
        FOREIGN KEY (colaborador_id)
        REFERENCES colaboradores(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_sim_dispositivo
        FOREIGN KEY (dispositivo_id)
        REFERENCES dispositivos(id)
        ON DELETE RESTRICT

);


COMMENT ON TABLE sim IS
'Tarjetas SIM inventariadas individualmente mediante código ITAM e ICCID físico.';


-- ============================================================
-- 8. HISTORIAL DE EVENTOS
-- ============================================================

CREATE TABLE historial_eventos (

    id                      BIGINT GENERATED ALWAYS AS IDENTITY
                            PRIMARY KEY,

    tipo_entidad            VARCHAR(20) NOT NULL,

    dispositivo_id          BIGINT,

    sim_id                  BIGINT,

    tipo_evento             VARCHAR(80) NOT NULL,

    estado_anterior_id      BIGINT,

    estado_nuevo_id         BIGINT,

    responsable             VARCHAR(150) NOT NULL,

    observaciones           TEXT,

    detalle                 JSONB NOT NULL
                            DEFAULT '{}'::jsonb,

    fecha_evento            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_historial_tipo_entidad
        CHECK (
            tipo_entidad IN (
                'DISPOSITIVO',
                'SIM'
            )
        ),

    -- Un evento pertenece a un dispositivo
    -- O a una SIM, nunca a ambos.
    CONSTRAINT chk_historial_entidad
        CHECK (

            (
                tipo_entidad = 'DISPOSITIVO'
                AND
                dispositivo_id IS NOT NULL
                AND
                sim_id IS NULL
            )

            OR

            (
                tipo_entidad = 'SIM'
                AND
                sim_id IS NOT NULL
                AND
                dispositivo_id IS NULL
            )

        ),

    CONSTRAINT chk_historial_detalle
        CHECK (
            jsonb_typeof(detalle) = 'object'
        ),

    CONSTRAINT fk_historial_dispositivo
        FOREIGN KEY (dispositivo_id)
        REFERENCES dispositivos(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_historial_sim
        FOREIGN KEY (sim_id)
        REFERENCES sim(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_historial_estado_anterior
        FOREIGN KEY (estado_anterior_id)
        REFERENCES estados(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_historial_estado_nuevo
        FOREIGN KEY (estado_nuevo_id)
        REFERENCES estados(id)
        ON DELETE RESTRICT

);


COMMENT ON TABLE historial_eventos IS
'Historial inmutable de movimientos y cambios realizados sobre dispositivos y SIM.';


-- ============================================================
-- 9. ÍNDICES - COLABORADORES
-- ============================================================

CREATE INDEX idx_colaboradores_departamento
    ON colaboradores(departamento_id);


CREATE INDEX idx_colaboradores_nombre
    ON colaboradores(nombre);


-- ============================================================
-- 10. ÍNDICES - DISPOSITIVOS
-- ============================================================

CREATE INDEX idx_dispositivos_tipo
    ON dispositivos(tipo_dispositivo);


CREATE INDEX idx_dispositivos_estado
    ON dispositivos(estado_id);


CREATE INDEX idx_dispositivos_colaborador
    ON dispositivos(colaborador_id);


CREATE INDEX idx_dispositivos_departamento
    ON dispositivos(departamento_id);


CREATE INDEX idx_dispositivos_localidad
    ON dispositivos(localidad);


CREATE UNIQUE INDEX uq_dispositivos_numero_serie
    ON dispositivos (
        LOWER(BTRIM(numero_serie))
    )
    WHERE
        numero_serie IS NOT NULL
        AND
        BTRIM(numero_serie) <> '';


CREATE UNIQUE INDEX uq_dispositivos_imei
    ON dispositivos (
        BTRIM(imei)
    )
    WHERE
        imei IS NOT NULL
        AND
        BTRIM(imei) <> '';


-- ============================================================
-- 11. ÍNDICES - SIM
-- ============================================================

CREATE INDEX idx_sim_estado
    ON sim(estado_id);


CREATE INDEX idx_sim_colaborador
    ON sim(colaborador_id);


CREATE INDEX idx_sim_dispositivo
    ON sim(dispositivo_id);


CREATE INDEX idx_sim_numero_asociado
    ON sim(numero_asociado);


-- ============================================================
-- 12. ÍNDICES - HISTORIAL
-- ============================================================

CREATE INDEX idx_historial_dispositivo
    ON historial_eventos (
        dispositivo_id,
        fecha_evento DESC
    );


CREATE INDEX idx_historial_sim
    ON historial_eventos (
        sim_id,
        fecha_evento DESC
    );


CREATE INDEX idx_historial_fecha
    ON historial_eventos (
        fecha_evento DESC
    );


-- ============================================================
-- 13. ESTADOS INICIALES DE DISPOSITIVOS
-- ============================================================

INSERT INTO estados (
    tipo_entidad,
    codigo,
    nombre,
    descripcion,
    es_terminal
)
VALUES

(
    'DISPOSITIVO',
    'DISPONIBLE',
    'Disponible',
    'Dispositivo inventariado y disponible para asignación.',
    FALSE
),

(
    'DISPOSITIVO',
    'ASIGNADO',
    'Asignado',
    'Dispositivo entregado actualmente a un colaborador o departamento.',
    FALSE
),

(
    'DISPOSITIVO',
    'PRESTAMO_TEMPORAL',
    'Préstamo Temporal',
    'Dispositivo entregado temporalmente y pendiente de devolución.',
    FALSE
),

(
    'DISPOSITIVO',
    'SERVICIO_TECNICO',
    'Servicio Técnico',
    'Dispositivo sometido a mantenimiento, diagnóstico o reparación.',
    FALSE
),

(
    'DISPOSITIVO',
    'RETENIDO_REVISION',
    'Retenido / En Revisión',
    'Dispositivo recuperado y pendiente de revisión por TI.',
    FALSE
),

(
    'DISPOSITIVO',
    'EXTRAVIADO',
    'Extraviado',
    'Dispositivo cuyo paradero actualmente no ha sido confirmado.',
    FALSE
),

(
    'DISPOSITIVO',
    'DADO_BAJA',
    'Dado de Baja',
    'Dispositivo retirado definitivamente del inventario operativo.',
    TRUE
);


-- ============================================================
-- 14. ESTADOS INICIALES DE SIM
-- ============================================================

INSERT INTO estados (
    tipo_entidad,
    codigo,
    nombre,
    descripcion,
    es_terminal
)
VALUES

(
    'SIM',
    'DISPONIBLE',
    'Disponible',
    'SIM inventariada y disponible.',
    FALSE
),

(
    'SIM',
    'ASIGNADA',
    'Asignada',
    'SIM actualmente asociada a un colaborador y/o dispositivo.',
    FALSE
),

(
    'SIM',
    'EXTRAVIADA',
    'Extraviada',
    'SIM que no fue recuperada o cuyo paradero se desconoce.',
    FALSE
),

(
    'SIM',
    'DADA_BAJA',
    'Dada de Baja',
    'SIM retirada definitivamente de operación.',
    TRUE
);


-- ============================================================
-- 15. PROTECCIÓN DEL HISTORIAL
-- ============================================================

CREATE OR REPLACE FUNCTION fn_bloquear_modificacion_historial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    RAISE EXCEPTION
        'El historial de ITAM es inmutable. No se permite modificar ni eliminar eventos históricos.';

END;
$$;


CREATE TRIGGER trg_historial_no_update
BEFORE UPDATE
ON historial_eventos
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_modificacion_historial();


CREATE TRIGGER trg_historial_no_delete
BEFORE DELETE
ON historial_eventos
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_modificacion_historial();


-- ============================================================
-- 16. PROHIBIR BORRADO FÍSICO DE DISPOSITIVOS
-- ============================================================

CREATE OR REPLACE FUNCTION fn_bloquear_borrado_recurso()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    RAISE EXCEPTION
        'Los recursos ITAM no se eliminan físicamente. Se debe utilizar un cambio de estado.';

END;
$$;


CREATE TRIGGER trg_dispositivo_no_delete
BEFORE DELETE
ON dispositivos
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_borrado_recurso();


CREATE TRIGGER trg_sim_no_delete
BEFORE DELETE
ON sim
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_borrado_recurso();


-- ============================================================
-- 17. REGISTRO DE MIGRACIÓN
-- ============================================================

INSERT INTO schema_migrations (
    version,
    nombre
)
VALUES (
    '001',
    'initial_core'
);


COMMIT;