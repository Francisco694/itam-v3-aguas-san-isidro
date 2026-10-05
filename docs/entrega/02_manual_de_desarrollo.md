# Manual de Desarrollo

> Archivo histórico conservado por compatibilidad. La fuente canónica de entrega es [`02_Manual_de_Desarrollo_Aguas_San_Isidro.md`](02_Manual_de_Desarrollo_Aguas_San_Isidro.md).

## Propósito y alcance

Este manual resume la estructura técnica y el ciclo de desarrollo verificable del repositorio ITAM v3.0. No reemplaza los contratos API ni las decisiones de arquitectura existentes.

## Identidad del sistema

| Campo | Valor seguro | Estado |
| --- | --- | --- |
| Repositorio principal | `https://github.com/Aguas-San-Isidro/ITAM_esssi.git` | Confirmado |
| Repositorio secundario configurado | `https://github.com/Francisco694/itam-v3-aguas-san-isidro.git` | Confirmado |
| Rama consultada | `main` | Confirmado |
| Commit consultado | `d98da1223838be87ec48302a8c5427b88ee45bf7` | Confirmado |
| Mensaje del commit | `fix: completa permisos de solo lectura` | Confirmado |
| Fecha del commit | 2026-10-02 11:44:11 -03:00 | Confirmado |
| Autor documentado | `Francisco694` en `README.md` y commit | Confirmado |
| Consulta documental | 2026-10-02, aproximadamente 15:30 -03:00 | Confirmado |

El árbol local tenía cuatro artefactos `.tar.gz` sin seguimiento al momento de la consulta. Por ello no se debe declarar el árbol limpio.

## Stack

| Capa | Tecnología y versión declarada |
| --- | --- |
| Frontend | Angular `^22.1.0`, CLI/build `^22.1.4`, TypeScript `~6.0.2` |
| Backend | Node.js, TypeScript `^7.0.2`, Express `^5.2.1` |
| Persistencia | PostgreSQL mediante `pg ^8.23.0` |
| Archivos y PDF | `multer`, `pdfkit`, `read-excel-file` |
| UI | `@lucide/angular`, RxJS `~7.8.0`, QRCode y ZXing |
| CI/CD | GitHub Actions, Node.js 24, AWS por SSH/SCP |
| Package manager | npm; frontend declara `npm@11.17.0` |

## Estructura principal

- `frontend/`: aplicación Angular, rutas, componentes, servicios, modelos y pruebas.
- `backend/`: API Express, módulos por dominio, servicios, repositorios, validación, autenticación, scripts y pruebas.
- `database/migrations/`: migraciones SQL numeradas; la secuencia instalada incluye 001 a 035 con excepciones documentadas.
- `docs/api/`: contratos de endpoints.
- `docs/arquitectura/`: arquitectura, seguridad, reglas de negocio y base de datos.
- `docs/database/`: estado y procedimiento de migraciones.
- `docs/ci/`: alcance de CI y limitaciones de pruebas integradas.
- `.github/workflows/ci.yml`: compilación y validación.
- `.github/workflows/cd.yml`: empaquetado y despliegue a AWS.
- `reports/`: informes de auditoría y rendimiento.

## Variables de entorno esperadas

El backend exige `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. También reconoce `NODE_ENV`, `BACKEND_HOST`, `PORT`, `CORS_ORIGIN`, `SESSION_IDLE_TIMEOUT_MINUTES`, `SESSION_IDLE_WARNING_MINUTES` y `DOCUMENT_STORAGE_PATH`. Los nombres de variables de bootstrap de usuarios están documentados en `backend/.env.example`.

Los valores no se incluyen en este documento.

## Comandos reales

### Backend

```text
npm ci
npm run typecheck
npm run build
npm test
npm start
```

El entrypoint compilado es `backend/dist/server.js`; el fuente es `backend/src/server.ts`.

### Frontend

```text
npm ci
npm run build
npm test
npm start
npm run start:lan
```

El build de producción se genera en `frontend/dist/frontend/browser/index.html`.

### CI

El workflow de CI ejecuta `npm ci`, `npm run typecheck` y `npm run build` en backend, y `npm ci`, `npm run build` y la verificación de `index.html` en frontend. No ejecuta `npm test` en GitHub Actions porque las pruebas backend de integración requieren una base reproducible y fixtures.

## Calidad y pruebas

- Backend: typecheck y build fueron correctos en la validación del commit `d98da12`.
- Frontend: build de producción y pruebas frontend fueron correctos en la validación local; la batería frontend reportada fue de 86 pruebas aprobadas.
- CI de GitHub: el job de validación y compilación del commit `d98da12` terminó correctamente.
- Pruebas backend integradas en CI: pendientes de habilitar con fixtures y preparación reproducible.
- El build frontend mostró una advertencia no bloqueante por superar el presupuesto inicial de 500 kB.

## Riesgos técnicos

1. `docs/ci/CI.md` documenta una anomalía histórica de la migración 029 y la ausencia de fixtures reproducibles.
2. La documentación anterior de base de datos describe estados hasta 032; la fuente actual contiene además 033, 034 y 035.
3. No existe checksum de migraciones en `schema_migrations`.
4. No se verificó en esta sesión la cobertura de código.
5. El repositorio contiene artefactos `.tar.gz` sin seguimiento que deben revisarse antes de cualquier commit documental.

## Fuentes y clasificación

| Evidencia | Fuente | Estado |
| --- | --- | --- |
| Versiones y scripts | `backend/package.json`, `frontend/package.json` | Confirmado |
| CI/CD | `.github/workflows/ci.yml`, `.github/workflows/cd.yml` | Confirmado |
| Resultado de CI/CD | Ejecución GitHub Actions del commit `d98da12` | Confirmado |
| Cobertura | No existe resultado verificable en la sesión | Pendiente de validar con Codex |
