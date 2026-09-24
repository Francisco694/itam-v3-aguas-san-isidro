# Auditoria automatica integral ITAM 

Generado: 2026-09-23T17:59:36.636Z
Proyecto: E:/Aguas San Isidro V2/ITAM

## Resumen ejecutivo

Estado general: **NO APTO: existen hallazgos CRITICAL/HIGH.**

| Severidad | Cantidad |
| --- | ---: |
| CRITICAL | 0 |
| HIGH | 9 |
| MEDIUM | 4 |
| LOW | 3 |
| INFO | 6 |
| OK | 66 |

## Detalle por area

## Base de datos

### Hallazgos

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| DB_MIGRATIONS_PENDING | HIGH | Hay migraciones del repositorio no registradas en la base de datos. | 029_simplify_technical_service.sql | Revisar y aplicar migraciones pendientes mediante el flujo oficial, no desde el auditor. |

### Checks OK

| Area | Check | Evidencia |
| --- | --- | --- |
| Base de datos | Conexion PostgreSQL exitosa | {<br>  "database_time": "2026-09-23T17:56:16.696Z",<br>  "database": "itam_dev",<br>  "user": "itam_app"<br>} |
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

## Codigo y pruebas

### Hallazgos

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| CODE_FRONTEND_BUILD_FAILED | HIGH | frontend npm run build fallo. | <br>> frontend@0.0.0 build<br>> ng build<br><br>❯ Building...<br>✔ Building...<br>Initial chunk files \| Names                  \|  Raw size \| Estimated transfer size<br>main-U5ATXOKC.js    \| main                   \| 352.77 kB \|                43.52 kB<br>chunk-m8Qjw6aX.js   \| -                      \| 184.62 kB \|                54.31 kB<br>styles-AALPSMGD.css \| styles                 \|  14.07 kB \|                 3.19 kB<br><br>                    \| Initial total          \| 551.46 kB \|               101.02 kB<br><br>Lazy chunk files    \| Names                  \|  Raw size \| Estimated transfer size<br>chunk-DP80GX_v2.js  \| dispositivos-list      \| 536.37 kB \|               104.68 kB<br>chunk-BQ1YZ__L2.js  \| dispositivo-detail     \|  88.48 kB \|                18.90 kB<br>chunk-BsQTKqhp.js   \| -                      \|  54.50 kB \|                10.95 kB<br>chunk-C9S9hbBa.js   \| dashboard              \|  52.37 kB \|                10.14 kB<br>chunk-B-O1D-TA2.js  \| offboarding-page       \|  43.12 kB \|                 8.79 kB<br>chunk-DLtQH6V8.js   \| servicio-tecnico       \|  38.86 kB \|                 8.66 kB<br>chunk-CED_Yk2B.js   \| dispositivo-form       \|  28.44 kB \|                 7.88 kB<br>chunk-QkNzkNnL.js   \| -                      \|  24.98... [truncado] | Corregir errores de build/typecheck/test antes de promover cambios. |
| CODE_FRONTEND_TYPECHECK_MISSING | INFO | frontend no define script typecheck. | script ausente | Agregar el script si el proyecto requiere esta validacion. |

### Checks OK

| Area | Check | Evidencia |
| --- | --- | --- |
| Codigo y pruebas | git status ejecutado | M docs/PRODUCTION_CHECKLIST.md<br> M docs/api/ITAM_API_MVP.md<br> M docs/api/ITAM_CODES_AND_LABELS.md<br> M docs/bitacoras/bitacora-2026-08-24-a-2026-09-22.md<br>?? docs/README.md<br>?? docs/api/ACTAS_ENTREGA.md<br>?? docs/api/AUTH.md<br>?? docs/api/COLABORADORES.md<br>?? docs/api/DASHBOARD.md<br>?? docs/api/DEPARTAMENTOS.md<br>?? docs/api/DISPOSITIVOS.md<br>?? docs/api/ERRORES_HTTP.md<br>?? docs/api/OFFBOARDING.md<br>?? docs/api/README.md<br>?? docs/api/SERVICIO_TECNICO.md<br>?? docs/api/SIM_LINEAS.md<br>?? docs/arquitectura/ARQUITECTURA_GENERAL.md<br>?? docs/arquitectura/BACKEND.md<br>?? docs/arquitectura/BASE_DE_DATOS.md<br>?? docs/arquitectura/DECISIONES_TECNICAS.md<br>?? docs/arquitectura/FRONTEND.md<br>?? docs/arquitectura/README.md<br>?? docs/arquitectura/REGLAS_DE_NEGOCIO.md<br>?? docs/arquitectura/SEGURIDAD.md<br>?? docs/bitacoras/BITACORA_AGOSTO_2026.md<br>?? docs/bitacoras/BITACORA_SEPTIEMBRE_2026.md<br>?? docs/bitacoras/README.md<br>?? docs/diagramas/ARQUITECTURA_GENERAL.md<br>?? docs/diagramas/CASOS_DE_USO.md<br>?? docs/diagramas/CICLO_VIDA_ACTIVO.md<br>?? docs/diagramas/FLUJO_ASIGNACION.md<br>?? docs/diagramas/FLUJO_DEVOLUCION.md<br>?? docs/diagramas/FLUJO_OFFBOARDING.md<br>?? docs/diagramas/FLUJO_SERVICIO_TECNICO.md<br>?? docs/diagramas/FLUJO_SIM_LINEA.md<br>?? docs/dia... [truncado] |
| Codigo y pruebas | git diff --check sin errores |  |
| Codigo y pruebas | backend npm run build exitoso | <br>> backend@1.0.0 build<br>> tsc<br><br> |
| Codigo y pruebas | backend npm run typecheck exitoso | <br>> backend@1.0.0 typecheck<br>> tsc --noEmit<br><br> |
| Codigo y pruebas | backend npm test exitoso | <br>> backend@1.0.0 test<br>> tsc && node --test --test-concurrency=1 dist/modules/*/*.test.js<br><br>◇ injected env (9) from .env // tip: ⌘ enable debugging { debug: true }<br>✔ P1-09: con credenciales pendientes solo se permiten endpoints minimos (0.9998ms)<br>✔ P1-09: cinco fallos de password activan el bloqueo temporal (0.1852ms)<br>✔ QA-09: utiliza exclusivamente el nombre de la sesión autenticada (1.0195ms)<br>✔ QA-09: bloquea la operación cuando no existe una sesión identificable (0.5458ms)<br>◇ injected env (9) from .env // tip: ⌁ auth for agents [www.vestauth.com]<br>✔ A/E/F/H: cambia password, conserva PIN y audita con SQL PostgreSQL valido (762.1051ms)<br>✔ B: password actual incorrecta produce error de negocio y no modifica usuario (166.2666ms)<br>✔ C: nueva password invalida produce VALIDATION_ERROR 400 (1.7934ms)<br>✔ D: change-password sin sesion es rechazado con 401 (0.6049ms)<br>✔ G: conteo PostgreSQL aplica bloqueo en cinco fallos durante quince minutos (122.44ms)<br>◇ injected env (9) from .env // tip: ⌘ multip... [truncado] |
| Codigo y pruebas | frontend npm run test -- --watch=false exitoso | <br>> frontend@0.0.0 test<br>> ng test --watch=false<br><br>❯ Building...<br>✔ Building...<br>Initial chunk files                                   \| Names                                              \|  Raw size<br>spec-app-features-workflow-helpers.js                 \| spec-app-features-workflow-helpers                 \| 279.43 kB \| <br>chunk-SMVKLDSK.js                                     \| -                                                  \| 263.09 kB \| <br>spec-app-features-dashboard-dashboard.js              \| spec-app-features-dashboard-dashboard              \| 142.41 kB \| <br>spec-app-features-offboarding-offboarding-page.js     \| spec-app-features-offboarding-offboarding-page     \| 132.12 kB \| <br>chunk-SXZ6H2WO.js                                     \| -                                                  \|  87.63 kB \| <br>spec-app-features-stock-alerts-stock-alerts.js        \| spec-app-features-stock-alerts-stock-alerts        \|  46.48 kB \| <br>chunk-DEZ3S2FD.js                                     \| -              ... [truncado] |

## Consistencia operacional

### Hallazgos

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| OPS_LOST_DEVICE_ACTIVE_CUSTODY | MEDIUM | Un equipo EXTRAVIADO mantiene custodia activa. | cantidad=1<br>[<br>  {<br>    "id": "297",<br>    "codigo_inventario": 1283,<br>    "codigo": "EXTRAVIADO",<br>    "colaborador_id": "165",<br>    "departamento_id": null<br>  }<br>] | Retirar custodia activa o documentar excepcion operacional. |
| OPS_LINE_WITHOUT_OWNER | MEDIUM | Una linea movil sin SIM no esta asociada a dispositivo ni colaborador. | cantidad=5<br>[<br>  {<br>    "id": "22",<br>    "numero_telefonico": "56970110012",<br>    "estado": "DADA_BAJA"<br>  },<br>  {<br>    "id": "23",<br>    "numero_telefonico": "56970111190",<br>    "estado": "DADA_BAJA"<br>  },<br>  {<br>    "id": "24",<br>    "numero_telefonico": "56970591752",<br>    "estado": "DADA_BAJA"<br>  },<br>  {<br>    "id": "25",<br>    "numero_telefonico": "56970591753",<br>    "estado": "DADA_BAJA"<br>  },<br>  {<br>    "id": "26",<br>    "numero_telefonico": "56970591754",<br>    "estado": "DADA_BAJA"<br>  }<br>] | Asociar la linea a un dispositivo o colaborador, salvo flujo documentado de reposicion. |

### Checks OK

| Area | Check | Evidencia |
| --- | --- | --- |
| Consistencia operacional | Un equipo tiene colaborador_id y departamento_id simultaneamente. | cantidad=0 |
| Consistencia operacional | Un equipo DADO_BAJA tiene custodia activa. | cantidad=0 |
| Consistencia operacional | Una SIM aparece asociada a mas de un dispositivo. | cantidad=0 |
| Consistencia operacional | Una linea movil activa esta duplicada. | cantidad=0 |
| Consistencia operacional | Una linea PENDIENTE_REPOSICION conserva sim_id. | cantidad=0 |
| Consistencia operacional | La verificacion manual parece deducida de movimientos operativos. | cantidad=0 |

## Disponibilidad

### Hallazgos

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| PORT_3100_CLOSED | MEDIUM | El puerto 3100 no esta abierto. | connect ECONNREFUSED 127.0.0.1:3100 | Levantar el backend local o ajustar la configuracion de puerto. |
| HTTP_BACKEND_HEALTH_3100_DOWN | HIGH | backend health 3100 no esta disponible. | fetch failed | Levantar el servicio local o corregir host/puerto antes de validar disponibilidad. |
| HTTP_BACKEND_DATABASE_HEALTH_3100_DOWN | HIGH | backend database health 3100 no esta disponible. | fetch failed | Levantar el servicio local o corregir host/puerto antes de validar disponibilidad. |
| BACKEND_PORT_NOT_3100 | INFO | El PORT configurado para backend no es 3100. | PORT=3000 | Confirmar si ITAM v3.0 debe estandarizar backend en puerto 3100. |
| HTTP_FRONTEND_LOCAL_4200_DOWN | INFO | frontend local 4200 no esta disponible. | fetch failed | Levantar el servicio local o corregir host/puerto antes de validar disponibilidad. |
| FRONTEND_4200_OPTIONAL | INFO | Frontend local 4200 no esta levantado o no responde. | Chequeo informativo porque el requisito indica validar si esta levantado. | Levantar npm start en frontend si se desea validar disponibilidad web. |

### Checks OK

| Area | Check | Evidencia |
| --- | --- | --- |
| Disponibilidad | Sistema operativo detectado | Windows_NT 10.0.26200 x64 |
| Disponibilidad | Memoria disponible detectada | 1839 MB libres de 12164 MB |
| Disponibilidad | Version Node detectada | v24.19.0 |
| Disponibilidad | Version npm detectada | 11.17.0 |
| Disponibilidad | Espacio libre en disco suficiente | 291.54 GB libres |

## Seguridad

### Hallazgos

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| GIT_DIRTY | INFO | El arbol de trabajo tiene cambios locales. |  M docs/PRODUCTION_CHECKLIST.md<br> M docs/api/ITAM_API_MVP.md<br> M docs/api/ITAM_CODES_AND_LABELS.md<br> M docs/bitacoras/bitacora-2026-08-24-a-2026-09-22.md<br>?? docs/README.md<br>?? docs/api/ACTAS_ENTREGA.md<br>?? docs/api/AUTH.md<br>?? docs/api/COLABORADORES.md<br>?? docs/api/DASHBOARD.md<br>?? docs/api/DEPARTAMENTOS.md<br>?? docs/api/DISPOSITIVOS.md<br>?? docs/api/ERRORES_HTTP.md<br>?? docs/api/OFFBOARDING.md<br>?? docs/api/README.md<br>?? docs/api/SERVICIO_TECNICO.md<br>?? docs/api/SIM_LINEAS.md<br>?? docs/arquitectura/ARQUITECTURA_GENERAL.md<br>?? docs/arquitectura/BACKEND.md<br>?? docs/arquitectura/BASE_DE_DATOS.md<br>?? docs/arquitectura/DECISIONES_TECNICAS.md<br>?? docs/arquitectura/FRONTEND.md<br>?? docs/arquitectura/README.md<br>?? docs/arquitectura/REGLAS_DE_NEGOCIO.md<br>?? docs/arquitectura/SEGURIDAD.md<br>?? docs/bitacoras/BITACORA_AGOSTO_2026.md<br>?? docs/bitacoras/BITACORA_SEPTIEMBRE_2026.md<br>?? docs/bitacoras/README.md<br>?? docs/diagramas/ARQUITECTURA_GENERAL.md<br>?? docs/diagramas/CASOS_DE_USO.md<br>?? docs/diagramas/CICLO_VIDA_ACTIVO.md<br>?? docs/diagramas/FLUJO_ASIGNACION.md<br>?? docs/diagramas/FLUJO_DEVOLUCION.md<br>?? docs/diagramas/FLUJO_OFFBOARDING.md<br>?? docs/diagramas/FLUJO_SERVICIO_TECNICO.md<br>?? docs/diagramas/FLUJO_SIM_LINEA.md<br>?? docs/di... [truncado] | Revisar que los cambios esperados sean los unicos antes de commitear. |
| SECRETS_IN_VERSIONED_FILES | HIGH | Se detectaron posibles secretos en archivos versionados. | scripts/itam-environment-audit.mjs:59: .replace(/(DB_PASSWORD\s*[=:]\s*)([^\s"'`]+)/gi, "$1[REDACTED]")<br>scripts/itam-environment-audit.mjs:60: .replace(/((JWT_SECRET\|SESSION_SECRET\|API_KEY\|TOKEN)\s*[=:]\s*)([^\s"'`]+)/gi, "$1[REDACTED]")<br>scripts/itam-environment-audit.mjs:609: const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];<br>scripts/itam-environment-audit.mjs:618: recommendation: "Completar backend/.env con DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASSWORD." | Mover secretos a .env, usar placeholders en ejemplos y rotar valores comprometidos. |
| NODE_ENV_DEVELOPMENT | LOW | NODE_ENV esta en development. | NODE_ENV=development | Usar NODE_ENV=production para despliegues productivos. |
| CORS_ORIGIN_DEFAULT | INFO | CORS_ORIGIN no esta definido; el backend usara su valor por defecto. | Sin CORS_ORIGIN en backend/.env | Definir CORS_ORIGIN explicitamente por entorno. |
| JWT_SECRET_MISSING | HIGH | Falta JWT_SECRET. | JWT_SECRET=[REDACTED] | Definir JWT_SECRET con un valor robusto y no versionado. |
| SESSION_SECRET_MISSING | HIGH | Falta SESSION_SECRET. | SESSION_SECRET=[REDACTED] | Definir SESSION_SECRET con un valor robusto y no versionado. |
| NPM_AUDIT_BACKEND_HIGH | HIGH | npm audit encontro vulnerabilidades relevantes en backend. | critical=0; high=1; moderate=1; low=0 | Revisar npm audit, actualizar dependencias o documentar excepciones justificadas. |
| NPM_OUTDATED_BACKEND | LOW | Hay dependencias obsoletas en backend. | @types/node, @types/pg, dotenv, multer, pdfkit, tsx | Evaluar actualizaciones compatibles y probar build/test despues. |
| NPM_AUDIT_FRONTEND_HIGH | HIGH | npm audit encontro vulnerabilidades relevantes en frontend. | critical=0; high=1; moderate=4; low=0 | Revisar npm audit, actualizar dependencias o documentar excepciones justificadas. |
| NPM_OUTDATED_FRONTEND | LOW | Hay dependencias obsoletas en frontend. | @angular/build, @angular/cli, @angular/common, @angular/compiler, @angular/compiler-cli, @angular/core, @angular/forms, @angular/platform-browser, @angular/router, @lucide/angular, jsdom, prettier, typescript, vitest | Evaluar actualizaciones compatibles y probar build/test despues. |

### Checks OK

| Area | Check | Evidencia |
| --- | --- | --- |
| Seguridad | Existe backend/.env | backend/.env |
| Seguridad | .env no aparece en git status |  |
| Seguridad | No hay .env versionado |  |
| Seguridad | No se detectaron secretos en git diff |  |
| Seguridad | SESSION_IDLE_TIMEOUT_MINUTES valido | 60 |
| Seguridad | SESSION_IDLE_WARNING_MINUTES valido | 5 |

## Trazabilidad

### Hallazgos

| Codigo | Severidad | Descripcion | Evidencia | Recomendacion |
| --- | --- | --- | --- | --- |
| TRACE_EVENT_LINEA_CONSERVADA_POR_REPOSICION_MISSING | MEDIUM | No hay eventos registrados de tipo LINEA_CONSERVADA_POR_REPOSICION. | cantidad=0 | Confirmar si la funcionalidad aun no se usa o si falta registrar el evento. |

### Checks OK

| Area | Check | Evidencia |
| --- | --- | --- |
| Trazabilidad | Evento critico presente: VERIFICACION_MANUAL_EQUIPO | cantidad=21 |
| Trazabilidad | Evento critico presente: ASIGNAR_COLABORADOR | cantidad=508 |
| Trazabilidad | Evento critico presente: DEVOLVER_DISPOSITIVO | cantidad=29 |
| Trazabilidad | Evento critico presente: ASIGNAR_DEPARTAMENTO | cantidad=15 |
| Trazabilidad | Evento critico presente: SIM_ASOCIADA_A_DISPOSITIVO | cantidad=3 |
| Trazabilidad | Evento critico presente: LINEA_MOVIL_ASOCIADA_A_DISPOSITIVO | cantidad=35 |
| Trazabilidad | Evento critico presente: LINEA_MOVIL_NUMERO_ACTUALIZADO | cantidad=10 |
| Trazabilidad | Eventos sin responsable. | cantidad=0 |
| Trazabilidad | Eventos sin fecha. | cantidad=0 |
| Trazabilidad | Eventos criticos con metadata vacia. | cantidad=0 |
| Trazabilidad | Ultimos 20 eventos consultados | eventos=20 |

## Evidencia adicional

### Migraciones
- Aplicadas: 31
- Ultima: 032 technical_service_quotes
- Pendientes segun repo: 1
### Eventos criticos
| Evento | Cantidad |
| --- | ---: |
| VERIFICACION_MANUAL_EQUIPO | 21 |
| ASIGNAR_COLABORADOR | 508 |
| DEVOLVER_DISPOSITIVO | 29 |
| ASIGNAR_DEPARTAMENTO | 15 |
| SIM_ASOCIADA_A_DISPOSITIVO | 3 |
| LINEA_MOVIL_ASOCIADA_A_DISPOSITIVO | 35 |
| LINEA_CONSERVADA_POR_REPOSICION | 0 |
| LINEA_MOVIL_NUMERO_ACTUALIZADO | 10 |
### Ultimos 20 eventos
| ID | Entidad | Evento | Responsable | Fecha |
| --- | --- | --- | --- | --- |
| 3930 | DISPOSITIVO | GENERAR_ACTA_ENTREGA | Maria Jose Reyes | Tue Sep 22 2026 17:26:37 GMT-0300 (hora de verano de Chile) |
| 3929 | DISPOSITIVO | ASIGNAR_COLABORADOR | Maria Jose Reyes | Tue Sep 22 2026 17:26:37 GMT-0300 (hora de verano de Chile) |
| 3928 | DISPOSITIVO | GENERAR_ACTA_ENTREGA | Francisco Javier Ponce Barril | Tue Sep 22 2026 16:20:10 GMT-0300 (hora de verano de Chile) |
| 3927 | DISPOSITIVO | ASIGNAR_COLABORADOR | Francisco Javier Ponce Barril | Tue Sep 22 2026 16:20:10 GMT-0300 (hora de verano de Chile) |
| 3926 | DISPOSITIVO | EQUIPO_VERIFICADO_POR_REGISTRO_MANUAL | Francisco Javier Ponce Barril | Tue Sep 22 2026 16:20:01 GMT-0300 (hora de verano de Chile) |
| 3925 | DISPOSITIVO | ALTA_DISPOSITIVO | Francisco Javier Ponce Barril | Tue Sep 22 2026 16:20:01 GMT-0300 (hora de verano de Chile) |
| 3924 | SIM | SIM_ASOCIADA | Maria Jose Reyes | Tue Sep 22 2026 14:31:44 GMT-0300 (hora de verano de Chile) |
| 3923 | LINEA_MOVIL | LINEA_MOVIL_ASOCIADA_A_SIM | Maria Jose Reyes | Tue Sep 22 2026 14:31:44 GMT-0300 (hora de verano de Chile) |
| 3922 | SIM | NUMERO_TELEFONICO_REGISTRADO | Actualización de ficha SIM | Tue Sep 22 2026 14:30:21 GMT-0300 (hora de verano de Chile) |
| 3921 | LINEA_MOVIL | LINEA_MOVIL_ASOCIADA_A_SIM | Actualización de ficha SIM | Tue Sep 22 2026 14:30:21 GMT-0300 (hora de verano de Chile) |
| 3920 | LINEA_MOVIL | LINEA_MOVIL_CREADA | Actualización de ficha SIM | Tue Sep 22 2026 14:30:21 GMT-0300 (hora de verano de Chile) |
| 3919 | DISPOSITIVO | EQUIPO_VERIFICADO_POR_REGISTRO_MANUAL | Maria Jose Reyes | Tue Sep 22 2026 14:27:32 GMT-0300 (hora de verano de Chile) |
| 3918 | DISPOSITIVO | ALTA_DISPOSITIVO | Maria Jose Reyes | Tue Sep 22 2026 14:27:32 GMT-0300 (hora de verano de Chile) |
| 3917 | DISPOSITIVO | ACTUALIZAR_DISPOSITIVO | Francisco Javier Ponce Barril | Tue Sep 22 2026 12:54:05 GMT-0300 (hora de verano de Chile) |
| 3916 | DISPOSITIVO | GENERAR_ACTA_ENTREGA | Francisco Javier Ponce Barril | Tue Sep 22 2026 12:45:18 GMT-0300 (hora de verano de Chile) |
| 3915 | LINEA_MOVIL | LINEA_MOVIL_ASOCIADA_A_DISPOSITIVO | Francisco Javier Ponce Barril | Tue Sep 22 2026 12:45:18 GMT-0300 (hora de verano de Chile) |
| 3914 | LINEA_MOVIL | LINEA_MOVIL_CREADA | Francisco Javier Ponce Barril | Tue Sep 22 2026 12:45:18 GMT-0300 (hora de verano de Chile) |
| 3913 | DISPOSITIVO | ASIGNAR_COLABORADOR | Francisco Javier Ponce Barril | Tue Sep 22 2026 12:45:18 GMT-0300 (hora de verano de Chile) |
| 3912 | DISPOSITIVO | EQUIPO_VERIFICADO_POR_REGISTRO_MANUAL | Francisco Javier Ponce Barril | Tue Sep 22 2026 12:44:55 GMT-0300 (hora de verano de Chile) |
| 3911 | DISPOSITIVO | ALTA_DISPOSITIVO | Francisco Javier Ponce Barril | Tue Sep 22 2026 12:44:55 GMT-0300 (hora de verano de Chile) |

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
| OPS_LINE_WITHOUT_OWNER | SELECT COUNT(*)::int AS count FROM (SELECT id, numero_telefonico, estado FROM itam.lineas_moviles WHERE sim_id IS NULL AND dispositivo_id IS NULL AND colaborador_id IS NULL AND estado <> 'PENDIENTE_REPOSICION') audit_subquery |
| OPS_LINE_WITHOUT_OWNER sample | SELECT id, numero_telefonico, estado FROM itam.lineas_moviles WHERE sim_id IS NULL AND dispositivo_id IS NULL AND colaborador_id IS NULL AND estado <> 'PENDIENTE_REPOSICION' LIMIT 20 |
| OPS_PENDING_REPLACEMENT_WITH_SIM | SELECT COUNT(*)::int AS count FROM (SELECT id, numero_telefonico, sim_id FROM itam.lineas_moviles WHERE estado = 'PENDIENTE_REPOSICION' AND sim_id IS NOT NULL) audit_subquery |
| OPS_AUTOMATIC_MANUAL_VERIFICATION | SELECT COUNT(*)::int AS count FROM (SELECT id, dispositivo_id, fecha_evento, detalle FROM itam.historial_eventos WHERE tipo_evento = 'VERIFICACION_MANUAL_EQUIPO' AND (detalle->>'motivo' ILIKE '%operativ%' OR detalle->>'origen' ILIKE '%automatic%' OR detalle->>'automatico' = 'true')) audit_subquery |
| ultimos 20 eventos | SELECT id, tipo_entidad, tipo_evento, responsable, fecha_evento<br>       FROM itam.historial_eventos<br>       ORDER BY fecha_evento DESC, id DESC<br>       LIMIT 20 |

## Comandos ejecutados

| Comando | CWD | Exit | Resumen |
| --- | --- | ---: | --- |
| git status --short | . | 0 |  M docs/PRODUCTION_CHECKLIST.md<br> M docs/api/ITAM_API_MVP.md<br> M docs/api/ITAM_CODES_AND_LABELS.md<br> M docs/bitacoras/bitacora-2026-08-24-a-2026-09-22.md<br>?? docs/README.md<br>?? docs/api/ACTAS_ENTREGA.md<br>?? docs/api/AUTH.md<br>?? docs/api/COLABORADORES.md<br>?? docs/api/DASHBOARD.md<br>?? docs/api/DEPARTAMENTOS.md<br>?? docs/api/DISPOSITIVOS.md<br>?? docs/api/ERRORES_HTTP.md<br>?? docs/api/OFFBOARDING.md<br>?? docs/api/README.md<br>?? docs/api/SERVICIO_TECNICO.md<br>?? docs/api/SIM_LINEAS.md<br>?? docs/arquitectura/ARQUITECTURA_GE... [truncado] |
| git ls-files | . | 0 | .gitignore<br>1.-ESTRUCTURA ESSSI.xlsx<br>README.md<br>"ave ITAM progress before final QA\357\200\242"<br>backend/.env.example<br>backend/=<br>backend/package-lock.json<br>backend/package.json<br>backend/reports/auditoria-verificaciones-automaticas.csv<br>backend/src/app.ts<br>backend/src/config/database.ts<br>backend/src/config/env.ts<br>backend/src/modules/actas-entrega/actas-entrega.controller.ts<br>backend/src/modules/actas-entrega/actas-entrega.repository.ts<br>backend/src/modules/actas-entrega/actas-entrega.routes.ts<br>backend/src/m... [truncado] |
| git diff --cached --no-ext-diff && git diff --no-ext-diff | . | 0 | diff --git a/docs/PRODUCTION_CHECKLIST.md b/docs/PRODUCTION_CHECKLIST.md<br>index b150a1f..b33e482 100644<br>--- a/docs/PRODUCTION_CHECKLIST.md<br>+++ b/docs/PRODUCTION_CHECKLIST.md<br>@@ -1,40 +1,100 @@<br>-# Checklist de producción — ITAM v3.0<br>-<br>-## Antes del despliegue<br>-<br>-- [ ] Realizar un backup completo y verificable de PostgreSQL, sin contraseñas embebidas en scripts.<br>-- [ ] Confirmar la versión registrada en `itam.schema_migrations` y que la siguiente migración sea la esperada.<br>-- [ ] Configurar `NODE_E... [truncado] |
| npm audit --json | backend | 1 | {<br>  "auditReportVersion": 2,<br>  "vulnerabilities": {<br>    "multer": {<br>      "name": "multer",<br>      "severity": "high",<br>      "isDirect": true,<br>      "via": [<br>        {<br>          "source": 1193790,<br>          "name": "multer",<br>          "dependency": "multer",<br>          "title": "multer vulnerable to Denial of Service via crafted multipart field names",<br>          "url": "https://github.com/advisories/GHSA-wc9g-mqfw-jrwm",<br>          "severity": "high",<br>          "cwe": [<br>            "CWE-248"<br>      ... [truncado] |
| npm outdated --json | backend | 1 | {<br>  "@types/node": {<br>    "current": "26.2.0",<br>    "wanted": "26.6.2",<br>    "latest": "26.6.2",<br>    "dependent": "backend",<br>    "location": "E:\\Aguas San Isidro V2\\ITAM\\backend\\node_modules\\@types\\node"<br>  },<br>  "@types/pg": {<br>    "current": "8.21.0",<br>    "wanted": "8.23.1",<br>    "latest": "8.23.1",<br>    "dependent": "backend",<br>    "location": "E:\\Aguas San Isidro V2\\ITAM\\backend\\node_modules\\@types\\pg"<br>  },<br>  "dotenv": {<br>    "current": "17.4.2",<br>    "wanted": "17.4.2",<br>    "latest": "18.0... [truncado] |
| npm audit --json | frontend | 1 | {<br>  "auditReportVersion": 2,<br>  "vulnerabilities": {<br>    "@vitest/mocker": {<br>      "name": "@vitest/mocker",<br>      "severity": "moderate",<br>      "isDirect": false,<br>      "via": [<br>        {<br>          "source": 1193684,<br>          "name": "@vitest/mocker",<br>          "dependency": "@vitest/mocker",<br>          "title": "Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock",<br>          "url": "https://github.com/advisories/GHSA-82fw-gwwq-j7x9",<br>          "severity": "moderate",<br> ... [truncado] |
| npm outdated --json | frontend | 1 | {<br>  "@angular/build": {<br>    "current": "22.1.4",<br>    "wanted": "22.1.8",<br>    "latest": "22.1.8",<br>    "dependent": "frontend",<br>    "location": "E:\\Aguas San Isidro V2\\ITAM\\frontend\\node_modules\\@angular\\build"<br>  },<br>  "@angular/cli": {<br>    "current": "22.1.4",<br>    "wanted": "22.1.8",<br>    "latest": "22.1.8",<br>    "dependent": "frontend",<br>    "location": "E:\\Aguas San Isidro V2\\ITAM\\frontend\\node_modules\\@angular\\cli"<br>  },<br>  "@angular/common": {<br>    "current": "22.1.2",<br>    "wanted": "22.... [truncado] |
| node --version | . | 0 | v24.19.0<br> |
| npm --version | . | 0 | 11.17.0<br> |
| powershell -NoProfile -Command "(Get-PSDrive -Name 'E').Free" | . | 0 | 313043693568<br> |
| git status --short | . | 0 |  M docs/PRODUCTION_CHECKLIST.md<br> M docs/api/ITAM_API_MVP.md<br> M docs/api/ITAM_CODES_AND_LABELS.md<br> M docs/bitacoras/bitacora-2026-08-24-a-2026-09-22.md<br>?? docs/README.md<br>?? docs/api/ACTAS_ENTREGA.md<br>?? docs/api/AUTH.md<br>?? docs/api/COLABORADORES.md<br>?? docs/api/DASHBOARD.md<br>?? docs/api/DEPARTAMENTOS.md<br>?? docs/api/DISPOSITIVOS.md<br>?? docs/api/ERRORES_HTTP.md<br>?? docs/api/OFFBOARDING.md<br>?? docs/api/README.md<br>?? docs/api/SERVICIO_TECNICO.md<br>?? docs/api/SIM_LINEAS.md<br>?? docs/arquitectura/ARQUITECTURA_GE... [truncado] |
| git diff --check | . | 0 | warning: in the working copy of 'docs/PRODUCTION_CHECKLIST.md', LF will be replaced by CRLF the next time Git touches it<br>warning: in the working copy of 'docs/api/ITAM_API_MVP.md', LF will be replaced by CRLF the next time Git touches it<br>warning: in the working copy of 'docs/api/ITAM_CODES_AND_LABELS.md', LF will be replaced by CRLF the next time Git touches it<br>warning: in the working copy of 'docs/bitacoras/bitacora-2026-08-24-a-2026-09-22.md', LF will be replaced by CRLF the next time Git touc... [truncado] |
| npm run build | backend | 0 | <br>> backend@1.0.0 build<br>> tsc<br><br> |
| npm run typecheck | backend | 0 | <br>> backend@1.0.0 typecheck<br>> tsc --noEmit<br><br> |
| npm test | backend | 0 | <br>> backend@1.0.0 test<br>> tsc && node --test --test-concurrency=1 dist/modules/*/*.test.js<br><br>◇ injected env (9) from .env // tip: ⌘ enable debugging { debug: true }<br>✔ P1-09: con credenciales pendientes solo se permiten endpoints minimos (0.9998ms)<br>✔ P1-09: cinco fallos de password activan el bloqueo temporal (0.1852ms)<br>✔ QA-09: utiliza exclusivamente el nombre de la sesión autenticada (1.0195ms)<br>✔ QA-09: bloquea la operación cuando no existe una sesión identificable (0.5458ms)<br>◇ injected env (9) fr... [truncado] |
| npm run build | frontend | 1 | <br>> frontend@0.0.0 build<br>> ng build<br><br>❯ Building...<br>✔ Building...<br>Initial chunk files \| Names                  \|  Raw size \| Estimated transfer size<br>main-U5ATXOKC.js    \| main                   \| 352.77 kB \|                43.52 kB<br>chunk-m8Qjw6aX.js   \| -                      \| 184.62 kB \|                54.31 kB<br>styles-AALPSMGD.css \| styles                 \|  14.07 kB \|                 3.19 kB<br><br>                    \| Initial total          \| 551.46 kB \|               101.02 kB<br><br>Lazy chunk files ... [truncado] |
| npm run test -- --watch=false | frontend | 0 | <br>> frontend@0.0.0 test<br>> ng test --watch=false<br><br>❯ Building...<br>✔ Building...<br>Initial chunk files                                   \| Names                                              \|  Raw size<br>spec-app-features-workflow-helpers.js                 \| spec-app-features-workflow-helpers                 \| 279.43 kB \| <br>chunk-SMVKLDSK.js                                     \| -                                                  \| 263.09 kB \| <br>spec-app-features-dashboard-dashboard.js              \| spe... [truncado] |

## Recomendaciones finales

- Corregir primero CRITICAL y HIGH; el auditor saldra con codigo 1 mientras existan.
- Revisar MEDIUM antes de despliegues o respaldos operacionales.
- Mantener secretos fuera de Git y rotar cualquier secreto que haya aparecido en diff o archivos versionados.
- No ejecutar migraciones sin respaldo y sin revisar el resultado de esta auditoria.

## Checklist antes de commit

- [ ] git status solo contiene cambios esperados.
- [ ] git diff --check pasa sin errores.
- [ ] No hay .env ni secretos en el indice, diff o archivos versionados.
- [ ] backend build/typecheck/test revisados.
- [ ] frontend build/typecheck/test revisados segun scripts disponibles.
- [ ] El informe de auditoria fue leido y los hallazgos bloqueantes fueron resueltos o documentados.

## Checklist antes de produccion

- [ ] NODE_ENV=production.
- [ ] CORS_ORIGIN usa origen explicito.
- [ ] JWT_SECRET y SESSION_SECRET existen y son robustos.
- [ ] PostgreSQL responde y schema itam esta completo.
- [ ] Migraciones aplicadas coinciden con database/migrations.
- [ ] Health checks del backend y base de datos responden.
- [ ] No hay inconsistencias criticas de custodia, lineas moviles, SIM o historial.
- [ ] Hay respaldo vigente antes de cambios de base de datos.
