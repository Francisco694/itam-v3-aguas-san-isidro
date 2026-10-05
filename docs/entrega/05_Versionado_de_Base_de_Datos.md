# Versionado de Base de Datos

## Fuente de verdad

La fuente de cambios es `database/migrations/`. La tabla `itam.schema_migrations` registra `version`, `nombre` y `aplicado_en`, pero no contiene checksum. La presencia de un archivo SQL no demuestra por sí sola que haya sido aplicado en producción.

## Orden y estado verificable

| Tramo | Archivos presentes | Estado documental |
| --- | --- | --- |
| 001–008 | Núcleo, integridad, catálogos, activos y documentos | Confirmado en repositorio; aplicación productiva pendiente |
| 009–016 | Dependencias, custodia, organización, adquisición y auditoría | Confirmado en repositorio; 009 tiene antecedente de secuencia inconsistente |
| 017–024 | PIN, sesiones, impresoras, SIM, bajas, offboarding y custodia temporal | Confirmado en repositorio |
| 025–028 | Verificación física, alertas, prioridades y líneas móviles | Confirmado en repositorio |
| 029 | `simplify_technical_service` | Obsoleto como paso de actualización si quedó fuera de secuencia; no se reejecuta automáticamente |
| 030–032 | Orden técnica, retorno y cotizaciones | Confirmado en repositorio |
| 033 | Reconciliación del esquema de servicio técnico | Confirmado en repositorio |
| 034 | Actividad de sesión e índice para timeout | Confirmado en repositorio |
| 035 | Rol `SOLO_LECTURA` | Confirmado en repositorio |
| 036 | Correlatividad `numero_ot` | Confirmado en repositorio y empaquetado por el CD actual |
| 023N | Instalación limpia alternativa de RUT canónico | No es una versión lineal adicional; usar solo según su propósito documentado |

## Inventario de migraciones

| Versión | Archivo | Cambio principal |
| --- | --- | --- |
| 001 | `001_initial_core.sql` | Núcleo, organización, dispositivos, SIM, estados, historial y `schema_migrations` |
| 002 | `002_integrity_rules.sql` | Restricciones, triggers e integridad |
| 003 | `003_inventory_code_families.sql` | Familias y numeradores de códigos |
| 004 | `004_inventory_code_immutability.sql` | Inmutabilidad de códigos |
| 005 | `005_device_type_catalog.sql` | Catálogo de tipos |
| 006 | `006_configurable_inventory_code_families.sql` | Configuración de familias |
| 007 | `007_dynamic_asset_registration.sql` | Registro dinámico de activos |
| 008 | `008_asset_lifecycle_and_documents.sql` | Servicio técnico, bajas, actas y documentos |
| 009 | `009_department_dependencies.sql` | Dependencias departamentales |
| 010 | `010_custody_returns_and_temporary_assets.sql` | Custodia, devoluciones y temporales |
| 011 | `011_backfill_worker_delivery_declaration.sql` | Backfill de entrega de trabajador |
| 012 | `012_reconcile_department_dependency_migration.sql` | Reconciliación de metadatos |
| 013 | `013_organization_acquisition_auth_and_audit.sql` | Organización, compras, usuarios, sesiones y auditoría |
| 014 | `014_force_initial_password_change.sql` | Cambio de contraseña inicial |
| 015 | `015_invoice_document_storage.sql` | Documentos de factura |
| 016 | `016_organization_source_code.sql` | Código de fuente organizacional |
| 017 | `017_user_pin_auth.sql` | Autenticación PIN |
| 018 | `018_session_idle_timeout.sql` | Antecedente de timeout de sesión |
| 019 | `019_printer_inventory_family.sql` | Familia de impresoras |
| 020 | `020_sim_iccid_nullable.sql` | ICCID nullable bajo reglas |
| 021 | `021_logical_cancellation_device_disposals.sql` | Anulación lógica de bajas |
| 022 | `022_offboarding_processes.sql` | Offboarding |
| 023 | `023_canonical_collaborator_rut.sql` | RUT canónico |
| 024 | `024_temporal_device_custody.sql` | Custodia temporal |
| 025 | `025_physical_device_verifications.sql` | Verificación física |
| 026 | `026_configurable_stock_alerts.sql` | Alertas configurables |
| 027 | `027_default_priority_stock_alerts.sql` | Prioridades iniciales |
| 028 | `028_mobile_lines.sql` | Líneas móviles |
| 029 | `029_simplify_technical_service.sql` | Simplificación histórica de servicio técnico |
| 030 | `030_technical_service_work_order_review.sql` | Campos de revisión OT |
| 031 | `031_technical_service_return_fields.sql` | Retorno y cierre OT |
| 032 | `032_technical_service_quotes.sql` | Cotizaciones y archivos |
| 033 | `033_reconcile_technical_service_schema.sql` | Reconciliación 029–032 |
| 034 | `034_session_activity_and_proxy_ready.sql` | `ultima_actividad` e índice parcial |
| 035 | `035_read_only_user_role.sql` | Rol `SOLO_LECTURA` |
| 036 | `036_correlative_technical_work_order_numbers.sql` | `numero_ot`, restricción positiva e índice único |

## Tablas y relaciones principales

Las migraciones crean o modifican, entre otras, `departamentos`, `colaboradores`, `usuarios`, `sesiones_usuario`, `auditoria_operaciones`, `estados`, `tipos_dispositivo`, `familias_codigo_inventario`, `dispositivos`, `sim`, `lineas_moviles`, `historial_eventos`, `ordenes_servicio_tecnico`, `entregas_temporales_servicio`, `actas_entrega`, `actas_entrega_detalle`, `comprobantes_devolucion`, `offboarding`, `verificaciones_fisicas`, `alertas_stock`, `facturas_adquisicion` y `servicio_tecnico_cotizaciones_archivos`.

Las relaciones críticas son dispositivo–estado, dispositivo–colaborador o departamento, SIM–dispositivo, línea–dispositivo, orden técnica–dispositivo, cotización–orden técnica, acta–detalle–dispositivo y sesión–usuario. Las restricciones de unicidad, checks, claves foráneas e índices deben consultarse en el SQL correspondiente antes de modificar una regla.

## Compatibilidad con el código

- `backend/src/modules/servicio-tecnico/` consume `numero_ot`, campos de retorno, cotización y temporales.
- `backend/src/shared/auth-context.ts` y `auth.middleware.ts` consumen `SOLO_LECTURA`.
- `backend/src/config/env.ts` y `auth.middleware.ts` consumen sesiones y actividad.
- Los módulos de dispositivos, SIM, colaboradores, actas y offboarding dependen de las relaciones creadas en las migraciones iniciales y posteriores.

## Rollback y diferencias de entorno

Las migraciones no incluyen un mecanismo general de rollback automático. El CD aplica 036 con `psql --set=ON_ERROR_STOP=1`, pero no ejecuta restauración de datos. Desarrollo puede instalar desde cero con los archivos SQL; producción debe verificar `schema_migrations`, estructura y datos antes de aplicar. La versión realmente aplicada en producción queda **Pendiente de validar en servidor** mientras no exista consulta autorizada.
