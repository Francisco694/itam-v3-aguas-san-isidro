# Checklist de producción — ITAM v3.0

## Antes del despliegue

- [ ] Realizar un backup completo y verificable de PostgreSQL, sin contraseñas embebidas en scripts.
- [ ] Confirmar la versión registrada en `itam.schema_migrations` y que la siguiente migración sea la esperada.
- [ ] Configurar `NODE_ENV=production`, conexión PostgreSQL, `PORT` y `CORS_ORIGIN` mediante secretos del entorno.
- [ ] Confirmar que `.env` no está versionado y que `.env.example` solo contiene ejemplos.
- [ ] Definir el origen HTTPS real del frontend en `CORS_ORIGIN`; producción no usa el fallback local.
- [ ] Confirmar que el frontend resolverá `/api/v1` mediante el proxy/reverse proxy de la infraestructura final.

## Construcción y migración

1. Ejecutar `npm ci`, `npm run typecheck`, `npm test` y `npm run build` en `backend/`.
2. Ejecutar `npm ci`, `npm test -- --watch=false` y `npm run build` en `frontend/`.
3. Desplegar una versión de backend compatible con las columnas legacy y nuevas.
4. Ejecutar las migraciones pendientes en orden dentro de una ventana controlada.
   Para este bloque, confirmar que `006_configurable_inventory_code_families.sql` se aplica después de `005`, que `007_dynamic_asset_registration.sql` se aplica después de `006` y que no existen familias/nombres/prefijos que colisionen con `1` a `6`.
5. Verificar `itam.schema_migrations`, las FK y que ningún dispositivo tenga `tipo_dispositivo_id` nulo o inválido.
6. Desplegar los artefactos compilados. `npm run dev`, `ng serve` y `npm start` son solo para desarrollo.

## Verificación posterior

- [ ] `GET /api/v1/health` responde 200.
- [ ] `GET /api/v1/health/database` responde 200.
- [ ] Smoke tests de tipos, familias, dispositivos, SIM, departamentos y estados responden correctamente.
- [ ] Crear un Smartphone controlado, comprobar código/etiqueta y retirarlo mediante el procedimiento autorizado.
- [ ] Confirmar familias `1` Smartphone, `2` SIM, `3` Notebook, `4` Monitor, `5` PC y `6` Periféricos; no crear automáticamente `7` a `9`.
- [ ] Confirmar que un tipo legacy sin familia muestra un error controlado y no reserva códigos.
- [ ] Confirmar que prefijos usados, códigos emitidos y relaciones históricas de familia no pueden modificarse.
- [ ] Revisar Dashboard, Inventario, Nuevo Equipo, ficha, SIM, Colaboradores, Departamentos, Estados y Offboarding; revisar Tipos de dispositivo y Familias de código mediante sus rutas administrativas directas.
- [ ] Confirmar que Nuevo Equipo no muestra familia ni prefijo, agrupa los tipos periféricos y valida sus campos dinámicos.
- [ ] Confirmar CORS desde el dominio real y ausencia de secretos en bundles y logs.

## Contingencia

- Detener el despliegue si el backfill deja dispositivos sin tipo o si falla una FK.
- Conservar la columna textual legacy durante esta versión; no ejecutar `DROP`, `TRUNCATE` ni borrados masivos.
- Si la migración falla, su transacción revierte completa. Corregir la causa antes de reintentar.
- Si la validación posterior falla, retirar los artefactos nuevos, restaurar la versión anterior compatible y recuperar el backup solo mediante el procedimiento aprobado por infraestructura.
