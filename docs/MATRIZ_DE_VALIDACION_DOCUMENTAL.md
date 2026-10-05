# Matriz de Validacion Documental

Fecha: 2026-10-05. Se comparó documentación existente con código, SQL, workflows y archivos del repositorio. No se utilizaron secretos ni valores de credenciales.

| Tema | Documento donde aparece | Archivo real relacionado | Estado | Evidencia | Observaciones |
| --- | --- | --- | --- | --- | --- |
| Identidad del repositorio | `docs/entrega/02...`, README | `.git`, `git log`, remotes | Corregido | HEAD `754d036` en `main` | La documentación anterior refería `d98da12`; quedó histórica |
| Objetivo y alcance de usuario | Manual anterior | `frontend/src/app/features`, rutas | Corregido | Manual 01 ampliado | Se agregaron capítulos faltantes |
| Roles | `docs/arquitectura/SEGURIDAD.md` | `auth-context.ts`, `auth.middleware.ts` | Confirmado | Tipos y middleware | Incluye `SOLO_LECTURA` |
| Permisos UI | Manual anterior | `app.routes.ts`, templates | Confirmado parcialmente | `writeGuard` y condiciones | La UI no reemplaza autorización backend |
| Solo lectura backend | Manual 01, seguridad | `rejectReadOnlyMutations` | Confirmado | Bloquea métodos de mutación | Requiere prueba con cuenta real |
| Autenticación | `docs/api/AUTH.md` | `auth.routes.ts`, `auth.service.ts` | Confirmado | Endpoints y cookie | Timeout productivo pendiente |
| Rutas frontend | `docs/arquitectura/FRONTEND.md` | `app.routes.ts` | Corregido | Se cotejaron rutas | El mapa maestro las resume |
| Endpoints API | `docs/api/*` | `backend/src/modules/*/*.routes.ts` | Confirmado parcialmente | Routers actuales | Revisar documentación de cada payload en futuras iteraciones |
| PDF OT | `docs/api/SERVICIO_TECNICO.md` | `servicio-tecnico.pdf.ts` | Corregido | `buildTechnicalOrderPdf` | Se confirmó sección `(INTERNO)` |
| PDF actas | `docs/api/ACTAS_ENTREGA.md` | `actas-entrega.service.ts` | Confirmado | Endpoint PDF | Falta smoke test productivo |
| Impresión etiqueta | No estaba completo en entrega | `asset-label.ts` | Corregido | `window.print()` y QR | Incluido en Manual 01 |
| Migraciones | `docs/database/*` | `database/migrations/*.sql` | Corregido | Existe 001–036 | Docs anteriores llegaban a 032 |
| Migración 029 | `docs/database/RECONCILIACION_029.md` | `029_simplify_technical_service.sql` | Confirmado parcialmente | Historial inconsistente documentado | No reejecutar automáticamente |
| Migración 036 | No estaba en entrega anterior | `036_correlative_technical_work_order_numbers.sql` | Corregido | `numero_ot`, índice único | CD actual la empaqueta |
| Tablas | `docs/arquitectura/BASE_DE_DATOS.md` | migraciones SQL | Confirmado parcialmente | Tablas centrales cotejadas | Aplicación productiva pendiente |
| Configuración | `docs/entrega/02...` | `backend/src/config/env.ts`, `.env.example` | Confirmado | Nombres de variables | Valores excluidos por seguridad |
| CI | `docs/ci/CI.md` | `.github/workflows/ci.yml` | Confirmado | Node 24, typecheck/build | Tests backend no corren en CI |
| CD | `docs/entrega/04...` | `.github/workflows/cd.yml` | Confirmado | release, migration, PM2, health, Nginx | No prueba restore de BD |
| Servidor | `docs/entrega/03...` | workflow y evidencia autorizada | Confirmado parcialmente | IP, hostname, release histórico | DNS, firewall, TLS y backups pendientes |
| Seguridad | `docs/arquitectura/SEGURIDAD.md` | middleware, env, Helmet/CORS | Confirmado parcialmente | Código de seguridad | MFA, SSH, firewall pendientes |
| Arquitectura | `docs/arquitectura/*` | app, módulos, frontend | Corregido | Diagramas 07 y 08 | Incluyen PDF y despliegue |
| Duplicación manual usuario | `docs/entrega/01_manual_de_uso.md` y `01_manual_de_usuario.md` | archivos fuente | Corregido | Alias histórico actualizado | Fuente canónica es `01_manual_de_usuario.md` |
| DOCX de entrega | `salida_documentacion` | archivos entregables | Corregido | Se conserva solo el manual Word | DOCX previos deben archivarse o retirarse |
| Pruebas automáticas | `docs/ci/CI.md` | scripts `npm test`, tests | Confirmado parcialmente | Backend: 113 pasan, 0 fallan; frontend sin archivos de prueba detectados | Frontend compila; `ng test --watch=false` inicia sin casos y no termina automáticamente |
| Datos productivos | `docs/entrega/*` | servidor/BD | Pendiente de validar | No se accedió a credenciales | No marcar como confirmado |
