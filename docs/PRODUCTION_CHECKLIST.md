# Checklist de producción — ITAM

**Actualizado:** 23 de septiembre de 2026
**Tipo:** operativo
**Regla:** completar cada casilla con evidencia antes de declarar un despliegue listo.

## Preparación y respaldo

- [ ] `git status` limpio y cambios documentales revisados.
- [ ] `git diff` revisado por otra persona.
- [ ] Commit final creado con mensaje descriptivo.
- [ ] Push remoto realizado y commit verificado en el remoto.
- [ ] Backup PostgreSQL completo, fechado y con restauración de prueba.
- [ ] Versión, commit y fecha registrados en la bitácora.

## Base de datos

- [ ] Backup realizado antes de ejecutar migraciones.
- [ ] Migraciones pendientes ejecutadas en orden desde `database/migrations`.
- [ ] `schema_migrations` coincide con la versión esperada.
- [ ] Constraints de códigos, custodia, estados, montos y documentos verificadas.
- [ ] Familias de códigos y siguientes ordinales revisados.
- [ ] Índices únicos y parciales verificados.
- [ ] Usuarios, roles y permisos de la cuenta de aplicación validados.
- [ ] `GET /api/v1/health/database` responde correctamente.

## Backend

- [ ] `.env` de producción cargado fuera del repositorio.
- [ ] `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASSWORD` comprobados.
- [ ] Secretos de sesión y credenciales protegidos.
- [ ] `CORS_ORIGIN` definido con origen explícito.
- [ ] `BACKEND_HOST` y `PORT` revisados.
- [ ] `DOCUMENT_STORAGE_PATH` existe y tiene permisos mínimos.
- [ ] `npm run build` ejecutado en `backend`.
- [x] `npm run typecheck` ejecutado en `backend` durante la actualización documental.
- [x] `npm test` ejecutado en `backend`: 106 pruebas aprobadas durante la actualización documental.
- [ ] `GET /api/v1/health` responde correctamente.

## Frontend

- [ ] `environment.production.ts` apunta al API correcto.
- [ ] Proxy o reverse proxy publica `/api/v1` correctamente.
- [ ] `npm run build` ejecutado y presupuestos revisados.
- [ ] Login y cierre de sesión probados.
- [ ] Rutas protegidas y cambio obligatorio de credenciales probados.
- [ ] Responsive probado en escritorio y móvil.
- [ ] Dashboard validado con datos reales.

## Funcional

- [ ] Crear y editar activo.
- [ ] Validar IMEI y número de serie duplicados.
- [ ] Asignar a colaborador.
- [ ] Asignar a departamento.
- [ ] Devolver y revisar activo.
- [ ] Registrar verificación física.
- [ ] Crear SIM y asociarla a dispositivo.
- [ ] Registrar, corregir y consultar línea móvil.
- [ ] Generar acta de entrega y PDF.
- [ ] Enviar equipo a servicio técnico.
- [ ] Registrar diagnóstico y cotización.
- [ ] Adjuntar y descargar cotización.
- [ ] Aprobar, rechazar o dar de baja desde servicio técnico.
- [ ] Cerrar servicio técnico y revisar retorno.
- [ ] Abrir, seguir y cerrar offboarding.
- [ ] Consultar historial y trazabilidad.

## Etiquetado y documentos

- [ ] Brother QL-800 disponible y configurada.
- [ ] Rollo de 62 mm instalado.
- [ ] Etiqueta final dentro de 60 × 38 mm.
- [ ] QR legible con cámara y escáner.
- [ ] Código ITAM correcto en etiqueta.
- [ ] Prueba de impresión real archivada.
- [ ] PDF de acta, comprobante, reporte y orden de trabajo revisado.

## Seguridad

- [ ] Contraseñas hasheadas y política mínima verificada.
- [ ] PIN hasheado y bloqueo por intentos verificado.
- [ ] Expiración absoluta e inactividad de sesión probadas.
- [ ] Roles y operaciones de superusuario verificados.
- [ ] Errores no exponen SQL, secretos, rutas ni stack trace.
- [ ] CORS y cookies revisados con HTTPS de producción.

## Post despliegue y rollback

- [ ] Smoke test de health, login e inventario.
- [ ] Logs sin errores inesperados.
- [ ] PostgreSQL revisado después del despliegue.
- [ ] Usuarios, dashboard y reportes validados.
- [ ] Impresión y QR validados en ambiente real.
- [ ] Backup y procedimiento de rollback documentados.
- [ ] Incidencias y decisiones agregadas a la bitácora.

## Estado conocido al actualizar este documento

El backend pasó typecheck y 106 pruebas automatizadas. El build del frontend generó los bundles, pero fue rechazado por el presupuesto configurado para `dashboard.scss` (19,91 kB frente a 10 kB de máximo de error); esto debe resolverse o aprobarse explícitamente antes de producción.
