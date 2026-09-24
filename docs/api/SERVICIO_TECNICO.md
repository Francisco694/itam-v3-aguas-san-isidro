# API de servicio técnico

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico y funcional
**Base:** `/api/v1/servicio-tecnico`

Todas las rutas requieren sesión. El responsable se toma de sesión en creación, cotización, decisión, cierre, adjuntos y equipo temporal; en edición se recibe explícitamente.

## GET `/servicio-tecnico`

- **Propósito:** listar órdenes con estado, activo, responsables, costos, cotización y retorno.
- **Respuesta:** `200` colección `OrdenServicio`.
- **Errores:** `401`, `500`.

## GET `/servicio-tecnico/:id`

- **Propósito:** obtener una orden y sus datos de trabajo.
- **Path:** `id` entero positivo.
- **Respuesta:** `200` orden con estado, diagnóstico, costos, archivo de cotización y entregas temporales.
- **Errores:** `400`, `404`.

## POST `/servicio-tecnico`

- **Propósito:** registrar el envío de un dispositivo.
- **Body:** `dispositivoCodigo`, `tipoServicio=GARANTIA|REPARACION|MANTENCION|DIAGNOSTICO`, `fallaReportada` obligatorios; opcionales `proveedor`, `fechaEnvio`, `areaSolicitante`, `contactoServicio`, `accesoriosEntregados`, `observaciones`.
- **Respuesta:** `201` orden en `PENDIENTE_DIAGNOSTICO`.
- **Errores:** `400`, `404`, `409` si existe otra orden abierta o el activo no puede salir.
- **Reglas:** el envío cambia el flujo técnico del dispositivo y deja evidencia del custodio al ingreso.

```json
{"dispositivoCodigo":3001,"tipoServicio":"REPARACION","proveedor":"Proveedor Ejemplo","fechaEnvio":"2026-09-23","fallaReportada":"No enciende","accesoriosEntregados":"Cargador","observaciones":null}
```

## PATCH `/servicio-tecnico/:id`

- **Propósito:** corregir antecedentes del envío antes de avanzar.
- **Body:** `tipoServicio`, `fallaReportada`, `responsable` y opcionales `proveedor`, `fechaEnvio`, `areaSolicitante`, `contactoServicio`, `accesoriosEntregados`, `observaciones`.
- **Respuesta:** `200` orden actualizada.
- **Errores:** `400`, `404`, `409` si la orden ya avanzó a una etapa no editable.

## PATCH `/servicio-tecnico/:id/cotizacion`

- **Propósito:** registrar diagnóstico y cotización.
- **Body:** `diagnostico`, `descripcionReparacion`, `montoCotizacion` obligatorios; opcionales `plazoInformado`, `ticketProveedor` o `numeroOtProveedor`, `observacionesCotizacion`, `proveedor`.
- **Respuesta:** `200` orden en `COTIZACION_RECIBIDA`.
- **Errores:** `400` por texto o monto negativo; `404`; `409` por estado incompatible.
- **Reglas:** el monto se valida como dinero no negativo y el diagnóstico queda versionado en el flujo.

## POST `/servicio-tecnico/:id/cotizacion/archivo`

- **Propósito:** adjuntar una cotización.
- **Body:** multipart con archivo de cotización.
- **Respuesta:** `200` metadatos del archivo: nombre original, MIME, tamaño, versión y usuario.
- **Errores:** `400` sin archivo, MIME no permitido o tamaño inválido; `404`; `409` por estado incompatible.
- **Reglas:** se aceptan PDF, JPEG, PNG, DOC y DOCX; el archivo se firma/valida y una versión activa representa la cotización vigente.

## GET `/servicio-tecnico/:id/cotizacion/archivo`

- **Propósito:** obtener la cotización activa.
- **Query:** `download=true` fuerza descarga; sin query puede mostrarse inline según `Content-Disposition`.
- **Respuesta:** binario con MIME almacenado, `Content-Length`, `X-Content-Type-Options: nosniff` y `Cache-Control: private, no-store`.
- **Errores:** `400`, `404` si no existe archivo activo.

## GET `/servicio-tecnico/:id/envio/pdf`

- **Propósito:** generar la orden de trabajo/constancia de envío.
- **Respuesta:** `200`, `application/pdf`, descarga.
- **Errores:** `400`, `404`, `500`.

## POST `/servicio-tecnico/:id/decision`

- **Propósito:** decidir el destino de la cotización.
- **Body:** `decision=APROBAR|RECHAZAR|DAR_BAJA`; opcionales `motivo`, `observaciones`.
- **Respuesta:** `200` orden actualizada.
- **Errores:** `400`, `404`, `409` por etapa o decisión incompatible.
- **Reglas:** aprobar puede iniciar reparación; rechazar y dar baja conservan motivo y responsable.

## POST `/servicio-tecnico/:id/cerrar`

- **Propósito:** registrar retorno y cerrar o dar de baja el flujo.
- **Body:** `costoFinal`, `fechaRetorno`, `resultado`, `estadoFinal=OPERATIVO|SIN_REPARACION|BAJA`; opcional `observacionesRetorno`.
- **Respuesta:** `200` orden cerrada o baja registrada.
- **Errores:** `400`, `404`, `409` si falta decisión o el estado final no coincide.
- **Reglas:** el costo final no es negativo; el estado del dispositivo queda alineado con `estadoFinal`.

## POST `/servicio-tecnico/:id/equipo-temporal`

- **Propósito:** entregar un equipo temporal a la persona mientras el suyo está en servicio.
- **Body:** `dispositivoCodigo`, opcional `observaciones`.
- **Respuesta:** `200` entrega temporal abierta.
- **Errores:** `400`, `404`, `409` si la orden no admite equipo temporal o el reemplazo ya está ocupado.

## POST `/servicio-tecnico/:id/equipo-temporal/:entregaId/cerrar`

- **Propósito:** cerrar la devolución del equipo temporal.
- **Body:** `observaciones` opcional.
- **Respuesta:** `200` entrega temporal cerrada.
- **Errores:** `400`, `404`, `409` si ya está cerrada o no pertenece a la orden.

## Estados

Los estados implementados incluyen `PENDIENTE_DIAGNOSTICO`, `COTIZACION_RECIBIDA`, `REPARACION_APROBADA`, `REPARACION_RECHAZADA`, `EN_REPARACION`, `REPARACION_TERMINADA`, `CERRADA` y `BAJA`. Las transiciones se validan en el servicio y no deben simularse con un PATCH genérico del dispositivo.
