# API de dispositivos

**Actualizado:** 23 de septiembre de 2026
**Tipo:** técnico y funcional
**Base:** `/api/v1/dispositivos`

Todas las rutas requieren sesión. Las mutaciones toman el responsable desde la sesión cuando el controlador usa `authenticatedActorName`; en los demás contratos el campo `responsable` sigue siendo obligatorio.

## GET `/dispositivos`

- **Propósito:** listar inventario con tipo, estado, custodio, SIM/línea, valor y verificación.
- **Query:** `q`, `tipo`, `tipoDispositivoId`, `familiaCodigoInventarioId`, `estado`, `colaboradorId`, `departamentoId`, `departamentoColaboradorId`, `localidad`, `verificacion=PENDIENTE|VERIFICADO`.
- **Body:** ninguno.
- **Respuesta:** `200` colección de `DispositivoResumen`; incluye `codigoInventario`, `tipo`, `marca`, `modelo`, `numeroSerie`, `imei`, `valorComercial`, `estado`, `colaborador`, `departamento`, `simAsociada`, `lineaMovil`, `tipoCustodia`, `origenRegistro` y `verificacionFisica`.
- **Errores:** `400` si un filtro tiene formato inválido; `401` si no hay sesión.
- **Reglas:** `q` busca identificadores y campos operacionales; la verificación distingue pendientes de confirmados.

```http
GET /api/v1/dispositivos?estado=ASIGNADO&verificacion=PENDIENTE
Cookie: itam_session=<sesión>
```

## GET `/dispositivos/resumen-gerencial`

- **Propósito:** entregar los indicadores usados por el Dashboard.
- **Respuesta:** `200` con inventario actual, valor económico, distribución activa por tipo, equipos verificados, pendientes, estados operativos, servicio técnico, extraviados, bajas e histórico registrado por tipo.
- **Reglas:** el inventario activo usa estados operacionales; `SERVICIO_TECNICO` y `EN_SERVICIO_TECNICO` se consideran servicio técnico. El histórico se separa del inventario activo.
- **Errores:** `401`, `500`.

```json
{"success":true,"data":{"inventarioActual":{"cantidad":0,"valorTotal":0},"dispositivosVerificados":{"cantidad":0,"porcentajeSobreInventarioActual":0,"valorTotal":0,"pendientes":0},"inventarioActivoRealPorTipo":[],"historicoRegistradoPorTipo":[]}}
```

## GET `/dispositivos/validar-identificador`

- **Propósito:** verificar si un IMEI o número de serie ya está registrado.
- **Query:** `tipo=imei|serie`, `valor`; `excludeCodigoInventario` es opcional para editar el mismo activo.
- **Respuesta:** `200` `{ disponible, codigoInventario?, tipoDispositivo?, marca?, modelo? }`.
- **Errores:** `400` por tipo, valor o código excluido inválido; `401` por sesión.
- **Reglas:** la comparación ignora espacios exteriores y mayúsculas; no crea ni modifica activos.

```http
GET /api/v1/dispositivos/validar-identificador?tipo=imei&valor=356789012345678
```

## GET `/dispositivos/:codigo`

- **Propósito:** obtener la ficha completa del dispositivo.
- **Path:** `codigo`, entero positivo de inventario.
- **Respuesta:** `200` un `DispositivoResumen` ampliado con factura, línea, último responsable, resultado de offboarding, origen y verificación.
- **Errores:** `400` si el código no es entero positivo; `404` si no existe.

## POST `/dispositivos`

- **Propósito:** crear un dispositivo disponible y sin custodia.
- **Body:** `tipoDispositivoId` y `responsable` obligatorios; opcionales `marca`, `modelo`, `numeroSerie`, `imei`, `localidad`, `ubicacionDetalle`, `observaciones`, `atributosEspecificos` y `valorComercial`.
- **Respuesta:** `201` ficha creada.
- **Errores:** `400` por tipo inactivo, configuración de atributos, campos inválidos o valor negativo; `404` si el tipo no existe; `409` por serie o IMEI duplicado.
- **Reglas:** el código se reserva en backend desde la familia del tipo; se registra `ALTA_DISPOSITIVO` en la misma operación.

```json
{"tipoDispositivoId":1,"marca":"Lenovo","modelo":"ThinkPad","numeroSerie":"ABC123","imei":null,"atributosEspecificos":{},"valorComercial":450000,"responsable":"TI"}
```

## PATCH `/dispositivos/:codigo`

- **Propósito:** editar datos descriptivos y económicos.
- **Path:** `codigo`, entero positivo.
- **Body:** uno o más de `tipoDispositivoId`, `marca`, `modelo`, `numeroSerie`, `imei`, `localidad`, `ubicacionDetalle`, `observaciones`, `atributosEspecificos`, `valorComercial`; `responsable` obligatorio.
- **Respuesta:** `200` ficha actualizada.
- **Errores:** `400` si no hay campos editables o se intenta enviar código, estado o custodia; `404`; `409` por identificadores duplicados.
- **Reglas:** no cambia `codigoInventario`, custodia ni estado; los identificadores se normalizan y validan.

## POST `/dispositivos/:codigo/asignar-colaborador`

- **Propósito:** iniciar custodia de colaborador y, opcionalmente, registrar SIM/línea de la entrega.
- **Body:** `colaboradorId`, `responsable`; opcionales `simCodigoInventario`, `numeroTelefonico`, `observaciones`.
- **Respuesta:** `200` dispositivo actualizado.
- **Errores:** `400`, `404`, `409` por custodio existente, colaborador inactivo, estado incompatible o asociación inválida.
- **Reglas:** un dispositivo admite un solo custodio vigente; la operación deja historial.

## POST `/dispositivos/:codigo/asignar-departamento`

- **Propósito:** iniciar custodia directa de departamento.
- **Body:** `departamentoId`, `recibidoPorId`, `responsable`; opcionales `localidad`, `ubicacionDetalle`, `observaciones`.
- **Respuesta:** `200` dispositivo actualizado.
- **Errores:** `400`, `404`, `409` por custodio existente o estado incompatible.
- **Reglas:** el departamento es custodio directo y `recibidoPorId` identifica a la persona que recibe; no son el mismo concepto.

## POST `/dispositivos/:codigo/asociar-linea`

- **Propósito:** registrar o corregir el número telefónico del equipo y su SIM opcional.
- **Body:** `numeroTelefonico`, opcional `simId`, `responsable`, `observaciones`.
- **Respuesta:** `200` con la ficha actualizada.
- **Errores:** `400` por teléfono inválido; `404` por activo o SIM inexistente; `409` por número o relación duplicada.
- **Reglas:** guardar una línea no verifica físicamente el equipo ni cambia su estado de verificación. Una línea puede existir sin SIM.

## POST `/dispositivos/:codigo/devolver`

- **Propósito:** cerrar custodia y recibir el equipo.
- **Body:** `responsable`; opcionales `observaciones`, `condicion`, `resultado=DEVUELTO|DANADO`.
- **Respuesta:** `200` con dispositivo y comprobante de devolución.
- **Errores:** `400`, `404`, `409` si no hay custodia o la transición es incompatible.
- **Reglas:** libera custodia, registra historial y genera comprobante correlativo.

## POST `/dispositivos/:codigo/resultado-offboarding`

- **Propósito:** registrar el resultado de la salida de un colaborador para un activo.
- **Body:** `resultado=DEVUELTO|PENDIENTE|NO_ENTREGADO|EXTRAVIADO|ROBADO_HURTADO|DANADO`, `responsable`; opcionales `condicion`, `observaciones`.
- **Respuesta:** `200` activo actualizado.
- **Errores:** `400`, `404`, `409` si el resultado no corresponde al estado/custodia.
- **Reglas:** un pendiente conserva custodia; una recepción la libera; extravío o robo conservan evidencia del responsable.

## POST `/dispositivos/:codigo/dar-baja`

- **Propósito:** ejecutar una baja patrimonial controlada.
- **Body:** `motivo=IRREPARABLE|REPARACION_NO_CONVENIENTE|MULTIPLES_REPARACIONES|OBSOLESCENCIA|DANO_FISICO|SIN_REPUESTOS|OTRO`, `responsable`; opcional `observaciones`.
- **Respuesta:** `200` activo y baja registrada.
- **Errores:** `400`, `404`, `409` si ya existe una baja activa o la transición no procede.
- **Reglas:** conserva el valor comercial del momento y no se reemplaza por un cambio de estado genérico.

## POST `/dispositivos/:codigo/cambiar-estado`

- **Propósito:** cambiar un estado de dispositivo permitido.
- **Body:** `estadoId`, `responsable`, opcionales `observaciones`, `recuperar`, `motivoRecuperacion`, `accionLineaExtravio`.
- **Respuesta:** `200` activo actualizado.
- **Errores:** `400`, `404`, `409` por estado de otra entidad o transición incompatible.
- **Reglas:** `EXTRAVIADO` y `DADO_BAJA` requieren flujo especial; `recuperar=true` debe incluir motivo.

## GET `/dispositivos/:codigo/historial`

- **Propósito:** consultar eventos ordenados del activo.
- **Respuesta:** `200` colección con tipo de evento, estados anterior/nuevo, responsable, observaciones, detalle y fecha.
- **Errores:** `400`, `404`.

## GET `/dispositivos/:codigo/trazabilidad`

- **Propósito:** devolver ficha, eventos, custodias, responsable conocido, offboarding y verificaciones para auditoría operacional.
- **Respuesta:** `200` objeto de trazabilidad.
- **Errores:** `400`, `404`.

## GET `/dispositivos/:codigo/verificaciones-fisicas`

- **Propósito:** listar verificaciones físicas realizadas.
- **Respuesta:** `200` colección con encontrado, identificador esperado/comprobado, resultado, observación, usuario y fecha.
- **Errores:** `400`, `404`.

## POST `/dispositivos/:codigo/verificaciones-fisicas`

- **Propósito:** registrar una verificación física basada en evidencia.
- **Body:** `encontrado` boolean obligatorio; opcionales `identificadorComprobado`, `observacion`.
- **Respuesta:** `201` verificación creada.
- **Errores:** `400`, `404`, `409` si la operación no corresponde al activo.
- **Reglas:** el responsable se obtiene de la sesión; si no se encuentra el equipo, se registra observación por defecto y resultado `REVISAR`.

```json
{"encontrado":true,"identificadorComprobado":"ABC123","observacion":"Etiqueta y número de serie coinciden."}
```

## POST `/dispositivos/:codigo/verificacion-manual`

- **Propósito:** marcar el equipo como verificado por revisión manual del usuario autenticado.
- **Body:** ninguno.
- **Respuesta:** `201` verificación/evento creado.
- **Errores:** `400`, `404`, `409` si el activo ya está verificado o no admite la acción.
- **Reglas:** registra evento de historial; no se produce al asociar una línea.
