# Matriz de Validacion Documental

**Actualizado:** 13 de octubre de 2026
**Tipo:** matriz de validación
**Commit vigente:** `d8cd34c63293f293b0b5bf57f3219dbb8bfe7e0c`

Se comparó documentación existente con código, SQL, workflows y evidencia autorizada de health/CD. No se utilizaron secretos ni valores de credenciales.

| Tema | Documento donde aparece | Archivo real relacionado | Estado | Evidencia | Observaciones |
| --- | --- | --- | --- | --- | --- |
| Identidad del repositorio | `docs/entrega/02...`, README | `.git`, `git log`, remotes | Corregido | HEAD `d8cd34c` en `main` | La documentación anterior refería `754d036`/`d98da12`; quedó histórica |
| Objetivo y alcance de usuario | Manual anterior | `frontend/src/app/features`, rutas | Corregido | Manual 01 ampliado | Se agregaron capítulos faltantes |
| Roles | `docs/arquitectura/SEGURIDAD.md` | `auth-context.ts`, `auth.middleware.ts` | Confirmado | Tipos y middleware | Incluye `SOLO_LECTURA` |
| Permisos UI | Manual anterior | `app.routes.ts`, templates | Confirmado parcialmente | `writeGuard` y condiciones | La UI no reemplaza autorización backend |
| Solo lectura backend | Manual 01, seguridad | `rejectReadOnlyMutations` | Confirmado | Bloquea métodos de mutación | Requiere prueba con cuenta real |
| Autenticación | `docs/api/AUTH.md` | `auth.routes.ts`, `auth.service.ts` | Confirmado | Endpoints y cookie | Timeout productivo pendiente |
| Rutas frontend | `docs/arquitectura/FRONTEND.md` | `app.routes.ts` | Corregido | Se cotejaron rutas | El mapa maestro las resume |
| Endpoints API | `docs/api/*` | `backend/src/modules/*/*.routes.ts` | Corregido | Se documentaron los tres endpoints de catálogo técnico | Mantener sincronizado el contrato multipart |
| PDF OT | `docs/api/SERVICIO_TECNICO.md` | `servicio-tecnico.pdf.ts` | Corregido | `buildTechnicalOrderPdf` | Se confirmó sección `(INTERNO)` |
| PDF actas | `docs/api/ACTAS_ENTREGA.md` | `actas-entrega.service.ts` | Confirmado | Endpoint PDF | Falta smoke test productivo |
| Impresión etiqueta | No estaba completo en entrega | `asset-label.ts` | Corregido | `window.print()` y QR | Incluido en Manual 01 |
| Migraciones | `docs/database/*` | `database/migrations/*.sql` | Corregido | Existe 001–041 | Docs anteriores llegaban a 032/036 |
| Migración 029 | `docs/database/RECONCILIACION_029.md` | `029_simplify_technical_service.sql` | Confirmado parcialmente | Historial inconsistente documentado | No reejecutar automáticamente |
| Migración 036 | No estaba en entrega anterior | `036_correlative_technical_work_order_numbers.sql` | Corregido | `numero_ot`, índice único | CD actual la empaqueta |
| Migración 041 | No estaba en entrega anterior | `041_device_technical_catalog.sql` | Corregido | Metadatos de catálogo técnico y ejecución idempotente | CD `d8cd34c` exitoso |
| Catálogo técnico | Manual, API y arquitectura | `catalogo-tecnico.*`, `dispositivo-detail.ts`, `catalogos_tecnicos_dispositivo` | Corregido | PDF, firma, 10 MiB y almacenamiento persistente | Carga autenticada productiva pendiente |
| Tablas | `docs/arquitectura/BASE_DE_DATOS.md` | migraciones SQL | Confirmado parcialmente | Tablas centrales cotejadas | Aplicación productiva pendiente |
| Configuración | `docs/entrega/02...` | `backend/src/config/env.ts`, `.env.example` | Confirmado | Nombres de variables | Valores excluidos por seguridad |
| CI | `docs/ci/ci-cd.md` | `.github/workflows/ci.yml` | Confirmado | Node 24, typecheck/build | Tests backend no corren en CI |
| CD | `docs/entrega/04...` | `.github/workflows/cd.yml` | Confirmado | release, migraciones 041, PM2, health, Nginx 12 MB | No prueba restore de BD |
| Servidor | `docs/entrega/03...` | workflow, health y evidencia autorizada | Confirmado parcialmente | CD `d8cd34c`, health API/BD 200, smoke de 1,15 MB | DNS, firewall, TLS y backups pendientes |
| Seguridad | `docs/arquitectura/SEGURIDAD.md` | middleware, env, Helmet/CORS | Confirmado parcialmente | Código de seguridad | MFA, SSH, firewall pendientes |
| Arquitectura | `docs/arquitectura/*` | app, módulos, frontend | Corregido | Diagramas 07 y 08 | Incluyen PDF y despliegue |
| Duplicación manual usuario | `docs/entrega/_historico/01_manual_de_uso.md` y `01_manual_de_usuario.md` | archivos fuente | Corregido | Alias histórico actualizado | Fuente canónica es `01_manual_de_usuario.md` |
| DOCX de entrega | `salida_documentacion` | archivos entregables | Corregido | Se conserva solo el manual Word | DOCX previos deben archivarse o retirarse |
| Pruebas automáticas | `docs/ci/ci-cd.md` | scripts `npm test`, tests | Confirmado parcialmente | Backend: 113 pasan, 0 fallan; frontend sin archivos de prueba detectados | Frontend compila; `ng test --watch=false` inicia sin casos y no termina automáticamente |
| Datos productivos | `docs/entrega/*` | health productivo y CD | Confirmado parcialmente | BD reporta `itam_prod`/`itam_app`; no hubo consulta SQL directa ni carga autenticada | No marcar estructura y flujo E2E como confirmados |
