-- ============================================================
-- ITAM v3.0 - Aguas San Isidro
-- Migracion 015 - Documento principal de factura de adquisicion
-- El archivo se almacena fuera de PostgreSQL; estos campos guardan metadata.
-- ============================================================

BEGIN;

SET search_path TO itam, public;

ALTER TABLE facturas_adquisicion
    ADD COLUMN documento_nombre_original VARCHAR(255),
    ADD COLUMN documento_nombre_almacenado VARCHAR(100),
    ADD COLUMN documento_mime_type VARCHAR(100),
    ADD COLUMN documento_tamano_bytes BIGINT,
    ADD COLUMN documento_ruta VARCHAR(300),
    ADD CONSTRAINT chk_factura_documento_metadata
        CHECK (
            (
                documento_nombre_original IS NULL
                AND documento_nombre_almacenado IS NULL
                AND documento_mime_type IS NULL
                AND documento_tamano_bytes IS NULL
                AND documento_ruta IS NULL
            )
            OR
            (
                documento_nombre_original IS NOT NULL
                AND documento_nombre_almacenado IS NOT NULL
                AND documento_mime_type IN (
                    'application/pdf',
                    'image/jpeg',
                    'image/png'
                )
                AND documento_tamano_bytes BETWEEN 1 AND 10485760
                AND documento_ruta IS NOT NULL
            )
        );

INSERT INTO schema_migrations (version, nombre)
VALUES ('015', 'invoice_document_storage');

COMMIT;
