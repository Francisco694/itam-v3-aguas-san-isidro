# ITAM Aguas San Isidro

Sistema de gestión de activos tecnológicos para Aguas San Isidro: inventario, custodias, colaboradores, departamentos, SIM, líneas móviles, servicio técnico, actas, comprobantes, offboarding, reportes y auditoría.

## Estado actual

Fuente auditada: rama `main`, commit `754d036f00aa24b180c3812c460a2b18bd82b1a5`, 2026-10-05. El sistema contiene frontend Angular, backend Express, PostgreSQL y workflows de CI/CD. La verificación del entorno productivo, backups, DNS, firewall, certificados y restauración queda pendiente mientras no exista evidencia autorizada.

## Tecnologías y requisitos

- Frontend: Angular 22, TypeScript 6 y RxJS.
- Backend: Node.js, Express 5, TypeScript 7, PostgreSQL y PDFKit.
- CI/CD: GitHub Actions, Node.js 24, SSH/SCP, PM2 y Nginx según workflow.
- PostgreSQL con esquema `itam`.
- Variables backend requeridas: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD`.

## Instalación y ejecución

En `backend`: `npm ci`, `npm run typecheck`, `npm run build`, `npm test` y `npm start`.

En `frontend`: `npm ci`, `npm run build`, `npm test`, `npm start` o `npm run start:lan`.

CI ejecuta typecheck y build backend, build frontend y verifica `frontend/dist/frontend/browser/index.html`. Las pruebas backend de integración requieren PostgreSQL y fixtures reproducibles, por lo que no forman parte del workflow CI actual.

## Estructura

- `backend/`: API, módulos, servicios, repositorios y pruebas.
- `frontend/`: aplicación Angular y componentes.
- `database/migrations/`: migraciones 001 a 036.
- `docs/api/`: contratos de endpoints.
- `docs/arquitectura/`: arquitectura, seguridad y reglas.
- `docs/diagramas/`: diagramas Mermaid de respaldo.
- `docs/entrega/`: fuentes Markdown de entrega.
- `salida_documentacion/`: entregable Word y PDF de referencia.
- `.github/workflows/`: CI y CD.

## Documentación de entrega

- [Mapa maestro](docs/MAPA_MAESTRO_DE_DOCUMENTACION.md)
- [Matriz de validación](docs/MATRIZ_DE_VALIDACION_DOCUMENTAL.md)
- [Informe final de validación](docs/INFORME_FINAL_DE_VALIDACION.md)
- [Manual de usuario fuente](docs/entrega/01_manual_de_usuario.md)
- [Manual de desarrollo](docs/entrega/02_Manual_de_Desarrollo_Aguas_San_Isidro.md)
- [Servidor e infraestructura](docs/entrega/03_Informacion_del_Servidor_e_Infraestructura.md)
- [Procedimientos](docs/entrega/04_Procedimientos_Operativos_y_Tecnicos.md)
- [Versionado de base de datos](docs/entrega/05_Versionado_de_Base_de_Datos.md)
- [Versionado del frontend](docs/entrega/06_Versionado_del_Frontend.md)
- [Esquemático del sistema](docs/entrega/07_Esquematico_del_Sistema.md)
- [Arquitectura de la aplicación](docs/entrega/08_Arquitectura_de_la_Aplicacion.md)
- [Documentación API](docs/api/README.md)
- [Documentación de arquitectura](docs/arquitectura/README.md)
- [Documentación de base de datos](docs/database/README.md)

## Entregables

El único documento Word de salida debe ser `salida_documentacion/01_Manual_Usuario_Aguas_San_Isidro.docx`. Los documentos 02–08 se entregan en Markdown dentro de `docs/entrega/`. El PDF de la orden de trabajo se conserva como evidencia visual independiente y se genera dinámicamente por el backend.

## Pendientes conocidos

- Validar en servidor región, tipo de instancia, dominio, DNS, Nginx, PM2, PostgreSQL, TLS, firewall, backups, logs y restauración.
- Ejecutar smoke tests autorizados contra la API desplegada con una OT vacía, una OT con varios equipos, texto largo y caso listo para imprimir.
- Crear pruebas unitarias del frontend; actualmente no se encontraron archivos `*.spec.ts`/`*.test.ts` bajo `frontend/src`.
- Reducir la advertencia del presupuesto del bundle inicial del frontend o documentar formalmente su excepción.
- Retirar o archivar los artefactos `.tar.gz` sin seguimiento antes de un commit documental.

## Autor

`Francisco694` es el autor documentado en el README histórico y en el historial consultado.
