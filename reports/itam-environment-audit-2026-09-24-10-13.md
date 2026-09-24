# Auditoria automatizada integral ITAM

Generado: 2026-09-24T13:15:31.890Z
Proyecto: E:/Aguas San Isidro V2/ITAM

## 1. Resumen ejecutivo

Estado general: **NO APTO: existen hallazgos CRITICAL/HIGH.**

| Severidad | Cantidad |
| --- | ---: |
| CRITICAL | 0 |
| HIGH | 3 |
| MEDIUM | 1 |
| LOW | 3 |
| INFO | 8 |
| OK | 76 |

## 2. Hallazgos bloqueantes reales

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| NPM_AUDIT_BACKEND_RUNTIME_HIGH | HIGH | npm audit encontro vulnerabilidades de runtime en backend. | critical=0; high=1; moderate=1; low=0 | Revisar dependencias que llegan a produccion y actualizar sin ejecutar npm audit fix desde el auditor. |
| DB_MIGRATIONS_PENDING | HIGH | Migracion fuera de secuencia detectada. Hay migraciones inferiores pendientes y migraciones superiores aplicadas. | pendientes=029_simplify_technical_service.sql<br>ultima_aplicada=032 technical_service_quotes<br>versiones_posteriores_aplicadas=030, 031, 032 | Revisar y aplicar migraciones pendientes mediante el flujo oficial, no desde el auditor. |
| CODE_FRONTEND_BUILD_FAILED | HIGH | frontend npm run build fallo. | > frontend@0.0.0 build<br>> ng build<br>❯ Building...<br>✔ Building...<br>Initial chunk files \| Names                  \|  Raw size \| Estimated transfer size<br>main-E7MNBRSX.js    \| main                   \| 352.77 kB \|                43.51 kB<br>chunk-m8Qjw6aX.js   \| -                      \| 184.62 kB \|                54.31 kB<br>styles-AALPSMGD.css \| styles                 \|  14.07 kB \|                 3.19 kB<br>                    \| Initial total          \| 551.47 kB \|               101.01 kB<br>Lazy chunk files    \| Names                  \|  Raw size \| Estimated transfer size<br>chunk-CxgUR9Oo2.js  \| dispositivos-list      \| 536.37 kB \|               104.62 kB<br>chunk-CCKfI93n.js   \| dispositivo-detail     \|  88.47 kB \|                18.88 kB<br>chunk-C6XmHlrp2.js  \| dashboard              \|  69.52 kB \|                12.99 kB<br>chunk-BsQTKqhp.js   \| -                      \|  54.50 kB \|                10.95 kB<br>chunk-jNzO7g2j2.js  \| offboarding-page       \|  43.12 kB \|                 8.83 kB<br>chunk-BtHAz0l5.js   \| servicio-tecnico       \|  38.86 kB \|                 8.65 kB<br>chunk-BAvxRvwm.js   \| dispositivo-form       \|  28.44 kB \|                 7.86 kB<br>chunk-tewWG_oG.js   \| -                      \|  24.98 kB \| ... [truncado] | Corregir errores de build/typecheck/test antes de promover cambios. |

## 3. Advertencias

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| GIT_DIRTY | INFO | El arbol de trabajo tiene cambios locales. |  M backend/src/modules/departamentos/departamentos.service.ts<br> M backend/src/modules/departamentos/departamentos.types.ts<br> M docs/PRODUCTION_CHECKLIST.md<br> M docs/api/ITAM_API_MVP.md<br> M docs/api/ITAM_CODES_AND_LABELS.md<br> M docs/bitacoras/bitacora-2026-08-24-a-2026-09-22.md<br> M frontend/src/app/core/models/itam.models.ts<br> M frontend/src/app/features/dashboard/dashboard.scss<br> M frontend/src/app/features/dashboard/dashboard.spec.ts<br> M frontend/src/app/features/dashboard/dashboard.ts<br> M frontend/src/app/features/departamentos/departamento-detail.ts<br> M scripts/itam-environment-audit.mjs<br>?? backend/src/modules/departamentos/departamentos.service.test.ts<br>?? docs/README.md<br>?? docs/api/ACTAS_ENTREGA.md<br>?? docs/api/AUTH.md<br>?? docs/api/COLABORADORES.md<br>?? docs/api/DASHBOARD.md<br>?? docs/api/DEPARTAMENTOS.md<br>?? docs/api/DISPOSITIVOS.md<br>?? docs/api/ERRORES_HTTP.md<br>?? docs/api/OFFBOARDING.md<br>?? docs/api/README.md<br>?? docs/api/SERVICIO_TECNICO.md<br>?? docs/api/SIM_LINEAS.md<br>?? docs/arquitectura/ARQUITECTURA_GENERAL.md<br>?? docs/arquitectura/BACKEND.md<br>?? docs/arquitectura/BASE_DE_DATOS.md<br>?? docs/arquitectura/DECISIONES_TECNICAS.md<br>?? docs/arquitectura/FRONTEND.md<br>?? docs/arquitectura/README.md<br>?? docs/ar... [truncado] | Revisar que los cambios esperados sean los unicos antes de commitear. |
| NODE_ENV_DEVELOPMENT | LOW | NODE_ENV esta en development. | NODE_ENV=development | Usar NODE_ENV=production para despliegues productivos. |
| CORS_ORIGIN_DEFAULT | INFO | CORS_ORIGIN no esta definido; el backend usara su valor por defecto. | Sin CORS_ORIGIN en backend/.env | Definir CORS_ORIGIN explicitamente por entorno. |
| JWT_SECRET_NOT_REQUIRED | INFO | JWT_SECRET no es requerido por la implementacion actual. | No se encontraron referencias reales en backend/src. | No exigir esta variable mientras la implementacion no la utilice. |
| SESSION_SECRET_NOT_REQUIRED | INFO | SESSION_SECRET no es requerido por la implementacion actual. | No se encontraron referencias reales en backend/src. | No exigir esta variable mientras la implementacion no la utilice. |
| NPM_OUTDATED_BACKEND | LOW | Hay dependencias obsoletas en backend. | @types/node, @types/pg, dotenv, multer, pdfkit, tsx | Evaluar actualizaciones compatibles y probar build/test despues. |
| NPM_AUDIT_FRONTEND_DEVELOPMENT_WARN | MEDIUM | npm audit encontro vulnerabilidades en tooling de desarrollo de frontend; no se presentan como runtime. | critical=0; high=1; moderate=4; low=0 | Actualizar tooling de desarrollo y confirmar que no se incluya en el artefacto de produccion. |
| NPM_OUTDATED_FRONTEND | LOW | Hay dependencias obsoletas en frontend. | @angular/build, @angular/cli, @angular/common, @angular/compiler, @angular/compiler-cli, @angular/core, @angular/forms, @angular/platform-browser, @angular/router, @lucide/angular, jsdom, prettier, typescript, vitest | Evaluar actualizaciones compatibles y probar build/test despues. |
| TRACE_EVENT_LINEA_CONSERVADA_POR_REPOSICION_MISSING | INFO | No existen eventos registrados de tipo LINEA_CONSERVADA_POR_REPOSICION; no implica error por si solo. | cantidad=0 | Investigar solo si existe evidencia de que el proceso ocurrio y no se registro su historial. |
| OPS_LOST_DEVICE_ACTIVE_CUSTODY | INFO | Un equipo EXTRAVIADO conserva un responsable conocido; puede representar custodia activa o ultimo responsable historico. | cantidad=1<br>[<br>  {<br>    "id": "297",<br>    "codigo_inventario": 1283,<br>    "codigo": "EXTRAVIADO",<br>    "colaborador_id": "165",<br>    "departamento_id": null<br>  }<br>] | Confirmar la semantica de colaborador_id/departamento_id antes de clasificarlo como inconsistencia; no modificarlo automaticamente. |
| VISUAL_DISABLED | INFO | Auditoria visual omitida porque AUDIT_SCREENSHOTS no esta configurado como true. | Definir AUDIT_SCREENSHOTS=true para habilitar capturas. |  |
| CODE_FRONTEND_TYPECHECK_MISSING | INFO | frontend no define script typecheck. | script ausente | Agregar el script si el proyecto requiere esta validacion. |

## 4. Base de datos

### Hallazgos

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| DB_MIGRATIONS_PENDING | HIGH | Migracion fuera de secuencia detectada. Hay migraciones inferiores pendientes y migraciones superiores aplicadas. | pendientes=029_simplify_technical_service.sql<br>ultima_aplicada=032 technical_service_quotes<br>versiones_posteriores_aplicadas=030, 031, 032 | Revisar y aplicar migraciones pendientes mediante el flujo oficial, no desde el auditor. |

### Checks OK

| Area | Check | Evidencia |
| --- | --- | --- |
| Base de datos | Conexion PostgreSQL exitosa | {<br>  "database_time": "2026-09-24T13:13:17.656Z",<br>  "database": "itam_dev",<br>  "user": "itam_app"<br>} |
| Base de datos | Schema itam existe | itam |
| Base de datos | Tabla schema_migrations existe | itam.schema_migrations |
| Base de datos | Ultima migracion aplicada detectada | 032 technical_service_quotes Wed Sep 16 2026 16:25:58 GMT-0300 (hora de verano de Chile) |
| Base de datos | Tabla critica presente: colaboradores | itam.colaboradores |
| Base de datos | Tabla critica presente: departamentos | itam.departamentos |
| Base de datos | Tabla critica presente: dispositivos | itam.dispositivos |
| Base de datos | Tabla critica presente: sim | itam.sim |
| Base de datos | Tabla critica presente: estados | itam.estados |
| Base de datos | Tabla critica presente: historial_eventos | itam.historial_eventos |
| Base de datos | Tabla critica presente: lineas_moviles | itam.lineas_moviles |
| Base de datos | Tabla critica presente: actas_entrega | itam.actas_entrega |
| Base de datos | Tabla critica presente: comprobantes_devolucion | itam.comprobantes_devolucion |
| Base de datos | Columna critica presente: sim.linea_movil_id |  |
| Base de datos | Columna critica presente: lineas_moviles.numero_telefonico |  |
| Base de datos | Columna critica presente: lineas_moviles.dispositivo_id |  |
| Base de datos | Columna critica presente: lineas_moviles.sim_id |  |
| Base de datos | Columna critica presente: lineas_moviles.colaborador_id |  |
| Base de datos | Codigos ITAM duplicados en dispositivos. | cantidad=0 |
| Base de datos | Codigos ITAM duplicados en SIM. | cantidad=0 |
| Base de datos | Codigos ITAM repetidos entre dispositivos y SIM. | cantidad=0 |
| Base de datos | IMEI duplicados en dispositivos. | cantidad=0 |
| Base de datos | Numeros telefonicos duplicados en lineas_moviles. | cantidad=0 |
| Base de datos | Dispositivos con colaborador_id y departamento_id al mismo tiempo. | cantidad=0 |
| Base de datos | SIM asociadas a dispositivos inexistentes. | cantidad=0 |
| Base de datos | Lineas moviles asociadas a dispositivos inexistentes. | cantidad=0 |
| Base de datos | Lineas moviles asociadas a SIM inexistente. | cantidad=0 |
| Base de datos | Dispositivos sin estado valido. | cantidad=0 |
| Base de datos | SIM sin estado valido. | cantidad=0 |
| Base de datos | Colaboradores sin RUT. | cantidad=0 |
| Base de datos | historial_eventos sin tipo_evento. | cantidad=0 |
| Base de datos | historial_eventos sin entidad o referencia. | cantidad=0 |

## 5. Seguridad

### Hallazgos

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| GIT_DIRTY | INFO | El arbol de trabajo tiene cambios locales. |  M backend/src/modules/departamentos/departamentos.service.ts<br> M backend/src/modules/departamentos/departamentos.types.ts<br> M docs/PRODUCTION_CHECKLIST.md<br> M docs/api/ITAM_API_MVP.md<br> M docs/api/ITAM_CODES_AND_LABELS.md<br> M docs/bitacoras/bitacora-2026-08-24-a-2026-09-22.md<br> M frontend/src/app/core/models/itam.models.ts<br> M frontend/src/app/features/dashboard/dashboard.scss<br> M frontend/src/app/features/dashboard/dashboard.spec.ts<br> M frontend/src/app/features/dashboard/dashboard.ts<br> M frontend/src/app/features/departamentos/departamento-detail.ts<br> M scripts/itam-environment-audit.mjs<br>?? backend/src/modules/departamentos/departamentos.service.test.ts<br>?? docs/README.md<br>?? docs/api/ACTAS_ENTREGA.md<br>?? docs/api/AUTH.md<br>?? docs/api/COLABORADORES.md<br>?? docs/api/DASHBOARD.md<br>?? docs/api/DEPARTAMENTOS.md<br>?? docs/api/DISPOSITIVOS.md<br>?? docs/api/ERRORES_HTTP.md<br>?? docs/api/OFFBOARDING.md<br>?? docs/api/README.md<br>?? docs/api/SERVICIO_TECNICO.md<br>?? docs/api/SIM_LINEAS.md<br>?? docs/arquitectura/ARQUITECTURA_GENERAL.md<br>?? docs/arquitectura/BACKEND.md<br>?? docs/arquitectura/BASE_DE_DATOS.md<br>?? docs/arquitectura/DECISIONES_TECNICAS.md<br>?? docs/arquitectura/FRONTEND.md<br>?? docs/arquitectura/README.md<br>?? docs/ar... [truncado] | Revisar que los cambios esperados sean los unicos antes de commitear. |
| NODE_ENV_DEVELOPMENT | LOW | NODE_ENV esta en development. | NODE_ENV=development | Usar NODE_ENV=production para despliegues productivos. |
| CORS_ORIGIN_DEFAULT | INFO | CORS_ORIGIN no esta definido; el backend usara su valor por defecto. | Sin CORS_ORIGIN en backend/.env | Definir CORS_ORIGIN explicitamente por entorno. |
| JWT_SECRET_NOT_REQUIRED | INFO | JWT_SECRET no es requerido por la implementacion actual. | No se encontraron referencias reales en backend/src. | No exigir esta variable mientras la implementacion no la utilice. |
| SESSION_SECRET_NOT_REQUIRED | INFO | SESSION_SECRET no es requerido por la implementacion actual. | No se encontraron referencias reales en backend/src. | No exigir esta variable mientras la implementacion no la utilice. |
| NPM_AUDIT_BACKEND_RUNTIME_HIGH | HIGH | npm audit encontro vulnerabilidades de runtime en backend. | critical=0; high=1; moderate=1; low=0 | Revisar dependencias que llegan a produccion y actualizar sin ejecutar npm audit fix desde el auditor. |
| NPM_OUTDATED_BACKEND | LOW | Hay dependencias obsoletas en backend. | @types/node, @types/pg, dotenv, multer, pdfkit, tsx | Evaluar actualizaciones compatibles y probar build/test despues. |
| NPM_AUDIT_FRONTEND_DEVELOPMENT_WARN | MEDIUM | npm audit encontro vulnerabilidades en tooling de desarrollo de frontend; no se presentan como runtime. | critical=0; high=1; moderate=4; low=0 | Actualizar tooling de desarrollo y confirmar que no se incluya en el artefacto de produccion. |
| NPM_OUTDATED_FRONTEND | LOW | Hay dependencias obsoletas en frontend. | @angular/build, @angular/cli, @angular/common, @angular/compiler, @angular/compiler-cli, @angular/core, @angular/forms, @angular/platform-browser, @angular/router, @lucide/angular, jsdom, prettier, typescript, vitest | Evaluar actualizaciones compatibles y probar build/test despues. |

### Checks OK

| Area | Check | Evidencia |
| --- | --- | --- |
| Seguridad | Existe backend/.env | backend/.env |
| Seguridad | .env no aparece en git status |  |
| Seguridad | No hay .env versionado |  |
| Seguridad | No se detectaron secretos evidentes en archivos versionados |  |
| Seguridad | No se detectaron secretos en git diff |  |
| Seguridad | SESSION_IDLE_TIMEOUT_MINUTES valido | 60 |
| Seguridad | SESSION_IDLE_WARNING_MINUTES valido | 5 |
| Seguridad | npm audit desarrollo backend sin vulnerabilidades adicionales a runtime | critical=0; high=0; moderate=0; low=0 |
| Seguridad | npm audit runtime frontend sin vulnerabilidades reportadas | critical=0; high=0; moderate=0; low=0 |

## 6. Consistencia operacional

### Hallazgos

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| OPS_LOST_DEVICE_ACTIVE_CUSTODY | INFO | Un equipo EXTRAVIADO conserva un responsable conocido; puede representar custodia activa o ultimo responsable historico. | cantidad=1<br>[<br>  {<br>    "id": "297",<br>    "codigo_inventario": 1283,<br>    "codigo": "EXTRAVIADO",<br>    "colaborador_id": "165",<br>    "departamento_id": null<br>  }<br>] | Confirmar la semantica de colaborador_id/departamento_id antes de clasificarlo como inconsistencia; no modificarlo automaticamente. |

### Checks OK

| Area | Check | Evidencia |
| --- | --- | --- |
| Consistencia operacional | Un equipo tiene colaborador_id y departamento_id simultaneamente. | cantidad=0 |
| Consistencia operacional | Un equipo DADO_BAJA tiene custodia activa. | cantidad=0 |
| Consistencia operacional | Una SIM aparece asociada a mas de un dispositivo. | cantidad=0 |
| Consistencia operacional | Una linea movil activa esta duplicada. | cantidad=0 |
| Consistencia operacional | Una linea movil ACTIVA no esta asociada a SIM, dispositivo ni colaborador. | cantidad=0 |
| Consistencia operacional | Una linea PENDIENTE_REPOSICION conserva sim_id. | cantidad=0 |
| Consistencia operacional | La verificacion manual parece deducida de movimientos operativos. | cantidad=0 |

## 7. Disponibilidad

### Hallazgos

Sin hallazgos.

### Checks OK

| Area | Check | Evidencia |
| --- | --- | --- |
| Disponibilidad | Backend configurado | 127.0.0.1:3000 |
| Disponibilidad | Puerto 3000 abierto | 127.0.0.1:3000 |
| Disponibilidad | backend health disponible | HTTP 200; 42 ms |
| Disponibilidad | backend database health disponible | HTTP 200; 178 ms |
| Disponibilidad | frontend HTTPS 4200 disponible | HTTP 200; 23 ms |
| Disponibilidad | Frontend configurado | https://192.168.56.1:4200 |
| Disponibilidad | Sistema operativo detectado | Windows_NT 10.0.26200 x64 |
| Disponibilidad | Memoria disponible detectada | 3985 MB libres de 12164 MB |
| Disponibilidad | Version Node detectada | v24.19.0 |
| Disponibilidad | Version npm detectada | 11.17.0 |
| Disponibilidad | Espacio libre en disco suficiente | 291.54 GB libres |

## 8. Codigo y pruebas

### Hallazgos

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| CODE_FRONTEND_BUILD_FAILED | HIGH | frontend npm run build fallo. | > frontend@0.0.0 build<br>> ng build<br>❯ Building...<br>✔ Building...<br>Initial chunk files \| Names                  \|  Raw size \| Estimated transfer size<br>main-E7MNBRSX.js    \| main                   \| 352.77 kB \|                43.51 kB<br>chunk-m8Qjw6aX.js   \| -                      \| 184.62 kB \|                54.31 kB<br>styles-AALPSMGD.css \| styles                 \|  14.07 kB \|                 3.19 kB<br>                    \| Initial total          \| 551.47 kB \|               101.01 kB<br>Lazy chunk files    \| Names                  \|  Raw size \| Estimated transfer size<br>chunk-CxgUR9Oo2.js  \| dispositivos-list      \| 536.37 kB \|               104.62 kB<br>chunk-CCKfI93n.js   \| dispositivo-detail     \|  88.47 kB \|                18.88 kB<br>chunk-C6XmHlrp2.js  \| dashboard              \|  69.52 kB \|                12.99 kB<br>chunk-BsQTKqhp.js   \| -                      \|  54.50 kB \|                10.95 kB<br>chunk-jNzO7g2j2.js  \| offboarding-page       \|  43.12 kB \|                 8.83 kB<br>chunk-BtHAz0l5.js   \| servicio-tecnico       \|  38.86 kB \|                 8.65 kB<br>chunk-BAvxRvwm.js   \| dispositivo-form       \|  28.44 kB \|                 7.86 kB<br>chunk-tewWG_oG.js   \| -                      \|  24.98 kB \| ... [truncado] | Corregir errores de build/typecheck/test antes de promover cambios. |
| CODE_FRONTEND_TYPECHECK_MISSING | INFO | frontend no define script typecheck. | script ausente | Agregar el script si el proyecto requiere esta validacion. |

### Checks OK

| Area | Check | Evidencia |
| --- | --- | --- |
| Codigo y pruebas | git status ejecutado | M backend/src/modules/departamentos/departamentos.service.ts<br> M backend/src/modules/departamentos/departamentos.types.ts<br> M docs/PRODUCTION_CHECKLIST.md<br> M docs/api/ITAM_API_MVP.md<br> M docs/api/ITAM_CODES_AND_LABELS.md<br> M docs/bitacoras/bitacora-2026-08-24-a-2026-09-22.md<br> M frontend/src/app/core/models/itam.models.ts<br> M frontend/src/app/features/dashboard/dashboard.scss<br> M frontend/src/app/features/dashboard/dashboard.spec.ts<br> M frontend/src/app/features/dashboard/dashboard.ts<br> M frontend/src/app/features/departamentos/departamento-detail.ts<br> M scripts/itam-environment-audit.mjs<br>?? backend/src/modules/departamentos/departamentos.service.test.ts<br>?? docs/README.md<br>?? docs/api/ACTAS_ENTREGA.md<br>?? docs/api/AUTH.md<br>?? docs/api/COLABORADORES.md<br>?? docs/api/DASHBOARD.md<br>?? docs/api/DEPARTAMENTOS.md<br>?? docs/api/DISPOSITIVOS.md<br>?? docs/api/ERRORES_HTTP.md<br>?? docs/api/OFFBOARDING.md<br>?? docs/api/README.md<br>?? docs/api/SERVICIO_TECNICO.md<br>?? docs/api/SIM_LINEAS.md<br>?? docs/arquitectura/ARQUITECTURA_GENERAL.md<br>?? docs/arquitectura/BACKEND.md<br>?? docs/arquitectura/BASE_DE_DATOS.md<br>?? docs/arquitectura/DECISIONES_TECNICAS.md<br>?? docs/arquitectura/FRONTEND.md<br>?? docs/arquitectura/README.md<br>?? docs/arq... [truncado] |
| Codigo y pruebas | git diff --check sin errores |  |
| Codigo y pruebas | backend npm run build exitoso | <br>> backend@1.0.0 build<br>> tsc<br><br> |
| Codigo y pruebas | backend npm run typecheck exitoso | <br>> backend@1.0.0 typecheck<br>> tsc --noEmit<br><br> |
| Codigo y pruebas | backend npm test exitoso | <br>> backend@1.0.0 test<br>> tsc && node --test --test-concurrency=1 dist/modules/*/*.test.js<br><br>◇ injected env (9) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }<br>✔ P1-09: con credenciales pendientes solo se permiten endpoints minimos (1.0485ms)<br>✔ P1-09: cinco fallos de password activan el bloqueo temporal (0.1939ms)<br>✔ QA-09: utiliza exclusivamente el nombre de la sesión autenticada (0.9722ms)<br>✔ QA-09: bloquea la operación cuando no existe una sesión identificable (0.5865ms)<br>◇ injected env (9) from .env // tip: ◈ encrypted .env [www.dotenvx.com]<br>✔ A/E/F/H: cambia password, conserva PIN y audita con SQL PostgreSQL valido (411.9426ms)<br>✔ B: password actual incorrecta produce error de negocio y no modifica usuario (136.0032ms)<br>✔ C: nueva password invalida produce VALIDATION_ERROR 400 (1.4122ms)<br>✔ D: change-password sin sesion es rechazado con 401 (0.6102ms)<br>✔ G: conteo PostgreSQL aplica bloqueo en cinco fallos durante quince minutos (93.3449ms)<br>◇ injected env (9) from .env //... [truncado] |
| Codigo y pruebas | frontend npm run test -- --watch=false exitoso | <br>> frontend@0.0.0 test<br>> ng test --watch=false<br><br>❯ Building...<br>✔ Building...<br>Initial chunk files                                   \| Names                                              \|  Raw size<br>spec-app-features-workflow-helpers.js                 \| spec-app-features-workflow-helpers                 \| 279.43 kB \| <br>chunk-SMVKLDSK.js                                     \| -                                                  \| 263.09 kB \| <br>spec-app-features-dashboard-dashboard.js              \| spec-app-features-dashboard-dashboard              \| 192.60 kB \| <br>spec-app-features-offboarding-offboarding-page.js     \| spec-app-features-offboarding-offboarding-page     \| 132.12 kB \| <br>chunk-SXZ6H2WO.js                                     \| -                                                  \|  87.63 kB \| <br>spec-app-features-stock-alerts-stock-alerts.js        \| spec-app-features-stock-alerts-stock-alerts        \|  46.48 kB \| <br>chunk-DEZ3S2FD.js                                     \| -              ... [truncado] |

## 9. Trazabilidad

### Hallazgos

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| TRACE_EVENT_LINEA_CONSERVADA_POR_REPOSICION_MISSING | INFO | No existen eventos registrados de tipo LINEA_CONSERVADA_POR_REPOSICION; no implica error por si solo. | cantidad=0 | Investigar solo si existe evidencia de que el proceso ocurrio y no se registro su historial. |

### Checks OK

| Area | Check | Evidencia |
| --- | --- | --- |
| Trazabilidad | Evento critico presente: VERIFICACION_MANUAL_EQUIPO | cantidad=21 |
| Trazabilidad | Evento critico presente: ASIGNAR_COLABORADOR | cantidad=511 |
| Trazabilidad | Evento critico presente: DEVOLVER_DISPOSITIVO | cantidad=30 |
| Trazabilidad | Evento critico presente: ASIGNAR_DEPARTAMENTO | cantidad=15 |
| Trazabilidad | Evento critico presente: SIM_ASOCIADA_A_DISPOSITIVO | cantidad=3 |
| Trazabilidad | Evento critico presente: LINEA_MOVIL_ASOCIADA_A_DISPOSITIVO | cantidad=35 |
| Trazabilidad | Evento critico presente: LINEA_MOVIL_NUMERO_ACTUALIZADO | cantidad=10 |
| Trazabilidad | Eventos sin responsable. | cantidad=0 |
| Trazabilidad | Eventos sin fecha. | cantidad=0 |
| Trazabilidad | Eventos criticos con metadata vacia. | cantidad=0 |
| Trazabilidad | Ultimos 20 eventos consultados | eventos=20 |

## 10. Evidencia visual

Auditoria visual no habilitada. Definir `AUDIT_SCREENSHOTS=true` para capturar el frontend.

## 11. Migraciones

Aplicadas: 31
Ultima aplicada: 032 technical_service_quotes
Pendientes segun repositorio: 029_simplify_technical_service.sql
Versiones posteriores aplicadas: 030, 031, 032
Diagnostico: Migracion fuera de secuencia detectada.

## 12. Dependencias

| Proyecto | Runtime (omit=dev) | Desarrollo adicional |
| --- | --- | --- |
| backend | critical=0; high=1; moderate=1; low=0 | critical=0; high=0; moderate=0; low=0 |
| frontend | critical=0; high=0; moderate=0; low=0 | critical=0; high=1; moderate=4; low=0 |

## 13. Logs generados

- [backend-build.log](logs/2026-09-24-10-13/backend-build.log)
- [backend-tests.log](logs/2026-09-24-10-13/backend-tests.log)
- [frontend-build.log](logs/2026-09-24-10-13/frontend-build.log)
- [frontend-tests.log](logs/2026-09-24-10-13/frontend-tests.log)
- [npm-audit-backend.json](logs/2026-09-24-10-13/npm-audit-backend.json)
- [npm-audit-frontend.json](logs/2026-09-24-10-13/npm-audit-frontend.json)

## Consultas ejecutadas

| Consulta | SQL |
| --- | --- |
| conexion PostgreSQL | SELECT NOW() AS database_time, current_database() AS database, current_user AS user |
| schema itam | SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS exists |
| tabla schema_migrations | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.tables<br>         WHERE table_schema = 'itam' AND table_name = $1<br>       ) AS exists |
| migraciones aplicadas | SELECT version, nombre, aplicado_en FROM itam.schema_migrations ORDER BY version |
| tabla colaboradores | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.tables<br>         WHERE table_schema = 'itam' AND table_name = $1<br>       ) AS exists |
| tabla departamentos | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.tables<br>         WHERE table_schema = 'itam' AND table_name = $1<br>       ) AS exists |
| tabla dispositivos | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.tables<br>         WHERE table_schema = 'itam' AND table_name = $1<br>       ) AS exists |
| tabla sim | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.tables<br>         WHERE table_schema = 'itam' AND table_name = $1<br>       ) AS exists |
| tabla estados | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.tables<br>         WHERE table_schema = 'itam' AND table_name = $1<br>       ) AS exists |
| tabla historial_eventos | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.tables<br>         WHERE table_schema = 'itam' AND table_name = $1<br>       ) AS exists |
| tabla lineas_moviles | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.tables<br>         WHERE table_schema = 'itam' AND table_name = $1<br>       ) AS exists |
| tabla actas_entrega | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.tables<br>         WHERE table_schema = 'itam' AND table_name = $1<br>       ) AS exists |
| tabla comprobantes_devolucion | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.tables<br>         WHERE table_schema = 'itam' AND table_name = $1<br>       ) AS exists |
| columna sim.linea_movil_id | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| columna lineas_moviles.numero_telefonico | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| columna lineas_moviles.dispositivo_id | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| columna lineas_moviles.sim_id | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| columna lineas_moviles.colaborador_id | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| columna dispositivos.codigo_inventario | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| DB_DUP_DEVICE_ITAM_CODE | SELECT COUNT(*)::int AS count FROM (SELECT codigo_inventario, COUNT(*) AS cantidad FROM itam.dispositivos GROUP BY codigo_inventario HAVING COUNT(*) > 1) audit_subquery |
| columna sim.codigo_inventario | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| DB_DUP_SIM_ITAM_CODE | SELECT COUNT(*)::int AS count FROM (SELECT codigo_inventario, COUNT(*) AS cantidad FROM itam.sim GROUP BY codigo_inventario HAVING COUNT(*) > 1) audit_subquery |
| DB_DUP_ITAM_CODE_BETWEEN_DEVICE_SIM | SELECT COUNT(*)::int AS count FROM (SELECT d.codigo_inventario FROM itam.dispositivos d JOIN itam.sim s ON s.codigo_inventario = d.codigo_inventario) audit_subquery |
| columna dispositivos.imei | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| DB_DUP_DEVICE_IMEI | SELECT COUNT(*)::int AS count FROM (SELECT BTRIM(imei) AS imei, COUNT(*) AS cantidad FROM itam.dispositivos WHERE NULLIF(BTRIM(imei), '') IS NOT NULL GROUP BY BTRIM(imei) HAVING COUNT(*) > 1) audit_subquery |
| DB_DUP_MOBILE_NUMBER | SELECT COUNT(*)::int AS count FROM (SELECT REGEXP_REPLACE(numero_telefonico, '[^0-9]', '', 'g') AS numero, COUNT(*) AS cantidad FROM itam.lineas_moviles GROUP BY REGEXP_REPLACE(numero_telefonico, '[^0-9]', '', 'g') HAVING COUNT(*) > 1) audit_subquery |
| columna dispositivos.colaborador_id | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| columna dispositivos.departamento_id | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| DB_DEVICE_TWO_CUSTODIANS | SELECT COUNT(*)::int AS count FROM (SELECT id, codigo_inventario, colaborador_id, departamento_id FROM itam.dispositivos WHERE colaborador_id IS NOT NULL AND departamento_id IS NOT NULL) audit_subquery |
| columna sim.dispositivo_id | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| DB_SIM_ORPHAN_DEVICE | SELECT COUNT(*)::int AS count FROM (SELECT s.id, s.codigo_inventario, s.dispositivo_id FROM itam.sim s LEFT JOIN itam.dispositivos d ON d.id = s.dispositivo_id WHERE s.dispositivo_id IS NOT NULL AND d.id IS NULL) audit_subquery |
| DB_LINE_ORPHAN_DEVICE | SELECT COUNT(*)::int AS count FROM (SELECT l.id, l.numero_telefonico, l.dispositivo_id FROM itam.lineas_moviles l LEFT JOIN itam.dispositivos d ON d.id = l.dispositivo_id WHERE l.dispositivo_id IS NOT NULL AND d.id IS NULL) audit_subquery |
| DB_LINE_ORPHAN_SIM | SELECT COUNT(*)::int AS count FROM (SELECT l.id, l.numero_telefonico, l.sim_id FROM itam.lineas_moviles l LEFT JOIN itam.sim s ON s.id = l.sim_id WHERE l.sim_id IS NOT NULL AND s.id IS NULL) audit_subquery |
| columna dispositivos.estado_id | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| DB_DEVICE_WITHOUT_STATE | SELECT COUNT(*)::int AS count FROM (SELECT d.id, d.codigo_inventario, d.estado_id FROM itam.dispositivos d LEFT JOIN itam.estados e ON e.id = d.estado_id WHERE d.estado_id IS NULL OR e.id IS NULL) audit_subquery |
| columna sim.estado_id | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| DB_SIM_WITHOUT_STATE | SELECT COUNT(*)::int AS count FROM (SELECT s.id, s.codigo_inventario, s.estado_id FROM itam.sim s LEFT JOIN itam.estados e ON e.id = s.estado_id WHERE s.estado_id IS NULL OR e.id IS NULL) audit_subquery |
| columna colaboradores.rut | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| DB_COLLABORATOR_WITHOUT_RUT | SELECT COUNT(*)::int AS count FROM (SELECT id, nombre FROM itam.colaboradores WHERE NULLIF(BTRIM(rut), '') IS NULL) audit_subquery |
| columna historial_eventos.tipo_evento | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| DB_HISTORY_WITHOUT_EVENT_TYPE | SELECT COUNT(*)::int AS count FROM (SELECT id, fecha_evento FROM itam.historial_eventos WHERE NULLIF(BTRIM(tipo_evento), '') IS NULL) audit_subquery |
| columna historial_eventos.linea_movil_id | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| columna historial_eventos.tipo_entidad | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| columna historial_eventos.dispositivo_id | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| columna historial_eventos.sim_id | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| DB_HISTORY_WITHOUT_ENTITY_REFERENCE | SELECT COUNT(*)::int AS count FROM (SELECT id, tipo_entidad, dispositivo_id, sim_id, linea_movil_id FROM itam.historial_eventos WHERE tipo_entidad IS NULL OR (dispositivo_id IS NULL AND sim_id IS NULL AND linea_movil_id IS NULL)) audit_subquery |
| eventos criticos | SELECT tipo_evento, COUNT(*)::int AS count FROM itam.historial_eventos WHERE tipo_evento = ANY($1) GROUP BY tipo_evento ORDER BY tipo_evento |
| columna historial_eventos.responsable | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| TRACE_EVENTS_WITHOUT_RESPONSIBLE | SELECT COUNT(*)::int AS count FROM (SELECT id, tipo_evento, fecha_evento FROM itam.historial_eventos WHERE NULLIF(BTRIM(responsable), '') IS NULL) audit_subquery |
| columna historial_eventos.fecha_evento | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| TRACE_EVENTS_WITHOUT_DATE | SELECT COUNT(*)::int AS count FROM (SELECT id, tipo_evento FROM itam.historial_eventos WHERE fecha_evento IS NULL) audit_subquery |
| columna historial_eventos.detalle | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| TRACE_CRITICAL_EVENTS_EMPTY_METADATA | SELECT COUNT(*)::int AS count FROM (SELECT id, tipo_evento, fecha_evento<br>          FROM itam.historial_eventos<br>          WHERE tipo_evento = ANY(ARRAY['VERIFICACION_MANUAL_EQUIPO','ASIGNAR_COLABORADOR','DEVOLVER_DISPOSITIVO','ASIGNAR_DEPARTAMENTO','SIM_ASOCIADA_A_DISPOSITIVO','LINEA_MOVIL_ASOCIADA_A_DISPOSITIVO','LINEA_CONSERVADA_POR_REPOSICION','LINEA_MOVIL_NUMERO_ACTUALIZADO'])<br>            AND (detalle IS NULL OR detalle = '{}'::jsonb)) audit_subquery |
| OPS_DEVICE_TWO_CUSTODIANS | SELECT COUNT(*)::int AS count FROM (SELECT id, codigo_inventario, colaborador_id, departamento_id FROM itam.dispositivos WHERE colaborador_id IS NOT NULL AND departamento_id IS NOT NULL) audit_subquery |
| columna estados.codigo | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| OPS_LOST_DEVICE_ACTIVE_CUSTODY | SELECT COUNT(*)::int AS count FROM (SELECT d.id, d.codigo_inventario, e.codigo, d.colaborador_id, d.departamento_id FROM itam.dispositivos d JOIN itam.estados e ON e.id = d.estado_id WHERE e.codigo = 'EXTRAVIADO' AND (d.colaborador_id IS NOT NULL OR d.departamento_id IS NOT NULL)) audit_subquery |
| OPS_LOST_DEVICE_ACTIVE_CUSTODY sample | SELECT d.id, d.codigo_inventario, e.codigo, d.colaborador_id, d.departamento_id FROM itam.dispositivos d JOIN itam.estados e ON e.id = d.estado_id WHERE e.codigo = 'EXTRAVIADO' AND (d.colaborador_id IS NOT NULL OR d.departamento_id IS NOT NULL) LIMIT 20 |
| OPS_RETIRED_DEVICE_ACTIVE_CUSTODY | SELECT COUNT(*)::int AS count FROM (SELECT d.id, d.codigo_inventario, e.codigo, d.colaborador_id, d.departamento_id FROM itam.dispositivos d JOIN itam.estados e ON e.id = d.estado_id WHERE e.codigo = 'DADO_BAJA' AND (d.colaborador_id IS NOT NULL OR d.departamento_id IS NOT NULL)) audit_subquery |
| OPS_SIM_MULTIPLE_DEVICES | SELECT COUNT(*)::int AS count FROM (SELECT sim_id, COUNT(DISTINCT dispositivo_id) AS dispositivos FROM itam.lineas_moviles WHERE sim_id IS NOT NULL AND dispositivo_id IS NOT NULL GROUP BY sim_id HAVING COUNT(DISTINCT dispositivo_id) > 1) audit_subquery |
| columna lineas_moviles.estado | SELECT EXISTS (<br>         SELECT 1 FROM information_schema.columns<br>         WHERE table_schema = 'itam' AND table_name = $1 AND column_name = $2<br>       ) AS exists |
| OPS_ACTIVE_LINE_DUPLICATED | SELECT COUNT(*)::int AS count FROM (SELECT REGEXP_REPLACE(numero_telefonico, '[^0-9]', '', 'g') AS numero, COUNT(*) AS cantidad FROM itam.lineas_moviles WHERE estado = 'ACTIVA' GROUP BY REGEXP_REPLACE(numero_telefonico, '[^0-9]', '', 'g') HAVING COUNT(*) > 1) audit_subquery |
| OPS_LINE_WITHOUT_OWNER | SELECT COUNT(*)::int AS count FROM (SELECT id, numero_telefonico, estado FROM itam.lineas_moviles WHERE estado = 'ACTIVA' AND sim_id IS NULL AND dispositivo_id IS NULL AND colaborador_id IS NULL) audit_subquery |
| OPS_PENDING_REPLACEMENT_WITH_SIM | SELECT COUNT(*)::int AS count FROM (SELECT id, numero_telefonico, sim_id FROM itam.lineas_moviles WHERE estado = 'PENDIENTE_REPOSICION' AND sim_id IS NOT NULL) audit_subquery |
| OPS_AUTOMATIC_MANUAL_VERIFICATION | SELECT COUNT(*)::int AS count FROM (SELECT id, dispositivo_id, fecha_evento, detalle FROM itam.historial_eventos WHERE tipo_evento = 'VERIFICACION_MANUAL_EQUIPO' AND (detalle->>'motivo' ILIKE '%operativ%' OR detalle->>'origen' ILIKE '%automatic%' OR detalle->>'automatico' = 'true')) audit_subquery |
| ultimos 20 eventos | SELECT id, tipo_entidad, tipo_evento, responsable, fecha_evento<br>       FROM itam.historial_eventos<br>       ORDER BY fecha_evento DESC, id DESC<br>       LIMIT 20 |

## Comandos ejecutados

| Comando | CWD | Exit | Resumen |
| --- | --- | ---: | --- |
| git status --short | . | 0 |  M backend/src/modules/departamentos/departamentos.service.ts<br> M backend/src/modules/departamentos/departamentos.types.ts<br> M docs/PRODUCTION_CHECKLIST.md<br> M docs/api/ITAM_API_MVP.md<br> M docs/api/ITAM_CODES_AND_LABELS.md<br> M docs/bitacoras/bitacora-2026-08-24-a-2026-09-22.md<br> M frontend/src/app/core/models/itam.models.ts<br> M frontend/src/app/features/dashboard/dashboard.scss<br> M frontend/src/app/features/dashboard/dashboard.spec.ts<br> M frontend/src/app/features/dashboard/dashboard.ts<br> M frontend/src/a... [truncado] |
| git ls-files | . | 0 | .gitignore<br>1.-ESTRUCTURA ESSSI.xlsx<br>README.md<br>"ave ITAM progress before final QA\357\200\242"<br>backend/.env.example<br>backend/=<br>backend/package-lock.json<br>backend/package.json<br>backend/reports/auditoria-verificaciones-automaticas.csv<br>backend/src/app.ts<br>backend/src/config/database.ts<br>backend/src/config/env.ts<br>backend/src/modules/actas-entrega/actas-entrega.controller.ts<br>backend/src/modules/actas-entrega/actas-entrega.repository.ts<br>backend/src/modules/actas-entrega/actas-entrega.routes.ts<br>backend/src/m... [truncado] |
| git diff --cached --no-ext-diff && git diff --no-ext-diff | . | 0 | diff --git a/backend/src/modules/departamentos/departamentos.service.ts b/backend/src/modules/departamentos/departamentos.service.ts<br>index a072394..14ed2e3 100644<br>--- a/backend/src/modules/departamentos/departamentos.service.ts<br>+++ b/backend/src/modules/departamentos/departamentos.service.ts<br>@@ -21,8 +21,69 @@ import type {<br>   DepartamentoRow,<br>   InventarioDepartamento<br> } from "./departamentos.types";<br>+import type { DispositivoResumen } from "../dispositivos/dispositivos.types";<br> import { obtene... [truncado] |
| npm audit --omit=dev --json | backend | 1 | {<br>  "auditReportVersion": 2,<br>  "vulnerabilities": {<br>    "multer": {<br>      "name": "multer",<br>      "severity": "high",<br>      "isDirect": true,<br>      "via": [<br>        {<br>          "source": 1193790,<br>          "name": "multer",<br>          "dependency": "multer",<br>          "title": "multer vulnerable to Denial of Service via crafted multipart field names",<br>          "url": "https://github.com/advisories/GHSA-wc9g-mqfw-jrwm",<br>          "severity": "high",<br>          "cwe": [<br>            "CWE-248"<br>      ... [truncado] |
| npm audit --json | backend | 1 | {<br>  "auditReportVersion": 2,<br>  "vulnerabilities": {<br>    "multer": {<br>      "name": "multer",<br>      "severity": "high",<br>      "isDirect": true,<br>      "via": [<br>        {<br>          "source": 1193790,<br>          "name": "multer",<br>          "dependency": "multer",<br>          "title": "multer vulnerable to Denial of Service via crafted multipart field names",<br>          "url": "https://github.com/advisories/GHSA-wc9g-mqfw-jrwm",<br>          "severity": "high",<br>          "cwe": [<br>            "CWE-248"<br>      ... [truncado] |
| npm outdated --json | backend | 1 | {<br>  "@types/node": {<br>    "current": "26.2.0",<br>    "wanted": "26.6.2",<br>    "latest": "26.6.2",<br>    "dependent": "backend",<br>    "location": "E:\\Aguas San Isidro V2\\ITAM\\backend\\node_modules\\@types\\node"<br>  },<br>  "@types/pg": {<br>    "current": "8.21.0",<br>    "wanted": "8.23.1",<br>    "latest": "8.23.1",<br>    "dependent": "backend",<br>    "location": "E:\\Aguas San Isidro V2\\ITAM\\backend\\node_modules\\@types\\pg"<br>  },<br>  "dotenv": {<br>    "current": "17.4.2",<br>    "wanted": "17.4.2",<br>    "latest": "18.0... [truncado] |
| npm audit --omit=dev --json | frontend | 0 | {<br>  "auditReportVersion": 2,<br>  "vulnerabilities": {},<br>  "metadata": {<br>    "vulnerabilities": {<br>      "info": 0,<br>      "low": 0,<br>      "moderate": 0,<br>      "high": 0,<br>      "critical": 0,<br>      "total": 0<br>    },<br>    "dependencies": {<br>      "prod": 42,<br>      "dev": 489,<br>      "optional": 151,<br>      "peer": 3,<br>      "peerOptional": 0,<br>      "total": 533<br>    }<br>  }<br>}<br> |
| npm audit --json | frontend | 1 | {<br>  "auditReportVersion": 2,<br>  "vulnerabilities": {<br>    "@vitest/mocker": {<br>      "name": "@vitest/mocker",<br>      "severity": "moderate",<br>      "isDirect": false,<br>      "via": [<br>        {<br>          "source": 1193684,<br>          "name": "@vitest/mocker",<br>          "dependency": "@vitest/mocker",<br>          "title": "Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock",<br>          "url": "https://github.com/advisories/GHSA-82fw-gwwq-j7x9",<br>          "severity": "moderate",<br> ... [truncado] |
| npm outdated --json | frontend | 1 | {<br>  "@angular/build": {<br>    "current": "22.1.4",<br>    "wanted": "22.2.0",<br>    "latest": "22.2.0",<br>    "dependent": "frontend",<br>    "location": "E:\\Aguas San Isidro V2\\ITAM\\frontend\\node_modules\\@angular\\build"<br>  },<br>  "@angular/cli": {<br>    "current": "22.1.4",<br>    "wanted": "22.2.0",<br>    "latest": "22.2.0",<br>    "dependent": "frontend",<br>    "location": "E:\\Aguas San Isidro V2\\ITAM\\frontend\\node_modules\\@angular\\cli"<br>  },<br>  "@angular/common": {<br>    "current": "22.1.2",<br>    "wanted": "22.... [truncado] |
| node --version | . | 0 | v24.19.0<br> |
| npm --version | . | 0 | 11.17.0<br> |
| powershell -NoProfile -Command "(Get-PSDrive -Name 'E').Free" | . | 0 | 313042354176<br> |
| git status --short | . | 0 |  M backend/src/modules/departamentos/departamentos.service.ts<br> M backend/src/modules/departamentos/departamentos.types.ts<br> M docs/PRODUCTION_CHECKLIST.md<br> M docs/api/ITAM_API_MVP.md<br> M docs/api/ITAM_CODES_AND_LABELS.md<br> M docs/bitacoras/bitacora-2026-08-24-a-2026-09-22.md<br> M frontend/src/app/core/models/itam.models.ts<br> M frontend/src/app/features/dashboard/dashboard.scss<br> M frontend/src/app/features/dashboard/dashboard.spec.ts<br> M frontend/src/app/features/dashboard/dashboard.ts<br> M frontend/src/a... [truncado] |
| git diff --check | . | 0 | warning: in the working copy of 'backend/src/modules/departamentos/departamentos.service.ts', LF will be replaced by CRLF the next time Git touches it<br>warning: in the working copy of 'backend/src/modules/departamentos/departamentos.types.ts', LF will be replaced by CRLF the next time Git touches it<br>warning: in the working copy of 'docs/PRODUCTION_CHECKLIST.md', LF will be replaced by CRLF the next time Git touches it<br>warning: in the working copy of 'docs/api/ITAM_API_MVP.md', LF will be replaced... [truncado] |
| npm run build | backend | 0 | <br>> backend@1.0.0 build<br>> tsc<br><br> |
| npm run typecheck | backend | 0 | <br>> backend@1.0.0 typecheck<br>> tsc --noEmit<br><br> |
| npm test | backend | 0 | <br>> backend@1.0.0 test<br>> tsc && node --test --test-concurrency=1 dist/modules/*/*.test.js<br><br>◇ injected env (9) from .env // tip: ⌘ multiple files { path: ['.env.local', '.env'] }<br>✔ P1-09: con credenciales pendientes solo se permiten endpoints minimos (1.0485ms)<br>✔ P1-09: cinco fallos de password activan el bloqueo temporal (0.1939ms)<br>✔ QA-09: utiliza exclusivamente el nombre de la sesión autenticada (0.9722ms)<br>✔ QA-09: bloquea la operación cuando no existe una sesión identificable (0.5865ms)<br>◇ inje... [truncado] |
| npm run build | frontend | 1 | > frontend@0.0.0 build<br>> ng build<br>❯ Building...<br>✔ Building...<br>Initial chunk files \| Names                  \|  Raw size \| Estimated transfer size<br>main-E7MNBRSX.js    \| main                   \| 352.77 kB \|                43.51 kB<br>chunk-m8Qjw6aX.js   \| -                      \| 184.62 kB \|                54.31 kB<br>styles-AALPSMGD.css \| styles                 \|  14.07 kB \|                 3.19 kB<br>                    \| Initial total          \| 551.47 kB \|               101.01 kB<br>Lazy chunk files    \| N... [truncado] |
| npm run test -- --watch=false | frontend | 0 | <br>> frontend@0.0.0 test<br>> ng test --watch=false<br><br>❯ Building...<br>✔ Building...<br>Initial chunk files                                   \| Names                                              \|  Raw size<br>spec-app-features-workflow-helpers.js                 \| spec-app-features-workflow-helpers                 \| 279.43 kB \| <br>chunk-SMVKLDSK.js                                     \| -                                                  \| 263.09 kB \| <br>spec-app-features-dashboard-dashboard.js              \| spe... [truncado] |

## Recomendaciones finales

- Corregir primero CRITICAL y HIGH confirmados; el auditor saldra con codigo 1 mientras existan.
- Revisar MEDIUM antes de despliegues o respaldos operacionales.
- Mantener secretos fuera de Git y rotar cualquier secreto que haya aparecido en diff o archivos versionados.
- No ejecutar migraciones sin respaldo y sin revisar el resultado de esta auditoria.

## 14. Checklist antes de commit

- [ ] git status solo contiene cambios esperados.
- [ ] git diff --check pasa sin errores.
- [ ] No hay .env ni secretos en el indice, diff o archivos versionados.
- [ ] backend build/typecheck/test revisados.
- [ ] frontend build/typecheck/test revisados segun scripts disponibles.
- [ ] El informe de auditoria fue leido y los hallazgos bloqueantes fueron resueltos o documentados.

## 15. Checklist antes de produccion

- [ ] NODE_ENV=production.
- [ ] CORS_ORIGIN usa origen explicito.
- [ ] JWT_SECRET y SESSION_SECRET existen y son robustos cuando backend/src los utiliza.
- [ ] PostgreSQL responde y schema itam esta completo.
- [ ] Migraciones aplicadas coinciden con database/migrations.
- [ ] Health checks del backend y base de datos responden.
- [ ] No hay inconsistencias criticas de custodia, lineas moviles, SIM o historial.
- [ ] Hay respaldo vigente antes de cambios de base de datos.
