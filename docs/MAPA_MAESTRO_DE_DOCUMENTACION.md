# Mapa Maestro de Documentacion

Fecha de auditoría: 2026-10-05. Fuente de código: commit `754d036f00aa24b180c3812c460a2b18bd82b1a5`.

| Funcionalidad | Frontend | Backend | Endpoint principal | Tablas involucradas | Migraciones | Documento | Estado | Pendientes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Autenticación y sesión | `login`, `mi-acceso`, guards | `auth` | `/auth/login`, `/auth/me`, `/auth/logout` | `usuarios`, `sesiones_usuario`, `auditoria_operaciones` | 013, 014, 017, 018, 034 | 01, 02, 08, `docs/api/AUTH.md` | Confirmado | Validar timeout productivo |
| Usuarios | `usuarios` | `usuarios` | `/usuarios` | `usuarios`, `auditoria_operaciones` | 013, 035 | 01, 02, 05 | Confirmado | Smoke test con roles reales |
| Colaboradores | `colaboradores` | `colaboradores` | `/colaboradores` | `colaboradores`, `departamentos`, `dispositivos` | 001, 013, 023 | 01, 02, `docs/api/COLABORADORES.md` | Confirmado | Validar datos productivos |
| Departamentos | `departamentos` | `departamentos` | `/departamentos` | `departamentos`, `colaboradores`, `dispositivos` | 001, 009, 012 | 01, 02, `docs/api/DEPARTAMENTOS.md` | Confirmado | Confirmar dependencias productivas |
| Dispositivos e inventario | `dispositivos` | `dispositivos` | `/dispositivos` | `dispositivos`, `estados`, `tipos_dispositivo`, `historial_eventos` | 001–008, 019, 021, 025 | 01, 02, 08, `docs/api/DISPOSITIVOS.md` | Confirmado | Prueba de conciliación productiva |
| Códigos de inventario | `familias-codigo` | `inventory-codes` | `/familias-codigo` | `familias_codigo_inventario`, `tipos_dispositivo`, `dispositivos` | 003–007, 019 | 02, 05 | Confirmado | Revisar catálogo real |
| Estados y tipos | `estados`, `tipos-dispositivo` | `estados`, `tipos-dispositivo` | `/estados`, `/tipos-dispositivo` | `estados`, `tipos_dispositivo` | 001, 005–007 | 01, 02, 05 | Confirmado | Ninguno identificado |
| SIM | `sim` | `sim` | `/sim` | `sim`, `dispositivos`, `historial_eventos` | 001, 020 | 01, 02, `docs/api/SIM_LINEAS.md` | Confirmado | Validar ICCID productivo |
| Líneas telefónicas | componente de dispositivos/SIM | `lineas-moviles` | `/sim/:codigo/*` y asociación de dispositivo | `lineas_moviles`, `sim`, `dispositivos` | 028 | 01, 02, 05 | Confirmado | Confirmar datos de compañía |
| Asignaciones | detalle de dispositivo y colaboradores | `dispositivos`, `colaboradores` | `/dispositivos/:codigo/asignar-*` | `dispositivos`, `colaboradores`, `departamentos`, `historial_eventos` | 001, 003, 010 | 01, 04 | Confirmado | Validar casos reales |
| Recepción y devoluciones | detalle de dispositivo, actas | `dispositivos`, `comprobantes` | `/dispositivos/:codigo/devolver`, `/comprobantes-devolucion` | `dispositivos`, `comprobantes_devolucion`, `historial_eventos` | 008, 010 | 01, 04, `docs/api/ACTAS_ENTREGA.md` | Confirmado | Prueba de impresión |
| Actas | `actas` | `actas-entrega` | `/actas-entrega`, `/actas-entrega/:id/pdf` | `actas_entrega`, `actas_entrega_detalle`, `secuencias_acta_entrega` | 008, 011 | 01, 02, `docs/api/ACTAS_ENTREGA.md` | Confirmado | Validar PDF con datos reales |
| Servicio técnico | `servicio-tecnico` | `servicio-tecnico` | `/servicio-tecnico` | `ordenes_servicio_tecnico`, temporales, cotizaciones, `dispositivos` | 008, 010, 029–036 | 01, 02, 04, 05, `docs/api/SERVICIO_TECNICO.md` | Corregido | Ejecutar fixtures PDF |
| Órdenes de trabajo PDF | vista previa y descarga | `servicio-tecnico.pdf.ts` | `/servicio-tecnico/:id/envio/pdf` | `ordenes_servicio_tecnico`, `dispositivos` | 030, 031, 036 | 01, 02, 04 | Confirmado | Comparar salida visual contra ST-163 |
| Offboarding | `offboarding` | `offboarding` | `/offboarding` | `offboarding`, `dispositivos`, `colaboradores` | 022 | 01, 04, `docs/api/OFFBOARDING.md` | Confirmado | Smoke test productivo |
| Reportes | `reportes` | `reportes` | `/reportes/inventario`, `/reportes/inventario/pdf` | `dispositivos`, estados, tipos y custodias | 001–008 | 01, 02, 08, `docs/api/DASHBOARD.md` | Confirmado | Revisar impresión |
| Configuración | variables de entorno y catálogos | `config/env`, catálogos | health y catálogos | N/A y tablas de catálogo | 001–007 | 02, 03, 05 | Parcial | Validar valores productivos |
| Auditoría | sin pantalla independiente confirmada | `auditMutations`, historial | implícita en mutaciones | `auditoria_operaciones`, `historial_eventos` | 001, 013 | 02, 08 | Confirmado parcialmente | Definir consulta operativa |
| Despliegue y recuperación | N/A | GitHub Actions, PM2, Nginx | health loopback | `schema_migrations` en BD | CD actual aplica 036 | 03, 04, 07, 08 | Confirmado en código | Validar servidor, backups y rollback |

## Regla de lectura

`Confirmado` significa que existe evidencia directa en código, SQL o workflow. `Confirmado parcialmente` significa que la implementación está documentada pero falta validar el entorno real. `Pendiente de validar` se conserva cuando la evidencia productiva no está disponible. Los documentos 01–08 son la entrega resumida; `docs/api`, `docs/arquitectura`, `docs/database` y `docs/diagramas` son documentación técnica de respaldo.
