# Procedimientos Operativos y Tecnicos

> Archivo histórico conservado por compatibilidad. La fuente canónica de entrega es [`04_Procedimientos_Operativos_y_Tecnicos.md`](04_Procedimientos_Operativos_y_Tecnicos.md).

## Principios

Trabajar siempre con una cuenta nominal, revisar el activo antes de modificarlo, registrar responsable y observaciones, y comprobar el historial después de una operación. El perfil `SOLO_LECTURA` no ejecuta procedimientos de escritura.

## Publicación de una versión

1. Crear una rama o cambio revisable y actualizar la documentación relacionada.
2. Ejecutar typecheck, build y pruebas disponibles en cada paquete.
3. Revisar migraciones, rutas, PDF y permisos afectados.
4. Integrar a `main` solo después de revisar CI.
5. Confirmar que CD use el SHA validado y que el artefacto incluya la migración requerida.
6. Verificar health del backend, carga del frontend y logs sin exponer secretos.

El workflow de CD documenta empaquetado, migración, PM2, health check, respaldo de Nginx, `nginx -t`, recarga y rollback del backend y Nginx.

En el release `d8cd34c`, el CD incluye la migración `041_device_technical_catalog.sql`, la ejecuta con `ON_ERROR_STOP=1` y deja la migración preparada para ejecuciones repetidas. Nginx se configura con `client_max_body_size 12m`; el backend mantiene el límite funcional de 10 MB para catálogos técnicos.

## Alta y edición de inventario

1. Confirmar tipo de activo y campos dinámicos exigidos.
2. Validar IMEI, número de serie, SIM, valor y custodio.
3. Guardar solo con un perfil autorizado.
4. Confirmar que el código ITAM sea único y no se cambie después de creado.
5. Revisar el historial y la etiqueta física si corresponde.

## Asignación y devolución

1. Confirmar que el equipo esté disponible y que no tenga una custodia vigente incompatible.
2. Seleccionar colaborador o departamento.
3. Registrar responsable y observaciones.
4. Emitir acta o comprobante cuando el flujo lo requiera.
5. Verificar el nuevo estado y el historial.

## Catálogo técnico de un dispositivo

1. Abrir la ficha del dispositivo y ubicar **Acciones del equipo**.
2. Revisar **Catálogo técnico**. Si no existe, la interfaz muestra **Sin catálogo técnico adjunto**.
3. Seleccionar únicamente un PDF de hasta 10 MB y confirmar la carga. El backend valida extensión, MIME, firma PDF y tamaño.
4. Para un documento existente, usar **Ver catálogo técnico** para abrirlo en el visor del navegador o **Reemplazar PDF** para sustituirlo.
5. Confirmar que el resto de la ficha no haya cambiado: la operación no altera estado, custodio, SIM, línea móvil ni verificación.

El binario queda en la ruta persistente configurada por `DOCUMENT_STORAGE_PATH` y la asociación queda en `itam.catalogos_tecnicos_dispositivo`. La operación exige sesión y respeta el bloqueo global de `SOLO_LECTURA`.

### Carga masiva controlada por script

Para asignar manuales de usuario autorizados a varios dispositivos se puede usar `scripts/assign-device-manuals.mjs`. El manifiesto JSON contiene `codigoItam` y `url`; el script descarga cada PDF, valida su firma y tamaño y lo envía al endpoint existente. Primero ejecutar:

```text
node scripts/assign-device-manuals.mjs --env dev --manifest scripts/device-manuals.example.json --dry-run
```

Para subir en desarrollo, usar `ITAM_EMAIL` y `ITAM_PASSWORD` o `ITAM_PIN`. Para producción, configurar `ITAM_PROD_API_URL` o pasar `--api-url` explícitamente. El script omite catálogos existentes salvo que se indique `--replace`, informa errores por dispositivo y termina con código distinto de cero si alguna asignación falla.

## Verificación física

Registrar identificador observado, resultado `PENDIENTE`, `VERIFICADO` o `REVISAR`, evidencia y observaciones. La asociación de una SIM o línea no constituye verificación física.

## Servicio técnico

1. Crear la orden con fecha, proveedor, tipo de servicio, falla y responsable.
2. Descargar o revisar el PDF generado por `GET /api/v1/servicio-tecnico/:id/envio/pdf`.
3. Registrar diagnóstico, reparación propuesta, costo, plazo y ticket.
4. Adjuntar cotización si existe y comprobar su tipo y tamaño.
5. Registrar decisión y motivo cuando corresponda.
6. Cerrar equipos temporales antes de cerrar la orden.
7. Registrar retorno, costo final, resultado y estado final.
8. Confirmar que el PDF final conserve A4, logo, casillas, firmas y la sección `RECEPCIÓN Y DEVOLUCIÓN (INTERNO)`.

## Offboarding

1. Buscar al colaborador.
2. Abrir o revisar su proceso de salida.
3. Recuperar y devolver los activos pendientes.
4. Registrar resultados en cada activo.
5. Cerrar solo cuando los equipos pendientes sean cero.

## Diagnóstico seguro

Para investigar sin modificar datos, consultar primero logs de CI/CD, estado del release, health, rutas y migraciones. No ejecutar comandos de escritura, reinicios, cambios de firewall, DNS, certificados o base de datos sin autorización explícita y ventana controlada.

## Rollback y restauración

El CD permite restaurar el backend anterior y la configuración Nginx si falla el health check o `nginx -t`. La restauración de datos de PostgreSQL no está automatizada por el workflow. La prueba real de rollback y la restauración desde backup quedan **Pendiente de validar en servidor**.

## Matriz de operación

| Operación | Fuente técnica | Estado |
| --- | --- | --- |
| Health API | `backend/src/app.ts` | Confirmado |
| Solo lectura | `backend/src/shared/auth.middleware.ts` | Confirmado |
| Generación PDF OT | `backend/src/modules/servicio-tecnico/servicio-tecnico.pdf.ts` | Confirmado |
| Despliegue | `.github/workflows/cd.yml` | Confirmado |
| Rollback backend/Nginx | `.github/workflows/cd.yml` | Confirmado en código |
| Rollback de datos | No implementado en workflow | Pendiente de definir |
| Restauración de backup | No observada | Pendiente de validar en servidor |
