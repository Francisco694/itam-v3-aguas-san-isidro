# Checklist de Entrega

> Archivo histórico conservado por compatibilidad. El cierre documental vigente está en `docs/INFORME_FINAL_DE_VALIDACION.md` y `docs/MATRIZ_DE_VALIDACION_DOCUMENTAL.md`.

## Identidad de la entrega

| Campo | Valor | Estado |
| --- | --- | --- |
| Sistema | ITAM v3.0 - Aguas San Isidro | Confirmado |
| Commit | `d98da1223838be87ec48302a8c5427b88ee45bf7` | Confirmado |
| Release activo | `d98da12` | Confirmado |
| Fecha de consulta | 2026-10-02 | Confirmado |
| Árbol local | Cuatro `.tar.gz` sin seguimiento | Confirmado |
| Responsable documentado | `Francisco694` | Confirmado |

## Resultado de entrega

| Control | Evidencia resumida | Estado | Responsable sugerido | Fecha objetivo | Acción siguiente |
| --- | --- | --- | --- | --- | --- |
| Código publicado | Push del commit `d98da12` a `aguas/main` | Confirmado | Desarrollo | Completado | Conservar enlace de ejecución |
| CI | Backend y frontend compilaron correctamente | Confirmado | Desarrollo | Completado | Mantener CI en cada push |
| CD | Job de despliegue terminó `success` | Confirmado | Operaciones TI | Completado | Revisar logs posteriores |
| Backend activo | `/opt/itam/releases/d98da12/backend/dist/server.js` | Confirmado | Operaciones TI | Completado | Verificar PM2 con acceso de lectura |
| Frontend activo | Artefacto estático del release | Confirmado por CD | Operaciones TI | Completado | Validar navegador real |
| Migración 035 | Incluida en artefacto y ejecutada por CD | Confirmado por workflow | DBA / Operaciones TI | Completado | Confirmar `schema_migrations` productivo |
| Perfil `SOLO_LECTURA` | Restricción backend y UI implementadas | Confirmado en código | Desarrollo / QA | Completado | Probar con cuenta de prueba |
| Health API | Validado por CD contra `127.0.0.1:3000` | Confirmado | Operaciones TI | Completado | Mantener monitoreo |
| Health PostgreSQL | Endpoint disponible; resultado productivo no observado en esta recopilación | Pendiente | DBA | 2026-10-03 | Consultar endpoint sin divulgar credenciales |
| Backup productivo | No se observó backup ni restauración de prueba | Pendiente | DBA | 2026-10-03 | Registrar archivo, fecha, retención y prueba |
| Nginx/TLS | El workflow ejecuta `nginx -t`; configuración real no fue leída | Pendiente | Operaciones TI | 2026-10-03 | Revisar configuración y certificado |
| Firewall/Security Group | No observado | Pendiente | Administrador AWS | 2026-10-03 | Documentar puertos y origen permitido |
| DNS | No observado | Pendiente | Administrador DNS | 2026-10-03 | Confirmar nombre público y resolución |
| Rollback probado | Código de rollback leído, ensayo no observado | Pendiente | Operaciones TI | 2026-10-03 | Ensayar en ventana controlada |
| Pruebas E2E | No existe evidencia de ejecución productiva | Pendiente | QA | 2026-10-04 | Ejecutar smoke test autorizado |

## Smoke test recomendado

Sin modificar datos, verificar en una ventana autorizada:

1. Abrir la aplicación por el dominio productivo.
2. Iniciar sesión con una cuenta de prueba.
3. Consultar Dashboard, inventario, colaborador, SIM y reportes.
4. Iniciar sesión con `SOLO_LECTURA`.
5. Confirmar que las acciones de creación, edición, asignación, devolución, cambio de estado, baja, servicio técnico y alertas no estén disponibles.
6. Confirmar que una petición mutante recibe `403 READ_ONLY` si se prueba mediante una herramienta autorizada.
7. Cerrar sesión.

## Bloqueos y pendientes obligatorios

Los siguientes textos deben permanecer como **Pendiente de validar con Codex** hasta disponer de evidencia:

- Región y tipo de instancia AWS.
- Nombre DNS productivo y estado de resolución.
- Reglas completas de Security Group, firewall y puertos IPv4/IPv6.
- Configuración activa de Nginx, server name, proxy, TLS y Certbot.
- Estado PM2, reinicios, logs y persistencia después de reinicio.
- Versión y nombre de la base PostgreSQL productiva.
- Backup productivo más reciente, retención y restauración probada.
- RPO, RTO y punto único de falla.
- MFA, grupos, `sudo`, `authorized_keys` y restricciones de SSH.
- Cobertura de pruebas y batería E2E.

## Fuentes de esta entrega

- Repositorio local `E:\Aguas San Isidro V2\ITAM`.
- `README.md`, `package.json`, `app.ts`, `server.ts`, workflows y migraciones.
- Documentación existente en `docs/api`, `docs/arquitectura`, `docs/database` y `docs/ci`.
- Evidencia de la sesión: ejecución CI/CD del commit `d98da12`, captura del proceso Node activo, prompt Ubuntu y salida de IP pública.
