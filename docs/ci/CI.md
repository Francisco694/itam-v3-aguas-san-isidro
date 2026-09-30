# Estado de CI/CD

**Fecha del análisis:** 30 de septiembre de 2026
**Alcance:** primera etapa de integración continua
**Estado:** Fase 1 implementada; Fase 2 de pruebas PostgreSQL pendiente

## Configuración inspeccionada

- Backend: `backend/package.json` usa `npm ci`, `npm run typecheck`, `npm test` y `npm run build`.
- Frontend: `frontend/package.json` usa `npm ci` y `npm run build`.
- Node requerido para CI: Node.js 24.
- Lockfiles presentes: `backend/package-lock.json` y `frontend/package-lock.json`.
- Salida Angular esperada: `frontend/dist/frontend/browser/index.html`.
- El backend requiere `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` al cargar su configuración.
- Las pruebas usan `node:test` y se ejecutan compiladas desde `dist/modules/*/*.test.js`, con concurrencia 1.

## Fase 1: CI de validación y compilación

El workflow `.github/workflows/ci.yml` ya está creado. Se ejecuta en cada `push` y `pull_request` dirigido a `main` y contiene dos jobs independientes:

- Backend: `npm ci`, `npm run typecheck` y `npm run build`.
- Frontend: `npm ci`, `npm run build` y verificación de `frontend/dist/frontend/browser/index.html`.

Ambos jobs usan Node.js 24 y la caché de npm basada en el lockfile real de cada aplicación. Si una instalación, validación o compilación falla, el job falla.

Este workflow se identifica deliberadamente como CI de validación y compilación. No ejecuta `npm test` ni necesita PostgreSQL.

## Fase 2: impedimento para la batería completa de pruebas

El backend mezcla pruebas unitarias con pruebas de integración PostgreSQL. Las pruebas de integración importan directamente el pool de `backend/src/config/database.ts` y consultan o modifican tablas reales del esquema `itam`.

El repositorio actualmente no contiene todos los elementos necesarios para reproducir el entorno local:

- `database/seeds` no contiene fixtures de prueba.
- Las migraciones crean el esquema y algunos catálogos, pero no cargan el conjunto de dispositivos, colaboradores, usuarios y custodias que varias pruebas requieren.
- No existe un runner de migraciones ni un script oficial para preparar una base de pruebas.
- La migración `029` está pendiente y fuera de secuencia, mientras `030`–`032` aparecen aplicadas en desarrollo.
- `029` no puede ejecutarse directamente porque migraciones posteriores ya agregaron parte de sus cambios y todavía faltan `tipo_servicio` y `accesorios_entregados`.

Por lo tanto, aplicar mecánicamente `001`–`028` y `030`–`032` en PostgreSQL 16 produciría un esquema incompleto para la batería actual y no reproduciría el estado de datos que las pruebas esperan. No se debe presentar esa ejecución como equivalente al entorno local ni omitir silenciosamente las pruebas de integración.

## Qué falta antes de habilitar el CI completo

Se necesita una de estas soluciones explícitas, revisada por el proyecto:

1. Un fixture SQL de pruebas, seguro y versionado, que cargue únicamente datos sintéticos mínimos.
2. Un mecanismo de preparación de una base de pruebas que documente cómo resolver la anomalía histórica de `029` sin modificar las migraciones existentes.
3. Una separación clara entre pruebas unitarias y de integración, con comandos independientes y una política visible para cada grupo.

La solución debe ejecutarse únicamente contra el servicio temporal PostgreSQL 16 de GitHub Actions, nunca contra `itam_dev` ni `itam_prod`.

## Diseño previsto del workflow

Cuando exista una base de pruebas reproducible, `.github/workflows/ci.yml` deberá:

- ejecutarse en cada `push` y `pull_request` hacia `main`;
- usar Node.js 24;
- ejecutar `npm ci` en backend y frontend;
- ejecutar en backend `npm run typecheck`, `npm test` y `npm run build`;
- ejecutar `npm run build` en frontend;
- iniciar PostgreSQL 16 como servicio temporal para las pruebas de integración;
- configurar variables efímeras (`DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`) sin secretos de producción;
- verificar `frontend/dist/frontend/browser/index.html` después del build;
- fallar explícitamente si la preparación del esquema o de los fixtures no es reproducible.

La batería completa no se habilita todavía porque faltan los fixtures y el mecanismo seguro de preparación de la base. El workflow de Fase 1 no omite pruebas silenciosamente: simplemente tiene un alcance explícito de compilación y validación estática.

## Clasificación de las 107 pruebas backend

El análisis de los archivos `backend/src/**/*.test.ts` identificó:

| Grupo | Archivos | Pruebas | Características |
| --- | ---: | ---: | --- |
| Unitarias o de servicio sin PostgreSQL | 13 | 54 | Ejecutan lógica en memoria o usan dobles tipados y no abren conexiones. |
| Integración con PostgreSQL | 9 | 53 | Importan `pool`, consultan `itam` y/o ejecutan SQL. |
| Total | 22 | 107 | La cifra coincide con la batería local informada. |

Archivos sin conexión PostgreSQL: `authenticated-actor.test.ts`, `auth-security.test.ts`, `inventory-reconciliation.test.ts`, `rut.test.ts`, `departamentos.service.test.ts`, `device-traceability.test.ts`, `p1-integrity.test.ts`, `physical-verifications.test.ts`, `verification-backfill.test.ts`, `dynamic-attributes.test.ts`, `inventory-code.test.ts`, `lineas-moviles.service.test.ts` y `sim-phone.test.ts`.

Archivos que abren PostgreSQL en tiempo de ejecución: `change-password.integration.test.ts`, `custody-history.integration.test.ts`, `disposal-dashboard.integration.test.ts`, `device-type.integration.test.ts`, `inventory-code.integration.test.ts`, `inventory-family.integration.test.ts`, `offboarding.integration.test.ts`, `lifecycle.integration.test.ts` y `stock-alerts.test.ts`.

De esos nueve archivos, ocho ejecutan `INSERT`, `UPDATE` o generan datos de prueba dentro de transacciones con rollback. `stock-alerts.test.ts` principalmente lee el catálogo y el inventario existente. `change-password.integration.test.ts` crea su propio usuario y sesión, pero necesita que el esquema de autenticación exista. `custody-history`, `disposal-dashboard`, `device-type`, `inventory-code`, `inventory-family`, `offboarding` y `lifecycle` necesitan filas preexistentes para poder seleccionar dispositivos, estados, colaboradores, departamentos, familias o usuarios válidos. `inventory-reconciliation.test.ts` solo importa `PoolClient` como tipo y usa dobles en memoria; no abre PostgreSQL.

Las comprobaciones explícitas de historial consultan la versión `008` y el grupo `009`–`012` desde `lifecycle.integration.test.ts`, y la versión `022` desde `offboarding.integration.test.ts`.

Las pruebas PostgreSQL se dividen además en:

- pruebas que crean sus propios registros dentro de transacciones y hacen `ROLLBACK`;
- pruebas que necesitan datos preexistentes, como dispositivos, colaboradores, departamentos, usuarios, custodias, estados y catálogos;
- pruebas que comprueban versiones o efectos concretos de las migraciones `008` y `009`–`012`, además de `022`.

No existe actualmente un comando auxiliar para crear, migrar, sembrar y limpiar una base temporal. Tampoco existe un runner de migraciones.

## Estrategia mínima para Fase 2

La estrategia propuesta para GitHub Actions es usar PostgreSQL 16 como servicio temporal, configurar variables efímeras y preparar una base aislada exclusivamente para CI. Antes de habilitarla se debe:

1. Definir un fixture sintético mínimo, sin copiar datos empresariales.
2. Identificar las filas mínimas requeridas por cada prueba que consulta datos preexistentes.
3. Resolver documentalmente la preparación del esquema alrededor de `029`, sin modificar migraciones históricas ni ejecutar una secuencia selectiva sin verificación.
4. Ejecutar la batería completa con `npm test` y fallar si la preparación o cualquier prueba falla.
5. Limpiar la base temporal al finalizar el job.

Aplicar solo `001`–`028` y `030`–`032` no es suficiente: reproduce parte del historial, pero deja el esquema sin `tipo_servicio` y `accesorios_entregados` y no carga los datos preexistentes que varias pruebas exigen.

## Seguridad

No se utilizaron archivos `.env` reales, contraseñas, secretos AWS ni conexiones a `itam_dev` o `itam_prod` para esta fase. No se modificaron backend, frontend, migraciones ni bases de datos.
