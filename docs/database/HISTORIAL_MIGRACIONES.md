# Historial de migraciones

**Actualizado:** 29 de septiembre de 2026
**Fuente:** archivos reales de `database/migrations` y estado leído de `itam_dev`
**Tipo:** referencia técnica e histórica

La tabla resume el propósito declarado por cada archivo y el estado observado. No sustituye el SQL de las migraciones.

| Migración | Propósito | Área afectada | Estado |
| --- | --- | --- | --- |
| `001_initial_core.sql` | Crear el núcleo inicial del inventario, entidades organizacionales, activos, SIM e historial. | Núcleo de datos | `APPLIED` |
| `002_integrity_rules.sql` | Reforzar estados compatibles, unicidad, recepción y timestamps mediante funciones y triggers. | Integridad | `APPLIED` |
| `003_inventory_code_families.sql` | Configurar familias de códigos, numeradores y custodia departamental. | Inventario y custodia | `APPLIED` |
| `004_inventory_code_immutability.sql` | Impedir cambios posteriores del código físico de dispositivos y SIM. | Inventario | `APPLIED` |
| `005_device_type_catalog.sql` | Crear catálogo normalizado de tipos de dispositivo y relaciones con familias. | Catálogos | `APPLIED` |
| `006_configurable_inventory_code_families.sql` | Hacer configurables las familias y proteger cambios históricos en uso. | Catálogos e integridad | `APPLIED` |
| `007_dynamic_asset_registration.sql` | Permitir alta dinámica de activos y periféricos. | Inventario | `APPLIED` |
| `008_asset_lifecycle_and_documents.sql` | Incorporar ciclo patrimonial, servicio técnico, bajas, actas y documentos. | Activos y documentos | `APPLIED` |
| `009_department_dependencies.sql` | Agregar dependencia opcional entre departamentos. | Organización | `APPLIED` — registro histórico inconsistente |
| `010_custody_returns_and_temporary_assets.sql` | Incorporar custodia técnica, equipos temporales, devoluciones y comprobantes. | Custodia y devoluciones | `APPLIED` |
| `011_backfill_worker_delivery_declaration.sql` | Completar la declaración de entrega de trabajadores en actas existentes. | Actas | `APPLIED` |
| `012_reconcile_department_dependency_migration.sql` | Reconciliar y asegurar el registro asociado a la migración de dependencias departamentales. | Organización y metadatos de migración | `APPLIED` |
| `013_organization_acquisition_auth_and_audit.sql` | Incorporar organización, adquisición, autenticación, sesiones y auditoría. | Organización y seguridad | `APPLIED` |
| `014_force_initial_password_change.sql` | Agregar control de cambio obligatorio de clave inicial. | Autenticación | `APPLIED` |
| `015_invoice_document_storage.sql` | Agregar metadatos del documento principal de factura. | Adquisiciones y documentos | `APPLIED` |
| `016_organization_source_code.sql` | Agregar identificador estable de la fuente organizacional. | Organización | `APPLIED` |
| `017_user_pin_auth.sql` | Agregar autenticación rápida mediante PIN protegido por hash. | Autenticación | `APPLIED` |
| `018_session_idle_timeout.sql` | Consultar la existencia de `ultima_actividad` en sesiones. | Sesiones | `HISTORICAL CHECK` |
| `019_printer_inventory_family.sql` | Crear la familia independiente de impresoras y sus tipos asociados. | Catálogos e inventario | `APPLIED` |
| `020_sim_iccid_nullable.sql` | Permitir ICCID de SIM nulo bajo las condiciones definidas por el SQL. | SIM | `APPLIED` |
| `021_logical_cancellation_device_disposals.sql` | Incorporar anulación lógica de bajas y sus índices de control. | Bajas de dispositivos | `APPLIED` |
| `022_offboarding_processes.sql` | Crear procesos explícitos de offboarding y sus restricciones. | Offboarding | `APPLIED` |
| `023_canonical_collaborator_rut.sql` | Normalizar el RUT canónico y conciliar registros de colaboradores. | Colaboradores | `APPLIED` |
| `024_temporal_device_custody.sql` | Crear custodias temporales de dispositivos y controles de vigencia. | Custodia | `APPLIED` |
| `025_physical_device_verifications.sql` | Crear verificaciones físicas basadas en evidencia operacional. | Inventario físico | `APPLIED` |
| `026_configurable_stock_alerts.sql` | Crear configuraciones de alertas de stock por tipo de dispositivo. | Stock | `APPLIED` |
| `027_default_priority_stock_alerts.sql` | Configurar prioridades iniciales para alertas de stock. | Stock | `APPLIED` |
| `028_mobile_lines.sql` | Separar formalmente líneas móviles, SIM físicas y smartphones. | Telefonía móvil | `APPLIED` |
| `029_simplify_technical_service.sql` | Simplificar y ampliar el flujo de órdenes de servicio técnico. | Servicio técnico | `OUT_OF_SEQUENCE` |
| `030_technical_service_work_order_review.sql` | Agregar datos editables de la orden de trabajo técnica. | Servicio técnico | `APPLIED` |
| `031_technical_service_return_fields.sql` | Agregar campos de cierre, retorno y observaciones de servicio técnico. | Servicio técnico | `APPLIED` |
| `032_technical_service_quotes.sql` | Agregar metadatos y versiones de archivos de cotización. | Servicio técnico | `APPLIED` |

## Lectura del historial

`APPLIED` indica que la versión aparece registrada en `itam.schema_migrations`. `OUT_OF_SEQUENCE` indica que la versión no aparece aplicada aunque existen versiones posteriores registradas. `HISTORICAL CHECK` identifica un archivo que funciona como verificación histórica y no como cambio estructural convencional.

El historial no tiene checksums. Por lo tanto, para las versiones aplicadas no es posible demostrar automáticamente que el contenido actual del archivo sea idéntico al SQL que se ejecutó originalmente.
