# Manual de Desarrollo Aguas San Isidro

## Propósito

Este documento describe la estructura técnica comprobada del repositorio ITAM y las reglas mínimas para desarrollar, probar y publicar cambios.

## Identidad y estado de la fuente

| Dato | Valor | Estado |
| --- | --- | --- |
| Repositorio principal | `https://github.com/Aguas-San-Isidro/ITAM_esssi.git` | Confirmado |
| Rama | `main` | Confirmado |
| Commit auditado | `754d036f00aa24b180c3812c460a2b18bd82b1a5` | Confirmado |
| Mensaje | `chore: confirma persistencia de OT correlativas` | Confirmado |
| Fecha del commit | 2026-10-05 15:48:27 -03:00 | Confirmado |
| Autor documentado | `Francisco694` | Confirmado en README e historial |
| Árbol de trabajo | Contiene artefactos `.tar.gz` sin seguimiento | Confirmado |

## Tecnologías y versiones

| Capa | Evidencia | Estado |
| --- | --- | --- |
| Backend | Express `^5.2.1`, TypeScript `^7.0.2`, `pg ^8.23.0`, PDFKit `^0.19.1` | Confirmado en `backend/package.json` |
| Frontend | Angular `^22.1.0`, CLI/build `^22.1.4`, TypeScript `~6.0.2`, RxJS `~7.8.0` | Confirmado en `frontend/package.json` |
| Runtime CI/CD | Node.js 24 y npm | Confirmado en workflows |
| Base de datos | PostgreSQL, esquema `itam` | Confirmado en configuración y SQL |

## Estructura

- `backend/src/server.ts`: entrada del servidor.
- `backend/src/app.ts`: middlewares, health checks y montaje de rutas.
- `backend/src/modules/`: módulos por dominio, con rutas, controladores, servicios, repositorios y tipos.
- `backend/src/modules/servicio-tecnico/servicio-tecnico.pdf.ts`: generador de PDF de OT.
- `frontend/src/app/app.routes.ts`: rutas Angular.
- `frontend/src/app/features/`: pantallas funcionales.
- `frontend/src/app/core/`: autenticación, guards, servicios, modelos y configuración.
- `database/migrations/`: cambios SQL ordenados y registrados por versión.
- `docs/`: documentación de API, arquitectura, base de datos, diagramas y entrega.

## Reglas de implementación

1. Mantener la validación en backend aunque exista validación equivalente en Angular.
2. Usar el repositorio del módulo para consultas y el servicio para reglas de negocio.
3. Registrar mutaciones relevantes en `itam.auditoria_operaciones` mediante el middleware y los eventos de dominio.
4. No exponer secretos en código, documentación, logs ni respuestas.
5. Agregar una migración nueva; no editar una migración histórica ya aplicada sin un procedimiento explícito.
6. Mantener el rol `SOLO_LECTURA` protegido por `rejectReadOnlyMutations` y por las restricciones visuales del frontend.

## API y módulos

La API se monta bajo `/api/v1`. Los módulos principales son autenticación, estados, departamentos, colaboradores, dispositivos, SIM, familias de códigos, tipos de dispositivo, servicio técnico, actas, comprobantes, reportes, facturas, usuarios, offboarding y alertas de stock. El detalle de métodos y payloads se mantiene en `docs/api/`.

La aplicación expone health checks públicos en `/api/v1/health` y `/api/v1/health/database`. El resto de las rutas exige sesión; la administración de usuarios exige `SUPER_USUARIO`.

## Configuración

El backend exige `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`. También reconoce `NODE_ENV`, `BACKEND_HOST`, `PORT`, `CORS_ORIGIN`, `SESSION_IDLE_TIMEOUT_MINUTES`, `SESSION_IDLE_WARNING_MINUTES` y `DOCUMENT_STORAGE_PATH`. Este documento solo menciona nombres de variables; los valores deben permanecer fuera del repositorio.

## Comandos comprobados

```text
backend: npm ci
backend: npm run typecheck
backend: npm run build
backend: npm test
backend: npm start
frontend: npm ci
frontend: npm run build
frontend: npm test
frontend: npm start
```

El CI actual ejecuta typecheck y build del backend, build del frontend y verifica `frontend/dist/frontend/browser/index.html`. No ejecuta `npm test` backend en CI porque sus pruebas de integración requieren PostgreSQL y fixtures reproducibles.

## Orden de trabajo PDF

El endpoint `GET /api/v1/servicio-tecnico/:id/envio/pdf` delega en `buildTechnicalOrderPdf`. El generador acepta la fila de la orden y una colección opcional `equipos`, usa A4, logo, Arial si está disponible, tablas blancas con borde gris claro, casillas, firmas y pie. La sección interna es exactamente `5. RECEPCIÓN Y DEVOLUCIÓN (INTERNO)`. El número correlativo proviene de `numero_ot`; la OT-163 es solo un caso de prueba, no una constante.

## Calidad y pruebas

| Validación | Estado de esta auditoría |
| --- | --- |
| Typecheck backend | Confirmado en esta sesión; `tsc --noEmit` terminó con código 0 |
| Build backend | Confirmado en esta sesión; `tsc` y copia de assets PDF terminaron con código 0 |
| Tests backend | Confirmado; `npm test` ejecutó 113 casos, 113 pasan y 0 fallan |
| Build frontend | Confirmado en esta sesión; `ng build` terminó con código 0, con advertencia de presupuesto del bundle inicial |
| Tests frontend | No encontrado; no existen archivos `*.spec.ts`/`*.test.ts` bajo `frontend/src`; `ng test --watch=false` inició el runner sin casos y no cerró automáticamente |
| Prueba PDF con OT-163, vacíos, texto largo y varios equipos | Debe ejecutarse con fixture aislado |

## Fuentes relacionadas

- `docs/MAPA_MAESTRO_DE_DOCUMENTACION.md`
- `docs/arquitectura/ARQUITECTURA_GENERAL.md`
- `docs/api/README.md`
- `05_Versionado_de_Base_de_Datos.md`
- `06_Versionado_del_Frontend.md`
