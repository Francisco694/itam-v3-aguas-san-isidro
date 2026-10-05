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
